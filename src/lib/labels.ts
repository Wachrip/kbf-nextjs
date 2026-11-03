// Подписи перечислений. Годы рождения дивизионов считаются от текущего сезона
// (settings/season → divisionAges).
import { seasonYear } from "./season";
import type {
  Division,
  GameStatus,
  Gym,
  GymType,
  PlayerPosition,
  Region,
  Team,
  Tournament,
  TournamentStatus,
} from "./types";

export const DIVISIONS: readonly { id: Division; label: string; age?: number }[] = [
  { id: "adult", label: "Взрослые" },
  { id: "u18", label: "U18", age: 18 },
  { id: "u16", label: "U16", age: 16 },
];

export const DEFAULT_DIVISION: Division = "adult";

export function isDivision(v: unknown): v is Division {
  return v === "adult" || v === "u18" || v === "u16";
}

export function divisionLabel(d: Division): string {
  return DIVISIONS.find((x) => x.id === d)?.label ?? d;
}

/** «взрослые» в середине фразы («Политех · взрослые»), U18/U16 как есть. */
export function divisionLower(d: Division): string {
  return d === "adult" ? "взрослые" : divisionLabel(d);
}

/**
 * Год старта текущего сезона («2026-27» → 2026). season — из settings/season (getCurrentSeason
 * в data/repo.ts: без документа сезон уже выведен по дате), поэтому now нужен только как
 * страховка для нераспознанной строки: с августа — текущий год, до августа — прошлый.
 */
