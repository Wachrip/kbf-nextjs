// Чтение Firestore на сервере через REST — без SDK, ключа и долгих соединений (работает и на
// App Hosting, и в Cloudflare Workers: только fetch). Перенесено из piromag-market
// (core/firebase/firestoreRest.server.ts) и расширено: orderBy, диапазоны, offset, проекция
// полей (select / mask), count через runAggregationQuery.
// Запросы идут без входа — правила Firestore применяются как к гостю: сервер видит ровно то,
// что видит любой посетитель. Поэтому условия, которых ждут правила (isPublished == true у
// posts), обязаны быть в where.
import "server-only";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kbf-site";
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
/**
 * Сеть не должна вешать рендер. Таймаут — на попытку целиком (заголовки и тело ответа):
 * медленное тело тоже обрывается. Сбой сети, таймаут, 429 и 5xx — один повтор через паузу;
 * худший случай ≈ 2 × 5 с + 0,3 с, дальше ошибка и пустое состояние страницы (repo.ts, safe).
 */
const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 300;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

type RestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: { latitude?: number; longitude?: number } }
  | { arrayValue: { values?: RestValue[] } }
  | { mapValue: { fields?: Record<string, RestValue> } };

interface RestDocument {
  name: string;
  fields?: Record<string, RestValue>;
  createTime?: string;
  updateTime?: string;
}

export type RawDoc = Record<string, unknown> & { id: string };

function decodeValue(v: RestValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue; // ISO-строка — сериализуется в кэш
  if ("stringValue" in v) return v.stringValue;
  if ("bytesValue" in v) return v.bytesValue;
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v)
    return { latitude: v.geoPointValue.latitude ?? 0, longitude: v.geoPointValue.longitude ?? 0 };
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  return null;
}

function decodeFields(fields: Record<string, RestValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = decodeValue(v);
  return out;
}

function decodeDocument(doc: RestDocument): RawDoc {
  const id = doc.name.slice(doc.name.lastIndexOf("/") + 1);
  return { ...decodeFields(doc.fields), id };
}

export type FilterValue = string | number | boolean | Date;

function encodeValue(v: FilterValue): RestValue {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: v };
}

/** Ответ с уже прочитанным телом (тело читается внутри таймаута). */
interface Fetched {
  status: number;
  ok: boolean;
  text: string;
  json<T>(): T;
}

async function attempt(input: URL, init?: RequestInit): Promise<Fetched> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    const text = await res.text();
    return { status: res.status, ok: res.ok, text, json: <T>() => JSON.parse(text) as T };
  } finally {
    clearTimeout(timer);
  }
}

/** Запрос с одним повтором. Все запросы сайта — чтения, повтор безопасен (и у POST runQuery). */
async function send(input: URL, init?: RequestInit): Promise<Fetched> {
  try {
    const res = await attempt(input, init);
    if (!RETRY_STATUS.has(res.status)) return res;
    console.warn(`[firestore] ${res.status} ${input.pathname.split("/documents")[1] ?? ""}: повтор`);
  } catch (e) {
    console.warn(`[firestore] ${e instanceof Error ? e.name : "error"} ${input.pathname.split("/documents")[1] ?? ""}: повтор`);
  }
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return attempt(input, init);
}

/**
 * Счётчик прочитанных документов за жизнь процесса: каждая выборка пишет строку в лог —
 * видно, сколько стоит `next build` и холодный старт, без внешних сервисов.
 */
let readsInProcess = 0;

function countReads(what: string, docs: number) {
  readsInProcess += docs;
  const phase = process.env.NEXT_PHASE === "phase-production-build" ? "build" : "runtime";
  console.info(`[firestore] ${phase} ${what}: ${docs} док., всего в процессе ${readsInProcess}`);
}

/** Предел выборки коллекции целиком: если база внезапно вырастет, сайт не прочитает её молча. */
export const MAX_LIST_DOCS = 5000;

/**
 * Все документы коллекции (постранично), не больше maxDocs. fields — проекция (mask): только
 * эти поля, меньше трафика и памяти кэша.
 */
