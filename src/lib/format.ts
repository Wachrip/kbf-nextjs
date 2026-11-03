// Форматирование: склонения, даты (время Бишкека), время чтения, возраст, телефоны, имена.
// Перенесено из старого сайта (shared/date_format.dart, reading_time.dart, player_detail
// _age) и packages/core/utils/phone.dart. Функции чистые: «сейчас» передаётся параметром —
// при cacheComponents Date.now() вне «use cache» ломает пререндер.
// Склонения и даты принимают locale (lib/i18n.ts): для ru — прежняя логика с русскими
// формами, для других языков — Intl.PluralRules / Intl.DateTimeFormat. Сейчас все вызовы
// передают DEFAULT_LOCALE.
import { DEFAULT_LOCALE, intlLocale, type Locale } from "./i18n";

type Forms = readonly [string, string, string];

/**
 * plural(5, ["команда", "команды", "команд"], "ru") → "команд". Для других языков категория
 * Intl.PluralRules: one → forms[0], few → forms[1], остальное → forms[2] (формы передаёт
 * вызывающий на нужном языке).
 */
export function plural(n: number, forms: Forms, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) {
    const cat = new Intl.PluralRules(intlLocale(locale)).select(n);
    return cat === "one" ? forms[0] : cat === "few" ? forms[1] : forms[2];
  }
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** count(5, ["команда", "команды", "команд"], "ru") → "5 команд". */
export function count(n: number, forms: Forms, locale: Locale): string {
  return `${n} ${plural(n, forms, locale)}`;
}

export const FORMS = {
  team: ["команда", "команды", "команд"],
  player: ["игрок", "игрока", "игроков"],
  region: ["регион", "региона", "регионов"],
  coach: ["тренер", "тренера", "тренеров"],
  gym: ["площадка", "площадки", "площадок"],
  hall: ["зал", "зала", "залов"],
  game: ["матч", "матча", "матчей"],
  news: ["новость", "новости", "новостей"],
  minute: ["минута", "минуты", "минут"],
  year: ["год", "года", "лет"],
  point: ["очко", "очка", "очков"],
  place: ["место", "места", "мест"],
  found: ["Найден", "Найдено", "Найдено"],
  tournament: ["турнир", "турнира", "турниров"],
  kidTeam: ["детская", "детских", "детских"],
} as const satisfies Record<string, readonly [string, string, string]>;

/** «21 матч сыгран», «2 матча сыграно», «5 матчей сыграно». */
export function gamesPlayed(n: number, locale: Locale): string {
  return `${count(n, FORMS.game, locale)} ${plural(n, ["сыгран", "сыграно", "сыграно"], locale)}`;
}

// ── Даты ────────────────────────────────────────────────────
// Бишкек — UTC+6 круглый год (без перехода на летнее время с 2005). Сервер работает в UTC
// (App Hosting, Cloudflare Workers), поэтому сдвиг считаем явно, без зависимости от TZ процесса.
const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTHS_NOM = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

interface LocalParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
}

function toMs(v: string | number | undefined): number | null {
  if (v == null || v === "") return null;
  const ms = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/** Части даты по времени Бишкека. */
export function localParts(v: string | number | undefined): LocalParts | null {
  const ms = toMs(v);
  if (ms == null) return null;
  const d = new Date(ms + BISHKEK_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Intl для языков кроме русского: время Бишкека. */
function intl(v: string | number | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions): string {
  const ms = toMs(v);
  if (ms == null) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "Asia/Bishkek", ...opts }).format(ms);
}

/** «19:00» */
export function formatTime(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = localParts(v);
  return p ? `${pad(p.hours)}:${pad(p.minutes)}` : "";
}

/** «18 июля»; год добавляется, только если он не текущий (как в старом сайте). */
export function formatPostDate(v: string | undefined, now: number, locale: Locale): string {
  const p = localParts(v);
  if (!p) return "";
  const current = localParts(now)?.year;
  if (locale !== DEFAULT_LOCALE) {
    return intl(v, locale, { day: "numeric", month: "long", ...(p.year === current ? {} : { year: "numeric" }) });
  }
  const base = `${p.day} ${MONTHS_GEN[p.month]}`;
  return p.year === current ? base : `${base} ${p.year}`;
}

/** «24 июля 2026» */
export function formatLongDate(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { day: "numeric", month: "long", year: "numeric" });
  const p = localParts(v);
  return p ? `${p.day} ${MONTHS_GEN[p.month]} ${p.year}` : "";
}

/** «28 июля» */
export function formatDayMonth(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { day: "numeric", month: "long" });
  const p = localParts(v);
  return p ? `${p.day} ${MONTHS_GEN[p.month]}` : "";
}

const WEEKDAYS_CAP = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Номер дня по календарю Бишкека (для сравнения «сегодня/завтра»). */
function dayNumber(p: LocalParts): number {
  return Math.round(Date.UTC(p.year, p.month, p.day) / DAY_MS);
}

/** Тот же день по Бишкеку. */
export function isSameLocalDay(a: string | number | undefined, b: string | number | undefined): boolean {
  const x = localParts(a);
  const y = localParts(b);
  return x != null && y != null && dayNumber(x) === dayNumber(y);
}

