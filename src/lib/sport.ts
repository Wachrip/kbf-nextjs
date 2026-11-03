// Спортивная логика поверх данных: места в таблице, туры, ближайшие матчи. Чистые функции —
// «сейчас» передаётся параметром (см. format.ts).
import { dayDiff, isSameLocalDay } from "./format";
import type { Game, Gym, StandingRow, Team, Tournament } from "./types";

import { LIVE_STALE_MS, LIVE_WINDOW_MS } from "./live";

export { LIVE_WINDOW_MS };

/**
 * Матч ещё впереди: запланирован и не позже чем 3 часа назад начался, или идёт. live старше
 * 4 часов (статус забыли сменить) ближайшим не считается.
 */
export function isUpcoming(g: Game, now: number): boolean {
  if (g.status === "live") return Date.parse(g.scheduledAt) >= now - LIVE_STALE_MS;
  if (g.status !== "scheduled") return false;
  return Date.parse(g.scheduledAt) >= now - LIVE_WINDOW_MS;
}

export function isPlayed(g: Game): boolean {
  return g.status === "finished" && g.homeScore != null && g.awayScore != null;
}

export function byDateAsc(a: Game, b: Game): number {
  return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
}

export function byDateDesc(a: Game, b: Game): number {
  return Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt);
}

export function upcoming(games: Game[], now: number): Game[] {
  return games.filter((g) => isUpcoming(g, now)).sort(byDateAsc);
}

export function played(games: Game[]): Game[] {
  return games.filter(isPlayed).sort(byDateDesc);
}

/** Строки таблицы по порядку (так их хранит админка) с местом. */
export interface PlacedRow extends StandingRow {
  place: number;
  diff: number;
}

export function placedStandings(t: Pick<Tournament, "standings"> | null | undefined): PlacedRow[] {
  return (t?.standings ?? []).map((r, i) => ({
    ...r,
    place: i + 1,
    diff: r.pointsFor - r.pointsAgainst,
  }));
}

export function standingOf(
  t: Pick<Tournament, "standings"> | null | undefined,
  teamId: string,
): PlacedRow | null {
  return placedStandings(t).find((r) => r.teamId === teamId) ?? null;
}

/** Сыгран хотя бы один матч (won + lost > 0): до первых результатов место и В–П — «—». */
export function hasResults(row: Pick<StandingRow, "won" | "lost"> | null | undefined): boolean {
  return row != null && row.won + row.lost > 0;
}

/** Строка таблицы, только если у команды есть результаты (иначе null — «—» на странице). */
export function withResults<T extends Pick<StandingRow, "won" | "lost">>(row: T | null | undefined): T | null {
  return row && hasResults(row) ? row : null;
}

/** «1 место · 12 очк.» или пусто, если команды нет в таблице. */
export function placeLabel(t: Pick<Tournament, "standings"> | null | undefined, teamId: string): string {
  const row = standingOf(t, teamId);
  return row ? `${row.place} место · ${row.points} очк.` : "";
}

/** M в «Тур N из M» = максимальный round в играх турнира (corrections.md). */
export function maxRound(games: Game[]): number {
  return games.reduce((m, g) => Math.max(m, g.round ?? 0), 0);
}

/** Последний тур, в котором есть сыгранный матч. */
export function lastPlayedRound(games: Game[]): number {
  return games.filter(isPlayed).reduce((m, g) => Math.max(m, g.round ?? 0), 0);
}

export interface RoundGroup {
  /** Уникальный ключ группы: «<tournamentId>|r<тур>» или «<tournamentId>|s<стадия>». */
  key: string;
  /** Номер тура; 0 — матчи без тура (плей-офф: стадия в stage). */
  round: number;
  /** «Тур 5», «Финал»; при нескольких турнирах — «Кубок КБФ 2026 · Тур 2». */
  label: string;
  games: Game[];
  /** Все матчи тура сыграны или отменены. */
  done: boolean;
}

/**
 * Матчи по турам. Несыгранные туры выше сыгранных (ближайший первым), сыгранные — от
 * последнего к первому. Матчи без round (плей-офф) — группы по stage.
 */
