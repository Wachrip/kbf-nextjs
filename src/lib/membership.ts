// Составы по сезонам (memberships). Чистые функции поверх записей — общие для страниц команды,
// игрока и списка игроков. Активная запись — сезон текущий и to нет (контракт со схемой).
import { formatDateRange, formatDayMonth } from "./format";
import type { Locale } from "./i18n";
import { DIVISIONS } from "./labels";
import { bySeasonDesc } from "./season";
import type { Membership } from "./types";

export function isActiveMembership(m: Membership, current: string): boolean {
  return m.season === current && !m.to;
}

export function activeMemberships(list: Membership[], current: string): Membership[] {
  return sortByDivision(list.filter((m) => isActiveMembership(m, current)));
}

const divisionRank = (m: Membership) => {
  const i = DIVISIONS.findIndex((d) => d.id === m.division);
  return i < 0 ? DIVISIONS.length : i;
};
const startMs = (m: Membership) => (m.from ? Date.parse(m.from) : -Infinity);
const endMs = (m: Membership) => (m.to ? Date.parse(m.to) : Infinity);

/** Взрослые → U18 → U16; внутри — по началу записи. */
export function sortByDivision(list: Membership[]): Membership[] {
  return [...list].sort((a, b) => divisionRank(a) - divisionRank(b) || startMs(a) - startMs(b));
}

/**
 * Главная активная запись игрока: взрослая команда, иначе первая активная (по порядку
 * дивизионов). Из неё — номер в шапке и подпись команды.
 */
export function mainMembership(list: Membership[], current: string): Membership | undefined {
  const active = activeMemberships(list, current);
  return active.find((m) => m.division === "adult") ?? active[0];
}

/** Сезоны записей, новые первыми, без повторов. */
export function seasonsOf(list: Membership[]): string[] {
  return [...new Set(list.map((m) => m.season))].sort(bySeasonDesc);
}

/** Порядок номеров: по числу, при равенстве короткий раньше («0» < «00» < «1» < «7» < «07» < «10»); без номера — в конце. */
export function compareNumbers(a: string | undefined, b: string | undefined): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  return Number(a) - Number(b) || a.length - b.length;
}

/** Номер по возрастанию (compareNumbers), без номера — в конце; затем по имени. */
export function byNumber(a: Membership, b: Membership): number {
  return compareNumbers(a.number, b.number) || a.playerName.localeCompare(b.playerName, "ru");
}

/**
 * Состав команды за сезон: roster — записи без to (играют сейчас или доиграли сезон),
 * left — ушедшие в течение сезона (to есть), последние ушедшие первыми. Игрок, вернувшийся в
 * ту же команду (новая запись без to), в «Покинули» не попадает. Повтор записей одного игрока
 * без to (ошибка ввода) — одна строка, с более поздним from.
 */
export function rosterOf(
  list: Membership[],
  teamId: string,
  season: string,
): { roster: Membership[]; left: Membership[] } {
  const own = list.filter((m) => m.teamId === teamId && m.season === season);
  const byPlayer = new Map<string, Membership>();
  for (const m of own.filter((x) => !x.to)) {
    const prev = byPlayer.get(m.playerId);
    if (!prev || startMs(m) > startMs(prev)) byPlayer.set(m.playerId, m);
  }
  const roster = [...byPlayer.values()].sort(byNumber);
  const leftByPlayer = new Map<string, Membership>();
  for (const m of own.filter((x) => x.to && !byPlayer.has(x.playerId))) {
    const prev = leftByPlayer.get(m.playerId);
    if (!prev || endMs(m) > endMs(prev)) leftByPlayer.set(m.playerId, m);
  }
  const left = [...leftByPlayer.values()].sort((a, b) => endMs(b) - endMs(a) || byNumber(a, b));
  return { roster, left };
}

/** Карьера: все записи, новые сезоны первыми, внутри сезона — последние записи первыми. */
export function careerOf(list: Membership[]): Membership[] {
  return [...list].sort(
    (a, b) => bySeasonDesc(a.season, b.season) || startMs(b) - startMs(a) || divisionRank(a) - divisionRank(b),
  );
}

/**
 * Срок записи в сезоне: «15 окт — 20 янв», «с 15 октября», «до 20 января». Без дат — «Весь
 * сезон» (прошлый сезон) или «Сейчас» (активная запись текущего).
 */
export function periodLabel(m: Membership, current: string, locale: Locale): string {
  if (m.from && m.to) return formatDateRange(m.from, m.to, locale);
  if (m.from) return `с ${formatDayMonth(m.from, locale)}`;
  if (m.to) return `до ${formatDayMonth(m.to, locale)}`;
  return m.season === current ? "Сейчас" : "Весь сезон";
}

/** «#7» или пусто. */
export function numberLabel(n: string | undefined): string {
  return n != null ? `#${n}` : "";
}