export function seasonStartYear(season: string | undefined, now: number): number {
  const y = seasonYear(season);
  if (y != null) return y;
  const d = new Date(now + 6 * 60 * 60 * 1000);
  return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/**
 * Годы рождения дивизиона в сезоне, стартующем в году Y: U18 — Y−17…Y−16, U16 — Y−15…Y−14
 * (сезон 2026/27: U18 — 2009–2010, U16 — 2011–2012, как в макете).
 */
export function divisionAges(d: Division, startYear: number): string | undefined {
  // сезон 2026-27 → U18: 2009–2010
  const age = DIVISIONS.find((x) => x.id === d)?.age;
  if (!age) return undefined;
  return `Юноши ${startYear - age + 1}–${startYear - age + 2} г. р.`;
}

export const POSITIONS: readonly { id: PlayerPosition; label: string; code: string }[] = [
  { id: "pointGuard", label: "Разыгрывающий", code: "PG" },
  { id: "shootingGuard", label: "Атакующий защитник", code: "SG" },
  { id: "smallForward", label: "Лёгкий форвард", code: "SF" },
  { id: "powerForward", label: "Тяжёлый форвард", code: "PF" },
  { id: "center", label: "Центровой", code: "C" },
];

export function positionLabel(p: PlayerPosition): string {
  return POSITIONS.find((x) => x.id === p)?.label ?? p;
}

export function positionCode(p: PlayerPosition): string {
  return POSITIONS.find((x) => x.id === p)?.code ?? p;
}

/** «PF/C» — несколько амплуа в строке списка. */
export function positionCodes(list: PlayerPosition[]): string {
  return list.map(positionCode).join("/");
}

/** Тип турнира в UI: league+взрослые → Чемпионат, league+U18/U16 → Первенство. */
export function tournamentKind(t: Pick<Tournament, "type" | "division">): string {
  switch (t.type) {
    case "cup":
      return "Кубок";
    case "playoff":
      return "Плей-офф";
    default:
      return t.division === "adult" ? "Чемпионат" : "Первенство";
  }
}

export function tournamentStatusLabel(s: TournamentStatus): string {
  return s === "ongoing" ? "Идёт" : s === "upcoming" ? "Предстоит" : "Завершён";
}

export function gameStatusLabel(s: GameStatus): string {
  switch (s) {
    case "live":
      return "Идёт";
    case "finished":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return "Предстоит";
  }
}

/** Тип площадки: поле type, а пока его нет в данных — по capacity (есть места — зал). */
export function gymType(g: Pick<Gym, "type" | "capacity">): GymType {
  if (g.type === "indoor" || g.type === "outdoor") return g.type;
  return g.capacity != null ? "indoor" : "outdoor";
}

export function isGymType(v: unknown): v is GymType {
  return v === "indoor" || v === "outdoor";
}

// ── Регионы (Region в core; labelRu — короткие подписи) ────

export const REGIONS: readonly { id: Region; label: string; full: string; city?: string }[] = [
  { id: "bishkek", label: "Бишкек", full: "г. Бишкек", city: "Бишкек" },
  { id: "osh", label: "Ош", full: "г. Ош", city: "Ош" },
  { id: "chui", label: "Чуйская", full: "Чуйская обл." },
  { id: "issykKul", label: "Иссык-Кульская", full: "Иссык-Кульская обл." },
  { id: "naryn", label: "Нарынская", full: "Нарынская обл." },
  { id: "talas", label: "Таласская", full: "Таласская обл." },
  { id: "jalalAbad", label: "Джалал-Абадская", full: "Джалал-Абадская обл." },
  { id: "oshRegion", label: "Ошская", full: "Ошская обл." },
  { id: "batken", label: "Баткенская", full: "Баткенская обл." },
];

export const REGION_IDS: readonly Region[] = REGIONS.map((r) => r.id);

export function isRegion(v: unknown): v is Region {
  return typeof v === "string" && (REGION_IDS as readonly string[]).includes(v);
}

/** Короткая подпись (labelRu): «Бишкек», «Чуйская» — чипы фильтра. */
export function regionLabel(r: Region): string {
  return REGIONS.find((x) => x.id === r)?.label ?? r;
}

/** Полная подпись: «г. Бишкек», «Чуйская обл.» — карточки и шапки. */
export function regionFull(r: Region): string {
  return REGIONS.find((x) => x.id === r)?.full ?? r;
}

/** Турнир: регион или «Республиканский» (region == null). */
export function tournamentScope(t: Pick<Tournament, "region">): string {
  return t.region ? regionFull(t.region) : "Республиканский";
}

/**
 * Город с регионом одной строкой: «Кант, Чуйская обл.». Регион-город (Бишкек, Ош) при том же
 * городе не повторяется: «Бишкек». Нет города — только регион; нет региона — только город.
 */
export function placeLine(city: string | undefined, region: Region | undefined): string {
  const c = city?.trim() ?? "";
  if (!region) return c;
  const r = REGIONS.find((x) => x.id === region);
  if (!r) return c;
  if (r.city && (!c || c.toLowerCase() === r.city.toLowerCase())) return r.city;
  return c ? `${c}, ${r.full}` : r.full;
}

/** Регионы, которые есть в данных, в порядке перечисления. */
export function presentRegions(list: readonly { region?: Region }[]): Region[] {
  const set = new Set(list.map((x) => x.region).filter((r): r is Region => Boolean(r)));
  return REGION_IDS.filter((r) => set.has(r));
}

/**
 * Команды тренера одной строкой: «Сапсан U16 и U18», «Метеор · взрослые», больше двух —
 * «Сапсан · взрослые и ещё 2». Клуб — название без суффикса дивизиона.
 */
export function coachTeamsLine(own: readonly Pick<Team, "name" | "division">[]): string {
  if (own.length === 0) return "";
  const order = (t: Pick<Team, "division">) => DIVISIONS.findIndex((d) => d.id === t.division);
  const list = [...own].sort((a, b) => order(a) - order(b));
  const club = (t: Pick<Team, "name">) => t.name.replace(/\s+U1[68]$/, "");
  const first = list[0]!;
  if (list.length === 2 && club(list[0]!) === club(list[1]!)) {
    return `${club(first)} · ${list.map((t) => (t.division === "adult" ? "взрослые" : divisionLabel(t.division))).join(" и ")}`;
  }
  const head = `${club(first)} · ${first.division === "adult" ? "взрослые" : divisionLabel(first.division)}`;
  return list.length > 1 ? `${head} и ещё ${list.length - 1}` : head;
}