export function groupByRound(
  games: Game[],
  now: number,
  /** Названия турниров — когда в календаре их несколько, тур подписывается турниром. */
  names?: Map<string, string>,
): RoundGroup[] {
  const map = new Map<string, { key: string; round: number; label: string; games: Game[] }>();
  const multi = (names?.size ?? 0) > 1;
  for (const g of games) {
    // Игра вне показанных турниров — отдельная группа «Вне турнира» (не сливается с туром лиги)
    const tid = g.tournamentId && (!names || names.has(g.tournamentId)) ? g.tournamentId : "";
    const round = g.round ?? 0;
    const base = round ? `Тур ${round}` : (g.stage ?? "Матчи");
    const key = `${tid}|${round ? `r${round}` : `s${base}`}`;
    const prefix = !tid ? "Вне турнира" : multi ? names!.get(tid) : undefined;
    const entry = map.get(key) ?? { key, round, label: prefix ? `${prefix} · ${base}` : base, games: [] };
    entry.games.push(g);
    map.set(key, entry);
  }
  const groups: RoundGroup[] = [...map.values()].map((e) => {
    e.games.sort(byDateAsc);
    return { ...e, done: e.games.every((g) => !isUpcoming(g, now)) };
  });
  const first = (g: RoundGroup) => Date.parse(g.games[0]!.scheduledAt);
  const open = groups.filter((g) => !g.done).sort((a, b) => first(a) - first(b));
  const closed = groups.filter((g) => g.done).sort((a, b) => first(b) - first(a));
  return [...open, ...closed];
}

/** Победитель матча: "home" | "away" | null (не сыгран или равный счёт — ошибка ввода). */
export function winner(g: Game): "home" | "away" | null {
  if (!isPlayed(g)) return null;
  if (g.homeScore === g.awayScore) return null;
  return g.homeScore! > g.awayScore! ? "home" : "away";
}

/** Счёт есть и его стоит показать: сыгран или идёт. */
export function hasScore(g: Game): boolean {
  return (g.status === "finished" || g.status === "live") && g.homeScore != null && g.awayScore != null;
}

const startOf = (t: Tournament) => Date.parse(t.startDate ?? t.createdAt ?? "") || 0;

/**
 * Главнее среди идущих: лига, затем республиканский (region нет) — региональный кубок,
 * начатый позже чемпионата, не перехватывает подписи дивизиона. Отрицательное — a главнее.
 */
const mainFirst = (a: Tournament, b: Tournament) =>
  Number(b.type === "league") - Number(a.type === "league") || Number(!b.region) - Number(!a.region);

/**
 * Турнир игры. Маппер админки tournamentId уже пишет; страховка для старых матчей без него
 * (README, «Админка: состояние и страховки») — турнир подбирается по дивизиону и датам:
 * - матч в интервале [startDate, endDate] одного турнира — этот турнир;
 * - в интервале нескольких (лига и параллельный кубок) — лига с ближайшим startDate ≤ даты
 *   матча (нет лиги — просто ближайший по старту);
 * - после endDate всех турниров (плей-офф, перенесённые матчи) — последний начавшийся турнир
 *   дивизиона: после него новый ещё не стартовал.
 * Начало турнира без startDate — createdAt.
 */
export function resolveTournamentId(g: Game, tournaments: Tournament[]): string | undefined {
  if (g.tournamentId && tournaments.some((t) => t.id === g.tournamentId)) return g.tournamentId;
  const at = Date.parse(g.scheduledAt);
  const begun = tournaments
    .filter((t) => t.division === g.division && (startOf(t) || -Infinity) <= at)
    .sort((a, b) => startOf(b) - startOf(a) || Number(b.type === "league") - Number(a.type === "league"));
  if (begun.length === 0) return undefined;
  const fits = begun.filter((t) => {
    // Конец дня окончания включительно
    const to = t.endDate ? Date.parse(t.endDate) + 24 * 60 * 60 * 1000 : Infinity;
    return at < to;
  });
  if (fits.length === 1) return fits[0]!.id;
  if (fits.length > 1) return (fits.find((t) => t.type === "league") ?? fits[0])!.id;
  // Матч после окончания всех начавшихся турниров — к последнему начавшемуся
  return begun[0]!.id;
}

