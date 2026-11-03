// Данные для страниц: кэш Next «use cache» (≈ 5 минут, LIFE ниже) + теги
// для будущей ревалидации по вебхуку из админки. Ошибка Firestore не роняет страницу: внутри
// кэша исключение (оно не кэшируется), снаружи — лог и пустое значение.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  AboutInfo,
  Coach,
  Division,
  Game,
  Gym,
  Membership,
  Player,
  Post,
  Team,
  Tournament,
} from "@/lib/types";
import { seasonFromDate } from "@/lib/season";
import { withTournaments } from "@/lib/sport";
import { dataMode, getSource } from "./getSource";
import type { PostIndexItem, PostSummary } from "./source";

export const TAGS = {
  posts: "kbf:posts",
  players: "kbf:players",
  teams: "kbf:teams",
  coaches: "kbf:coaches",
  gyms: "kbf:gyms",
  games: "kbf:games",
  tournaments: "kbf:tournaments",
  about: "kbf:about",
  memberships: "kbf:memberships",
  /** Документы settings/* (season, about). */
  settings: "kbf:settings",
} as const;

export const NEWS_PAGE_SIZE = 12;

/**
 * Срок кэша данных: ~5 минут (как ISR revalidate 300 в ТЗ). Объект, а не имя профиля из
 * next.config — так не нужны сгенерированные типы профилей. Позже — ревалидация по вебхуку
 * из админки (revalidateTag по тегам kbf:*).
 */
const LIFE = { stale: 300, revalidate: 300, expire: 3600 } as const;
/** «Сейчас» (getNow): не старше 5 минут даже после простоя. */
// expire не меньше 300 — иначе кэш «короткий» и становится dynamic hole (cacheLife.md,
// Prerendering behavior); stale тоже ≥ 300, иначе выпадает из App Shell. expire обязан быть
// больше revalidate (иначе Next падает на валидации) — поэтому revalidate 180.
const NOW_LIFE = { stale: 300, revalidate: 180, expire: 300 } as const;

async function safe<T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  // Настройка проверяется вне кэша и вне try: без KBF_DATA в production сборка и рендер
  // падают с понятной ошибкой, а не показывают пустой сайт или фикстуры.
  dataMode();
  try {
    return await fn();
  } catch (e) {
    console.error(`[data] ${what}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

/**
 * Для поиска записи (slug/id) и индекса новостей: ошибка Firestore НЕ превращается в «нет
 * записи» — иначе страница ответила бы 404/308, и этот ответ закэшировался бы. Ошибка
 * пробрасывается (лог здесь), её показывает error.tsx. Прошлая версия отдаётся, только пока
 * запись кэша жива (до expire и до перезапуска инстанса): с minInstances 0 после простоя кэша
 * нет, и при недоступном Firestore детальные страницы отвечают 500 (error.tsx). Если Firestore
 * недоступен при сборке, падает вся сборка — на сайте остаётся предыдущий выкат.
 */
async function strict<T>(what: string, fn: () => Promise<T>): Promise<T> {
  dataMode();
  try {
    return await fn();
  } catch (e) {
    console.error(`[data] ${what} (strict): ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

/**
 * «Сейчас» для страниц — из кэша (свой срок NOW_LIFE, expire 5 минут): Date.now() вне «use cache»
 * при cacheComponents ломает пререндер, а ближайший матч и возраст игрока должны совпадать
 * с данными той же версии страницы.
 */
export async function getNow(): Promise<number> {
  "use cache";
  // Свой срок: после простоя кэш данных может отдать устаревшее (до expire 3600), а «сейчас»
  // часовой давности показало бы вчерашнее табло — поэтому expire 5 минут.
  cacheLife(NOW_LIFE);
  return Date.now();
}

// ── Справочники (читаются целиком) ─────────────────────────

async function cachedTeams(): Promise<Team[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.teams);
  return (await getSource().teams()).filter((t) => t.slug && t.name);
}
export const getTeams = () => safe("teams", cachedTeams, [] as Team[]);
/** Поиск команды по slug — ошибка базы пробрасывается (strict). */
export const getTeamsStrict = () => strict("teams", cachedTeams);

async function cachedPlayers(): Promise<Player[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.players);
  return (await getSource().players()).filter((p) => p.slug);
}
export const getPlayers = () => safe("players", cachedPlayers, [] as Player[]);

async function cachedCoaches(): Promise<Coach[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.coaches);
  return (await getSource().coaches()).filter((c) => c.slug);
}
export const getCoaches = () => safe("coaches", cachedCoaches, [] as Coach[]);

async function cachedCoach(slug: string): Promise<Coach | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.coaches);
  return getSource().coachBySlug(slug);
}
export const getCoach = (slug: string) => strict(`coach ${slug}`, () => cachedCoach(slug));

async function cachedGyms(): Promise<Gym[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.gyms);
  return (await getSource().gyms()).filter((g) => g.slug);
}
export const getGyms = () => safe("gyms", cachedGyms, [] as Gym[]);
export const getGymsStrict = () => strict("gyms", cachedGyms);

async function cachedGames(): Promise<Game[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.games);
  return getSource().games();
}

