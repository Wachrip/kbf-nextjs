// Сырые документы Firestore → типы сайта. Повторяет мапперы админки
// (apps/admin/lib/features/*/data/*mapper*.dart): те же значения по умолчанию, enum по name
// с запасным значением, массивы через фильтр типов. Неизвестные поля (seed и т. п.) отбрасываются.
import "server-only";
import { REGION_IDS } from "@/lib/labels";
import { normalizeSeason } from "@/lib/season";
import { normalizeHex } from "@/lib/teamPalette";
import type {
  AboutInfo,
  Coach,
  Division,
  Game,
  GameStatus,
  Gym,
  Membership,
  Player,
  PlayerPosition,
  Post,
  PostSource,
  Region,
  SeasonSettings,
  StaffMember,
  StandingRow,
  Team,
  Tournament,
  TournamentStatus,
  TournamentType,
  Translations,
} from "@/lib/types";

type Raw = Record<string, unknown>;

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;
/** Внешняя ссылка из базы: только http(s) — javascript:, data: и прочее отбрасываются. */
const optHttp = (v: unknown): string | undefined => {
  const s = optStr(v)?.trim();
  return s && /^https?:\/\/[^\s]+$/i.test(s) ? s : undefined;
};
/** Соцсеть: ник, @ник или http(s)-адрес; любая другая схема (javascript: и т. п.) — нет поля. */
const optSocial = (v: unknown): string | undefined => {
  const s = optStr(v)?.trim();
  if (!s) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return optHttp(s);
  return /^@?[\w.\-]+$/.test(s) ? s : undefined;
};
const optNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : undefined;
const num = (v: unknown, d = 0): number => optNum(v) ?? d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
/** Timestamp из REST — ISO-строка; старые записи могли быть строкой даты. */
const date = (v: unknown): string | undefined =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : undefined;

function oneOf<T extends string>(v: unknown, values: readonly T[], d: T): T {
  return typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : d;
}

const DIVISIONS: readonly Division[] = ["adult", "u18", "u16"];
const GAME_STATUSES: readonly GameStatus[] = ["scheduled", "live", "finished", "cancelled"];
const T_STATUSES: readonly TournamentStatus[] = ["upcoming", "ongoing", "finished"];
const T_TYPES: readonly TournamentType[] = ["league", "cup", "playoff"];
const SOURCES: readonly PostSource[] = ["internal", "telegram", "instagram"];
const POSITIONS: readonly PlayerPosition[] = [
  "pointGuard",
  "shootingGuard",
  "smallForward",
  "powerForward",
  "center",
];

const stamps = (d: Raw) => ({ createdAt: date(d.createdAt), updatedAt: date(d.updatedAt) });

const optRegion = (v: unknown): Region | undefined =>
  typeof v === "string" && (REGION_IDS as readonly string[]).includes(v) ? (v as Region) : undefined;

/**
 * tr: { <lang>: { <field>: value } } — как есть (только карты); пустая карта — поле не
 * добавляется. Сайт только читает: перезапись при сохранении — забота админки.
 */
function toTr(v: unknown): Translations | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Translations = {};
  for (const [lang, fields] of Object.entries(v as Raw)) {
    if (fields && typeof fields === "object" && !Array.isArray(fields)) out[lang] = { ...(fields as Raw) };
  }
  return Object.keys(out).length ? out : undefined;
}
const trOf = (d: Raw) => {
  const tr = toTr(d.tr);
  return tr ? { tr } : {};
};
const regionOf = (d: Raw) => {
  const region = optRegion(d.region);
  return region ? { region } : {};
};
export function toPost(id: string, d: Raw): Post {
  const gallery = strList(d.gallery);
  return {
    id,
    slug: str(d.slug),
    title: str(d.title),
    excerpt: optStr(d.excerpt),
    body: optStr(d.body),
    coverUrl: optStr(d.coverUrl),
    source: oneOf(d.source, SOURCES, "internal"),
    sourceUrl: optHttp(d.sourceUrl),
    publishedAt: date(d.publishedAt),
    isPublished: bool(d.isPublished, false),
    tags: strList(d.tags),
    ...(gallery.length ? { gallery } : {}),
    ...trOf(d),
    ...stamps(d),
  };
}

export function toPlayer(id: string, d: Raw): Player {
  return {
    id,
    slug: str(d.slug),
    firstName: str(d.firstName),
    lastName: str(d.lastName),
    photoUrl: optStr(d.photoUrl),
    birthDate: date(d.birthDate),
    height: optNum(d.height),
    weight: optNum(d.weight),
    positions: strList(d.positions).filter((p): p is PlayerPosition =>
      (POSITIONS as readonly string[]).includes(p),
    ),
    teamIds: strList(d.teamIds),
    teamNames: strList(d.teamNames),
    bio: optStr(d.bio),
    isActive: bool(d.isActive, true),
    ...trOf(d),
    ...stamps(d),
  };
}

export function toTeam(id: string, d: Raw): Team {
  return {
    id,
    slug: str(d.slug),
    name: str(d.name),
    city: optStr(d.city),
    logoUrl: optStr(d.logoUrl),
    coachId: optStr(d.coachId),
    coachName: optStr(d.coachName),
    gymId: optStr(d.gymId),
    gymName: optStr(d.gymName),
    division: oneOf(d.division, DIVISIONS, "adult"),
    foundedYear: optNum(d.foundedYear),
    description: optStr(d.description),
    ...regionOf(d),
    // Цвета: только корректный «#RRGGBB» (приводится к верхнему регистру), остальное — нет поля
    ...Object.fromEntries(
      (["color", "kitLight", "kitDark"] as const).flatMap((k) => {
        const hex = normalizeHex(d[k]);
        return hex ? [[k, hex]] : [];
      }),
    ),
    ...trOf(d),
    ...stamps(d),
  };
}