/** Игры с проставленным (явно или по датам) tournamentId. */
export function withTournaments(games: Game[], tournaments: Tournament[]): Game[] {
  return games.map((g) => {
    const id = resolveTournamentId(g, tournaments);
    return id === g.tournamentId ? g : { ...g, tournamentId: id };
  });
}

/**
 * Главный турнир дивизиона: идущий (лига → республиканский → самый поздний старт) → предстоящий, в котором уже есть
 * расписание → последний завершённый → пустой предстоящий (только если других нет).
 * Пустой предстоящий не перекрывает результаты прошлого сезона.
 */
export function currentTournament(
  list: Tournament[],
  division: Tournament["division"],
  games: Game[] = [],
): Tournament | null {
  const own = list.filter((t) => t.division === division);
  const hasGames = (t: Tournament) => games.some((g) => g.tournamentId === t.id);
  const ongoing = own
    .filter((t) => t.status === "ongoing")
    .sort((a, b) => mainFirst(a, b) || startOf(b) - startOf(a));
  if (ongoing[0]) return ongoing[0];
  const upcomingT = own.filter((t) => t.status === "upcoming").sort((a, b) => startOf(a) - startOf(b));
  const scheduled = upcomingT.find(hasGames);
  if (scheduled) return scheduled;
  // Завершённые: тоже лига и республиканский выше (кубок, сыгранный после чемпионата, не главный)
  const finished = own
    .filter((t) => t.status === "finished")
    .sort((a, b) => mainFirst(a, b) || startOf(b) - startOf(a));
  if (finished[0]) return finished[0];
  return upcomingT[0] ?? null;
}

/**
 * Турнир команды: идущий турнир дивизиона (несколько — тот, где команда в таблице или играет,
 * лига и республиканский первыми) → предстоящий с расписанием → последний с командой в таблице → главный.
 * Текущий сезон всегда выше таблицы прошлого. Место берётся только из выбранного турнира:
 * команды в его таблице нет — место не показывается (standingOf → null).
 */
export function teamTournament(list: Tournament[], team: Team, games: Game[] = []): Tournament | null {
  const own = list.filter((t) => t.division === team.division);
  const involved = (t: Tournament) =>
    t.standings.some((r) => r.teamId === team.id) ||
    games.some((g) => g.tournamentId === t.id && (g.homeTeamId === team.id || g.awayTeamId === team.id));
  const ongoing = own
    .filter((t) => t.status === "ongoing")
    .sort(
      (a, b) =>
        Number(involved(b)) - Number(involved(a)) ||
        mainFirst(a, b) ||
        startOf(b) - startOf(a),
    );
  if (ongoing[0]) return ongoing[0];
  const scheduled = own
    .filter((t) => t.status === "upcoming" && games.some((g) => g.tournamentId === t.id))
    .sort((a, b) => Number(involved(b)) - Number(involved(a)) || startOf(a) - startOf(b));
  if (scheduled[0]) return scheduled[0];
  const withTeam = own.filter((t) => t.standings.some((r) => r.teamId === team.id)).sort((a, b) => startOf(b) - startOf(a));
  return withTeam[0] ?? currentTournament(list, team.division, games);
}

/**
 * Что показывает календарь дивизиона: все идущие турниры дивизиона (лига, параллельный кубок)
 * или, если идущих нет, главный турнир (currentTournament), плюс игры дивизиона, турнир которых
 * определить нельзя, — начиная со старта самого раннего показанного турнира.
 */
export function divisionCalendar(
  games: Game[],
  tournaments: Tournament[],
  division: Tournament["division"],
): { tournaments: Tournament[]; games: Game[] } {
  const own = tournaments.filter((t) => t.division === division);
  const ongoing = own.filter((t) => t.status === "ongoing").sort((a, b) => startOf(a) - startOf(b));
  const main = currentTournament(tournaments, division, games);
  const shown = ongoing.length ? ongoing : main ? [main] : [];
  const ids = new Set(shown.map((t) => t.id));
  const known = new Set(tournaments.map((t) => t.id));
  // Нижняя граница игр «вне турнира»: старт показанных турниров; без startDate — самый ранний
  // матч турнира, без матчей — createdAt. Иначе в календарь попали бы игры всех сезонов.
  const beginOf = (t: Tournament): number => {
    if (t.startDate) return Date.parse(t.startDate);
    const own = games.filter((g) => g.tournamentId === t.id).map((g) => Date.parse(g.scheduledAt));
    if (own.length) return Math.min(...own);
    return t.createdAt ? Date.parse(t.createdAt) : Infinity;
  };
  const from = shown.length ? Math.min(...shown.map(beginOf)) : -Infinity;
  const list = games.filter(
    (g) =>
      (g.tournamentId && ids.has(g.tournamentId)) ||
      (g.division === division &&
        (!g.tournamentId || !known.has(g.tournamentId)) &&
        Date.parse(g.scheduledAt) >= from),
  );
  return { tournaments: shown, games: list };
}