/**
 * Понятная дата: «Сегодня», «Завтра», «Вчера», иначе «Сб, 7 ноября», в другом году —
 * «Сб, 7 ноября 2025». now — из getNow() (кэш). Другие языки — Intl.RelativeTimeFormat
 * для ±1 дня и Intl.DateTimeFormat.
 */
export function dayLabel(v: string | undefined, now: number, locale: Locale): string {
  const p = localParts(v);
  const n = localParts(now);
  if (!p || !n) return "";
  const diff = dayNumber(p) - dayNumber(n);
  if (locale !== DEFAULT_LOCALE) {
    if (Math.abs(diff) <= 1) {
      const rel = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" }).format(diff, "day");
      return rel.slice(0, 1).toUpperCase() + rel.slice(1);
    }
    return intl(v, locale, { weekday: "short", day: "numeric", month: "long", ...(p.year === n.year ? {} : { year: "numeric" }) });
  }
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  const base = `${WEEKDAYS_CAP[p.weekday]}, ${p.day} ${MONTHS_GEN[p.month]}`;
  return p.year === n.year ? base : `${base} ${p.year}`;
}

/** Коротко для ленты матчей: «Вчера», «Сегодня», «Завтра», иначе «Сб, 7 ноя». */
export function dayLabelShort(v: string | undefined, now: number, locale: Locale): string {
  const p = localParts(v);
  const n = localParts(now);
  if (!p || !n) return "";
  const diff = dayNumber(p) - dayNumber(n);
  if (Math.abs(diff) <= 1) return dayLabel(v, now, locale);
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { weekday: "short", day: "numeric", month: "short" });
  return `${WEEKDAYS_CAP[p.weekday]}, ${p.day} ${MONTHS_SHORT[p.month]}`;
}

/**
 * Дата без «Сегодня/Завтра/Вчера»: «Сб, 7 ноября» (short — «Сб, 7 ноя»), год — если не
 * текущий. Запасная подпись, когда относительная устарела (страница из кэша прошлого дня).
 */
export function dayLabelAbsolute(v: string | undefined, now: number, locale: Locale, short = false): string {
  const p = localParts(v);
  const n = localParts(now);
  if (!p || !n) return "";
  if (locale !== DEFAULT_LOCALE) {
    return intl(v, locale, { weekday: "short", day: "numeric", month: short ? "short" : "long", ...(p.year === n.year ? {} : { year: "numeric" }) });
  }
  const base = `${WEEKDAYS_CAP[p.weekday]}, ${p.day} ${(short ? MONTHS_SHORT : MONTHS_GEN)[p.month]}`;
  return p.year === n.year ? base : `${base} ${p.year}`;
}

/** Неделя по Бишкеку (пн–вс), в днях от сегодня: { from, to } для dayDiff. */
export function weekRange(now: number): { from: number; to: number } {
  const n = localParts(now);
  if (!n) return { from: 0, to: 6 };
  const from = -((n.weekday + 6) % 7);
  return { from, to: from + 6 };
}

/** Номер дня по Бишкеку: разница дат в днях (для группировки ленты «вчера/сегодня/далее»). */
export function dayDiff(v: string | undefined, now: number): number | null {
  const p = localParts(v);
  const n = localParts(now);
  return p && n ? dayNumber(p) - dayNumber(n) : null;
}

/** relativeStart — в lib/live.ts (лёгкий модуль для клиента); реэкспорт для серверного кода. */
export { relativeStart } from "./live";

/** «28 июля, вт» */
export function formatDayMonthWeekday(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { day: "numeric", month: "long", weekday: "short" });
  const p = localParts(v);
  return p ? `${p.day} ${MONTHS_GEN[p.month]}, ${WEEKDAYS[p.weekday]}` : "";
}

/** Матч одной строкой: «28 июля · 19:00», с днём недели — «28 июля, вт · 19:00». */
export function formatMatchDate(
  v: string | undefined,
  locale: Locale,
  opts: { weekday?: boolean } = {},
): string {
  const p = localParts(v);
  if (!p) return "";
  if (locale !== DEFAULT_LOCALE) {
    const day = opts.weekday ? formatDayMonthWeekday(v, locale) : formatDayMonth(v, locale);
    return `${day} · ${formatTime(v, locale)}`;
  }
  const day = opts.weekday
    ? `${p.day} ${MONTHS_GEN[p.month]}, ${WEEKDAYS[p.weekday]}`
    : `${p.day} ${MONTHS_GEN[p.month]}`;
  return `${day} · ${pad(p.hours)}:${pad(p.minutes)}`;
}

/** Мини-карточка: «29 июл · 18:00». */
export function formatMatchDateShort(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) {
    const d = intl(v, locale, { day: "numeric", month: "short" });
    return d ? `${d} · ${formatTime(v, locale)}` : "";
  }
  const p = localParts(v);
  return p ? `${p.day} ${MONTHS_SHORT[p.month]} · ${pad(p.hours)}:${pad(p.minutes)}` : "";
}