export function toCoach(id: string, d: Raw): Coach {
  return {
    id,
    slug: str(d.slug),
    firstName: str(d.firstName),
    lastName: str(d.lastName),
    photoUrl: optStr(d.photoUrl),
    bio: optStr(d.bio),
    achievements: strList(d.achievements),
    phone: optStr(d.phone),
    contactNote: optStr(d.contactNote),
    ...trOf(d),
    ...stamps(d),
  };
}

export function toGym(id: string, d: Raw): Gym {
  const type = d.type === "indoor" || d.type === "outdoor" ? d.type : undefined;
  return {
    id,
    slug: str(d.slug),
    name: str(d.name),
    city: optStr(d.city),
    address: optStr(d.address),
    mapUrl: optHttp(d.mapUrl),
    capacity: optNum(d.capacity),
    phone: optStr(d.phone),
    instagram: optSocial(d.instagram),
    photoUrls: strList(d.photoUrls),
    ...(type ? { type } : {}),
    ...regionOf(d),
    ...stamps(d),
  };
}

/** Матч без scheduledAt (дата обязательна в админке) — null, отбрасывается. */
export function toGame(id: string, d: Raw): Game | null {
  const scheduledAt = date(d.scheduledAt);
  if (!scheduledAt) return null;
  return {
    id,
    homeTeamId: str(d.homeTeamId),
    homeTeamName: str(d.homeTeamName),
    awayTeamId: str(d.awayTeamId),
    awayTeamName: str(d.awayTeamName),
    gymId: str(d.gymId),
    gymName: str(d.gymName),
    division: oneOf(d.division, DIVISIONS, "adult"),
    scheduledAt,
    status: oneOf(d.status, GAME_STATUSES, "scheduled"),
    homeScore: optNum(d.homeScore),
    awayScore: optNum(d.awayScore),
    tournamentId: optStr(d.tournamentId),
    round: optNum(d.round),
    stage: optStr(d.stage),
    statsPdfUrl: optHttp(d.statsPdfUrl),
    ...stamps(d),
  };
}

function toStanding(v: unknown): StandingRow | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Raw;
  const teamId = str(m.teamId);
  if (!teamId) return null;
  return {
    teamId,
    played: num(m.played),
    won: num(m.won),
    lost: num(m.lost),
    pointsFor: num(m.pointsFor),
    pointsAgainst: num(m.pointsAgainst),
    points: num(m.points),
  };
}

export function toTournament(id: string, d: Raw): Tournament {
  return {
    id,
    slug: str(d.slug),
    name: str(d.name),
    season: normalizeSeason(str(d.season)),
    division: oneOf(d.division, DIVISIONS, "adult"),
    ...regionOf(d),
    ...trOf(d),
    type: oneOf(d.type, T_TYPES, "league"),
    status: oneOf(d.status, T_STATUSES, "upcoming"),
    standings: Array.isArray(d.standings)
      ? d.standings.map(toStanding).filter((r): r is StandingRow => r !== null)
      : [],
    startDate: date(d.startDate),
    endDate: date(d.endDate),
    ...stamps(d),
  };
}

function toStaff(v: unknown): StaffMember | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Raw;
  const role = str(m.role);
  const name = str(m.name);
  if (!role && !name) return null;
  return { role, name, photoUrl: optStr(m.photoUrl) };
}

export function toAbout(d: Raw | null): AboutInfo {
  if (!d) return { staff: [] };
  return {
    history: optStr(d.history),
    phone: optStr(d.phone),
    email: optStr(d.email),
    address: optStr(d.address),
    staff: Array.isArray(d.staff)
      ? d.staff.map(toStaff).filter((s): s is StaffMember => s !== null)
      : [],
    requisites: optStr(d.requisites),
    instagram: optSocial(d.instagram),
    youtube: optSocial(d.youtube),
    telegram: optSocial(d.telegram),
    ...trOf(d),
    updatedAt: date(d.updatedAt),
  };
}

/**
 * Игровой номер: строка `^\d{1,2}$` как есть («0», «00», «07»); целое 0…99 из старых данных
 * (integerValue) — String(n); всё прочее — нет номера.
 */
export function jerseyNumber(v: unknown): string | undefined {
  if (typeof v === "string") return /^\d{1,2}$/.test(v) ? v : undefined;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99) return String(v);
  return undefined;
}

/** memberships/{id}. Запись без игрока, команды или сезона — null (отбрасывается). */
export function toMembership(id: string, d: Raw): Membership | null {
  const playerId = str(d.playerId);
  const teamId = str(d.teamId);
  const season = normalizeSeason(str(d.season));
  if (!playerId || !teamId || !season) return null;
  const number = jerseyNumber(d.number);
  const from = date(d.from);
  const to = date(d.to);
  return {
    id,
    playerId,
    playerName: str(d.playerName),
    teamId,
    teamName: str(d.teamName),
    division: oneOf(d.division, DIVISIONS, "adult"),
    season,
    ...(number != null ? { number } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...stamps(d),
  };
}

/** settings/season; нет документа — пустые настройки (сезон выводится по дате в repo.ts). */
export function toSeasonSettings(d: Raw | null): SeasonSettings {
  if (!d) return {};
  const current = optStr(d.current);
  return { ...(current ? { current: normalizeSeason(current) } : {}), updatedAt: date(d.updatedAt) };
}