/**
 * Матчи с проставленным турниром: у старых матчей, сохранённых до исправления маппера админки,
 * tournamentId может не быть (README, «Админка: состояние и страховки») — турнир подбирается по дивизиону и датам
 * (lib/sport.ts, resolveTournamentId). Дальше весь сайт фильтрует по g.tournamentId.
 */
export async function getGames(): Promise<Game[]> {
  const [games, tournaments] = await Promise.all([
    safe("games", cachedGames, [] as Game[]),
    getTournaments(),
  ]);
  return withTournaments(games, tournaments);
}

/** Поиск матча по id — ошибка базы пробрасывается. */
export async function getGamesStrict(): Promise<Game[]> {
  const [games, tournaments] = await Promise.all([strict("games", cachedGames), getTournamentsStrict()]);
  return withTournaments(games, tournaments);
}

async function cachedTournaments(): Promise<Tournament[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.tournaments);
  return (await getSource().tournaments()).filter((t) => t.slug);
}
export const getTournaments = () => safe("tournaments", cachedTournaments, [] as Tournament[]);
export const getTournamentsStrict = () => strict("tournaments", cachedTournaments);

async function cachedAbout(): Promise<AboutInfo> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.about, TAGS.settings);
  return getSource().about();
}
export const getAbout = () => safe("about", cachedAbout, { staff: [] } as AboutInfo);

// ── Сезон и составы ─────────────────────────────────────────

async function cachedSettingsSeason(): Promise<string | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.settings);
  return getSource().getCurrentSeason();
}

/**
 * Текущий сезон «2026-27»: settings/season.current; без документа (или при ошибке чтения) —
 * по дате из getNow(): с августа сезон текущего года, до августа — прошлого.
 */
export async function getCurrentSeason(): Promise<string> {
  const [season, now] = await Promise.all([safe("season", cachedSettingsSeason, null), getNow()]);
  return season ?? seasonFromDate(now);
}

async function cachedMemberships(season: string, teamId: string, division: string): Promise<Membership[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.memberships);
  return getSource().getMemberships({
    season: season || undefined,
    teamId: teamId || undefined,
    division: (division || undefined) as Division | undefined,
  });
}

/**
 * Составы: { season } — все записи сезона (список игроков), { teamId } — команда по всем
 * сезонам (страница команды, переключатель сезона), можно вместе и с division.
 */
export const getMemberships = (q: { season?: string; teamId?: string; division?: Division }) =>
  safe(
    `memberships ${q.season ?? ""} ${q.teamId ?? ""} ${q.division ?? ""}`.trim(),
    () => cachedMemberships(q.season ?? "", q.teamId ?? "", q.division ?? ""),
    [] as Membership[],
  );

async function cachedPlayerMemberships(playerId: string): Promise<Membership[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.memberships);
  return getSource().getPlayerMemberships(playerId);
}
/** Карьера игрока: все записи, новые сезоны первыми. */
export const getPlayerMemberships = (playerId: string) =>
  safe(`memberships player ${playerId}`, () => cachedPlayerMemberships(playerId), [] as Membership[]);

// ── Отдельные записи ────────────────────────────────────────

async function cachedPlayer(slug: string): Promise<Player | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.players);
  return getSource().playerBySlug(slug);
}
export const getPlayer = (slug: string) => strict(`player ${slug}`, () => cachedPlayer(slug));

// ── Новости ─────────────────────────────────────────────────

async function cachedPostsPage(page: number, tag: string): Promise<PostSummary[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.posts);
  return getSource().posts({
    offset: (page - 1) * NEWS_PAGE_SIZE,
    limit: NEWS_PAGE_SIZE,
    tag: tag || undefined,
  });
}
/** Страница ленты (с 1). tag — пустая строка = все. */
export const getPostsPage = (page: number, tag = "") =>
  safe(`posts page ${page}`, () => cachedPostsPage(page, tag), [] as PostSummary[]);

async function cachedLatestPosts(limit: number): Promise<PostSummary[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.posts);
  return getSource().posts({ offset: 0, limit });
}
export const getLatestPosts = (limit: number) =>
  safe("latest posts", () => cachedLatestPosts(limit), [] as PostSummary[]);

async function cachedPostsCount(tag: string): Promise<number> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.posts);
  return getSource().postsCount(tag || undefined);
}
export const getPostsCount = (tag = "") => safe("posts count", () => cachedPostsCount(tag), 0);

async function cachedPost(slug: string): Promise<Post | null> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.posts);
  return getSource().postBySlug(slug);
}
export const getPost = (slug: string) => strict(`post ${slug}`, () => cachedPost(slug));

async function cachedPostIndex(): Promise<PostIndexItem[]> {
  "use cache";
  cacheLife(LIFE);
  cacheTag(TAGS.posts);
  return getSource().postIndex();
}
/** Индекс новостей для проверки ?page/?tag и 404 — ошибка пробрасывается (редирект только по прочитанному). */
export const getPostIndex = () => strict("post index", cachedPostIndex);
/** Индекс для sitemap и generateStaticParams — при ошибке пусто (лог). */
export const getPostIndexOrEmpty = () => safe("post index", cachedPostIndex, [] as PostIndexItem[]);
