// Сезон «YYYY-YY» (общий контракт с админкой, утилита Season в packages/core): вторая часть —
// (первый год + 1) % 100. Текущий сезон хранится в settings/season.current; без документа —
// по дате: с августа идёт сезон текущего года, до августа — прошлого. Чистые функции:
// «сейчас» передаётся параметром (getNow() из кэша).

const SEASON_RE = /^(\d{4})-(\d{2})$/;
/** Бишкек UTC+6 круглый год. */
const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;
/** Август (0-based): с него начинается новый сезон. */
const SEASON_START_MONTH = 7;

export function isSeason(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = SEASON_RE.exec(v);
  return m != null && Number(m[2]) === (Number(m[1]) + 1) % 100;
}

/** Сезон, начинающийся в году year: 2026 → «2026-27». */
export function seasonOf(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Год старта: «2026-27» → 2026. Невалидная строка — null. */
export function seasonYear(season: string | undefined): number | null {
  return isSeason(season) ? Number(season.slice(0, 4)) : null;
}

/** Сезон по дате (запасной вариант без settings/season). */
export function seasonFromDate(now: number): string {
  const d = new Date(now + BISHKEK_OFFSET_MS);
  const y = d.getUTCFullYear();
  return seasonOf(d.getUTCMonth() >= SEASON_START_MONTH ? y : y - 1);
}

export function nextSeason(season: string): string {
  const y = seasonYear(season);
  return y == null ? season : seasonOf(y + 1);
}

export function prevSeason(season: string): string {
  const y = seasonYear(season);
  return y == null ? season : seasonOf(y - 1);
}

/** «2026-27» → «2026–27» (тире для текста). Невалидная строка — как есть. */
export function seasonLabel(season: string | undefined): string {
  if (!season) return "";
  return isSeason(season) ? season.replace("-", "–") : season;
}

/**
 * Старые записи турниров писали «2026/27» или «2026–27» — приводим к контракту «2026-27».
 * Нераспознанная строка возвращается как есть (показывается текстом, в фильтры не попадает).
 */
export function normalizeSeason(raw: string): string {
  const m = /^(\d{4})\s*[-/–—]\s*(\d{2}|\d{4})$/.exec(raw.trim());
  if (!m) return raw.trim();
  const candidate = `${m[1]}-${m[2]!.slice(-2)}`;
  return isSeason(candidate) ? candidate : raw.trim();
}

/** Сравнение для сортировки: новые сезоны первыми. */
export function bySeasonDesc(a: string, b: string): number {
  return (seasonYear(b) ?? -1) - (seasonYear(a) ?? -1) || b.localeCompare(a);
}