/** Разделитель месяцев: «Август 2026». */
export function formatMonthYear(v: string | undefined, locale: Locale): string {
  if (locale !== DEFAULT_LOCALE) return intl(v, locale, { month: "long", year: "numeric" });
  const p = localParts(v);
  return p ? `${MONTHS_NOM[p.month]} ${p.year}` : "";
}

/** Ключ дня по Бишкеку: «2026-11-07» (табло дня, проверка «день прошёл» на клиенте). */
export function dayKey(v: string | number | undefined): string {
  const p = localParts(v);
  return p ? `${p.year}-${pad(p.month + 1)}-${pad(p.day)}` : "";
}

/** Ключ месяца для группировки: «2026-07». */
export function monthKey(v: string | undefined): string {
  const p = localParts(v);
  return p ? `${p.year}-${pad(p.month + 1)}` : "";
}

/** «15 сен — 30 апр»; withYear — «15 сен 2025 — 30 апр 2026». */
export function formatDateRange(
  start: string | undefined,
  end: string | undefined,
  locale: Locale,
  withYear = false,
): string {
  const one = (v: string | undefined) => {
    if (locale !== DEFAULT_LOCALE) {
      return intl(v, locale, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
    }
    const p = localParts(v);
    if (!p) return "";
    return withYear
      ? `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}`
      : `${p.day} ${MONTHS_SHORT[p.month]}`;
  };
  const a = one(start);
  const b = one(end);
  if (a && b) return `${a} — ${b}`;
  return a || b;
}

/** Год даты по Бишкеку. */
export function yearOf(v: string | undefined): number | null {
  return localParts(v)?.year ?? null;
}

/** Возраст по дате рождения — хранить его нельзя, он протухает. */
export function ageAt(birth: string | undefined, now: number): number | null {
  const b = localParts(birth);
  const n = localParts(now);
  if (!b || !n) return null;
  let age = n.year - b.year;
  const hadBirthday = n.month > b.month || (n.month === b.month && n.day >= b.day);
  if (!hadBirthday) age--;
  return age < 0 ? null : age;
}

// ── Текст ───────────────────────────────────────────────────

/** Markdown → простой текст (как generate_excerpt.dart). */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_]{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`+/g, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Краткое описание: первые maxLen символов по границе слова. */
export function excerptOf(md: string | undefined, maxLen = 160): string {
  const text = stripMarkdown(md ?? "");
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : maxLen)}…`;
}

/** Время чтения: слова / 180, вверх, 1–99. 0 — текста нет. */
export function readingMinutes(body: string | undefined): number {
  const text = (body ?? "").trim();
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  return Math.min(99, Math.max(1, Math.ceil(words / 180)));
}

/** «4 мин чтения» или пусто. */
export function readingTime(body: string | undefined): string {
  const m = readingMinutes(body);
  return m ? `${m} мин чтения` : "";
}

// ── Люди ────────────────────────────────────────────────────

/** В списках и шапках — «Фамилия Имя». */
export function nameLastFirst(p: { firstName: string; lastName: string }): string {
  return `${p.lastName} ${p.firstName}`.trim();
}

/** В упоминаниях — «Имя Фамилия». */
export function nameFirstLast(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Инициалы для кружка без фото: «ИД». */
export function initialsOf(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Первая буква названия — команда или площадка без фото. */
export function firstLetter(text: string): string {
  return text.trim().slice(0, 1).toUpperCase();
}

// ── Телефоны (packages/core/utils/phone.dart) ──────────────
const KG_CODE = "996";
const KG_NATIONAL = 9;

/** Ввод → E.164 или null. В базе уже E.164 (нормализует админка) — здесь страховка. */
export function normalizePhone(raw: string | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  const hasPlus = input.startsWith("+");
  let digits = input.replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith(KG_CODE) && digits.length === KG_CODE.length + KG_NATIONAL) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === KG_NATIONAL + 1) digits = digits.slice(1);
  if (!hasPlus && digits.length === KG_NATIONAL) return `+${KG_CODE}${digits}`;
  if (hasPlus && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** «+996 555 12-34-56»; не кыргызские номера — как есть. */
export function formatPhone(raw: string | undefined): string {
  const e164 = normalizePhone(raw) ?? (raw ?? "").trim();
  const digits = e164.replace(/[^0-9]/g, "");
  if (!digits.startsWith(KG_CODE) || digits.length !== KG_CODE.length + KG_NATIONAL) return e164;
  const n = digits.slice(KG_CODE.length);
  return `+${KG_CODE} ${n.slice(0, 3)} ${n.slice(3, 5)}-${n.slice(5, 7)}-${n.slice(7)}`;
}

export function telUrl(raw: string): string {
  const e164 = normalizePhone(raw) ?? raw;
  return `tel:${e164.startsWith("+") ? e164 : `+${e164}`}`;
}

export function whatsappUrl(raw: string): string {
  const e164 = normalizePhone(raw) ?? raw;
  return `https://wa.me/${e164.replace(/[^0-9]/g, "")}`;
}

/** «+12», «−4», «0» — разница мячей (минус типографский). */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}