export async function listCollection(
  collection: string,
  opts: { fields?: string[]; maxDocs?: number } = {},
): Promise<RawDoc[]> {
  const maxDocs = opts.maxDocs ?? MAX_LIST_DOCS;
  const out: RawDoc[] = [];
  let pageToken = "";
  do {
    const u = new URL(`${ROOT}/${collection}`);
    u.searchParams.set("pageSize", String(Math.min(300, maxDocs - out.length)));
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    for (const f of opts.fields ?? []) u.searchParams.append("mask.fieldPaths", f);
    const res = await send(u);
    // 403 (правила) и прочие ошибки — исключение: strict() покажет error.tsx, safe() залогирует
    // и отдаст пустой список. 404 у коллекции не бывает — на всякий случай тоже пусто.
    if (res.status === 404) {
      console.warn(`[firestore] ${collection}: 404, нет коллекции`);
      return out;
    }
    if (!res.ok) throw new Error(`Firestore ${res.status} ${collection}: ${res.text.slice(0, 300)}`);
    const json = res.json<{ documents?: RestDocument[]; nextPageToken?: string }>();
    for (const d of json.documents ?? []) out.push(decodeDocument(d));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken && out.length < maxDocs);
  countReads(collection, out.length);
  if (pageToken) {
    console.warn(`[firestore] ${collection}: упёрлись в предел ${maxDocs} документов — выборка обрезана`);
  }
  return out;
}

/** Один документ или null (нет документа). 403 и прочие ошибки — исключение. */
export async function getDocument(path: string): Promise<RawDoc | null> {
  const res = await send(new URL(`${ROOT}/${path}`));
  // 404 — документа нет (null); 403 — правила не пустили: ошибка, а не «нет документа»
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore ${res.status} ${path}: ${res.text.slice(0, 300)}`);
  countReads(path, 1);
  return decodeDocument(res.json<RestDocument>());
}

export type Op =
  | "EQUAL"
  | "NOT_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "ARRAY_CONTAINS"
  | "IN";
export type Where = [field: string, op: Op, value: FilterValue | FilterValue[]];
export type OrderBy = [field: string, direction: "ASCENDING" | "DESCENDING"];

export interface QueryOptions {
  where?: Where[];
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  /** Проекция: только эти поля документа. */
  select?: string[];
}

function structuredQuery(collection: string, q: QueryOptions) {
  const filters = (q.where ?? []).map(([field, op, value]) => ({
    fieldFilter: {
      field: { fieldPath: field },
      op,
      value: Array.isArray(value)
        ? { arrayValue: { values: value.map(encodeValue) } }
        : encodeValue(value),
    },
  }));
  return {
    from: [{ collectionId: collection }],
    ...(filters.length === 0
      ? {}
      : { where: filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } } }),
    ...(q.orderBy?.length
      ? {
          orderBy: q.orderBy.map(([fieldPath, direction]) => ({ field: { fieldPath }, direction })),
        }
      : {}),
    ...(q.select ? { select: { fields: q.select.map((fieldPath) => ({ fieldPath })) } } : {}),
    ...(q.offset ? { offset: q.offset } : {}),
    limit: q.limit ?? MAX_LIST_DOCS,
  };
}

async function post(path: string, body: unknown, what: string): Promise<Fetched> {
  const res = await send(new URL(`${ROOT}${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // 403 — правила не пропустили запрос (rules — не фильтр: условия where не совпали с
  // правилом). Тоже исключение: поиск записи не должен превратиться в 404 (repo.ts, strict).
  if (!res.ok) {
    // Ошибка индекса содержит ссылку на его создание — её видно в логе сервера
    throw new Error(`Firestore ${what} ${res.status}: ${res.text.slice(0, 600)}`);
  }
  return res;
}

/** Запрос к коллекции верхнего уровня. Составные индексы — см. README, «Индексы». */
export async function runQuery(collection: string, q: QueryOptions = {}): Promise<RawDoc[]> {
  const res = await post(":runQuery", { structuredQuery: structuredQuery(collection, q) }, `runQuery ${collection}`);
  const rows = res.json<{ document?: RestDocument }[]>();
  const docs = rows.filter((r) => r.document).map((r) => decodeDocument(r.document!));
  countReads(`${collection} (query)`, docs.length);
  return docs;
}

/** Количество документов по условиям — runAggregationQuery count (1 чтение на 1000 док.). */
export async function countQuery(collection: string, where: Where[] = []): Promise<number> {
  const query = structuredQuery(collection, { where });
  // limit у агрегации не нужен — убираем, иначе count упрётся в MAX_LIST_DOCS
  delete (query as { limit?: number }).limit;
  const res = await post(
    ":runAggregationQuery",
    {
      structuredAggregationQuery: {
        structuredQuery: query,
        aggregations: [{ alias: "n", count: {} }],
      },
    },
    `count ${collection}`,
  );
  const rows = res.json<{ result?: { aggregateFields?: Record<string, RestValue> } }[]>();
  const field = rows.find((r) => r.result)?.result?.aggregateFields?.n;
  const n = field ? Number(decodeValue(field)) : 0;
  countReads(`${collection} (count)`, 1);
  return Number.isFinite(n) ? n : 0;
}