export function indexById<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

/** Ссылка «Как добраться»: 2ГИС зала, если есть. */
export function gymMapUrl(g: Pick<Gym, "mapUrl"> | null | undefined): string | undefined {
  return g?.mapUrl?.trim() || undefined;
}

/** Подпись зала с городом: «Дворец спорта · Бишкек». */
export function gymWithCity(g: Gym | null | undefined, fallbackName: string): string {
  if (!g) return fallbackName;
  return g.city ? `${g.name} · ${g.city}` : g.name;
}

/** Команды по названию (русская сортировка). */
export function sortTeams(list: Team[]): Team[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Результат матча для команды: «W» — победа, «L» — поражение. */
export type FormResult = "W" | "L";

/**
 * Форма команды в турнире: последние n завершённых матчей регулярки (stage пуст), от старых к
 * новым (последний — справа). Матчи без счёта или с равным счётом (ошибка ввода) пропускаются.
 */
export function teamForm(games: Game[], tournamentId: string, teamId: string, n = 5): FormResult[] {
  return games
    .filter(
      (g) =>
        g.tournamentId === tournamentId &&
        !g.stage &&
        isPlayed(g) &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        winner(g) != null,
    )
    .sort(byDateDesc)
    .slice(0, n)
    .reverse()
    .map((g) => ((winner(g) === "home") === (g.homeTeamId === teamId) ? "W" : "L"));
}

/** Матчи дня (по Бишкеку), по времени начала. */
export function gamesOfDay(games: Game[], now: number): Game[] {
  return games.filter((g) => isSameLocalDay(g.scheduledAt, now)).sort(byDateAsc);
}

/** Запланирован, но давно прошёл (дальше окна live) — результат не внесён. */
export function isOverdue(g: Game, now: number): boolean {
  return g.status === "scheduled" && Date.parse(g.scheduledAt) < now - LIVE_WINDOW_MS;
}

/** Короткое имя команды для ленты матчей: первые 3 буквы первого слова, капсом («КАЛ»). */
export function teamAbbr(name: string): string {
  const word = name.replace(/\s+U\d{2}$/i, "").trim().split(/\s+/)[0] ?? "";
  return word.slice(0, 3).toUpperCase();
}

/** Победы–поражения команды в турнире («4–3»); нет строки таблицы — пусто. */
export function recordOf(t: Pick<Tournament, "standings"> | null | undefined, teamId: string): string {
  const r = t?.standings.find((x) => x.teamId === teamId);
  return r ? `${r.won}–${r.lost}` : "";
}

export interface TickerGroups {
  /** Вчера: сыгранные и отменённые. */
  yesterday: Game[];
  /** Сегодня: идущие первыми, затем по времени. */
  today: Game[];
  /** Дальше: ближайшие запланированные после сегодня. */
  next: Game[];
}

/**
 * Лента матчей главной (как на NBA.com): вчера → сегодня (live первыми) → далее; дни — по
 * Бишкеку (dayDiff). Пусто во всех группах — ленту не показываем.
 */
export function tickerGroups(games: Game[], now: number, limitNext = 6): TickerGroups {
  const sorted = [...games].sort(byDateAsc);
  const yesterday = sorted.filter((g) => dayDiff(g.scheduledAt, now) === -1);
  const today = sorted
    .filter((g) => dayDiff(g.scheduledAt, now) === 0)
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || byDateAsc(a, b));
  const next = sorted
    .filter((g) => (dayDiff(g.scheduledAt, now) ?? -1) > 0 && g.status !== "cancelled")
    .slice(0, limitNext);
  return { yesterday, today, next };
}
