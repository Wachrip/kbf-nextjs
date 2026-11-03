// Боевая база kbf-site через REST. Условие isPublished == true у posts — в каждом запросе:
// правила Firestore пускают гостя только к опубликованным новостям (rules — не фильтр).
import "server-only";
import { countQuery, getDocument, listCollection, runQuery, type OrderBy, type Where } from "./firestoreRest";
import {
  toAbout,
  toCoach,
  toGame,
  toGym,
  toMembership,
  toPlayer,
  toPost,
  toSeasonSettings,
  toTeam,
  toTournament,
} from "./normalize";
import { readingMinutes } from "@/lib/format";
import { isSeason } from "@/lib/season";
import type { Game, Membership } from "@/lib/types";
import type { KbfSource, MembershipQuery, PostIndexItem, PostSummary } from "./source";

const POST_LIST_FIELDS = [
  // body — только чтобы посчитать время чтения; в результат и кэш не попадает (summary)
  "body",
  "slug",
  "title",
  "excerpt",
  "coverUrl",
  "source",
  "sourceUrl",
  "publishedAt",
  "isPublished",
  "tags",
  "updatedAt",
];

const PLAYER_LIST_FIELDS = [
  "slug",
  "firstName",
  "lastName",
  "photoUrl",
  "birthDate",
  "height",
  "weight",
  "positions",
  "teamIds",
  "teamNames",
  "isActive",
  "updatedAt",
];

const GAME_FIELDS = [
  "homeTeamId",
  "homeTeamName",
  "awayTeamId",
  "awayTeamName",
  "gymId",
  "gymName",
  "division",
  "scheduledAt",
  "status",
  "homeScore",
  "awayScore",
  "tournamentId",
  "round",
  "stage",
  "statsPdfUrl",
  "updatedAt",
];

const published = (tag?: string): Where[] => [
  ["isPublished", "EQUAL", true],
  ...(tag ? ([["tags", "ARRAY_CONTAINS", tag]] as Where[]) : []),
];

function summary(id: string, d: Record<string, unknown>): PostSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body, gallery, ...rest } = toPost(id, d);
  const minutes = readingMinutes(body);
  return minutes ? { ...rest, minutes } : rest;
}

const TEAM_FIELDS = [
  "slug",
  "name",
  "city",
  "logoUrl",
  "coachId",
  "coachName",
  "gymId",
  "gymName",
  "division",
  "foundedYear",
  "description",
  "region",
  "color",
  "kitLight",
  "kitDark",
  // переводы description; у команды других переводимых полей нет
  "tr",
  "updatedAt",
];
const COACH_LIST_FIELDS = [
  "slug",
  "firstName",
  "lastName",
  "photoUrl",
  "achievements",
  "phone",
  "contactNote",
  "updatedAt",
];
const GYM_FIELDS = [
  "slug",
  "name",
  "city",
  "address",
  "mapUrl",
  "capacity",
  "phone",
  "instagram",
  "photoUrls",
  "type",
  "region",
  "updatedAt",
];
const TOURNAMENT_FIELDS = [
  "slug",
  "name",
  "season",
  "division",
  "type",
  "status",
  "standings",
  "startDate",
  "endDate",
  "region",
  // переводы name
  "tr",
  "updatedAt",
];

// Списки игроков, тренеров и новостей читаются без tr: в нём переводы биографий и тел статей.
// Со вторым языком — проекции вида tr.ky.title (README, «Языки»).
const MEMBERSHIP_FIELDS = [
  "playerId",
  "playerName",
  "teamId",
  "teamName",
  "division",
  "season",
  "number",
  "from",
  "to",
  "updatedAt",
];

const memberships = (docs: { id: string }[]): Membership[] =>
  docs
    .map((d) => toMembership(d.id, d as Record<string, unknown>))
    .filter((m): m is Membership => m !== null);

/**
 * Составы по условиям. Только равенства — составной индекс не обязателен (Firestore сливает
 * одиночные), но для teamId без season сортировка по season требует (teamId, season).
 */
async function queryMemberships(q: MembershipQuery): Promise<Membership[]> {
  if (q.season && !isSeason(q.season)) return [];
  const where: Where[] = [];
  if (q.teamId) where.push(["teamId", "EQUAL", q.teamId]);
  if (q.season) where.push(["season", "EQUAL", q.season]);
  if (q.division) where.push(["division", "EQUAL", q.division]);
  if (where.length === 0) throw new Error("memberships: нужен season, teamId или division");
  // Индекс memberships (teamId ASC, season ASC) — состав команды по всем сезонам
  const orderBy: OrderBy[] = q.teamId && !q.season ? [["season", "ASCENDING"]] : [];
  const docs = await runQuery("memberships", { where, orderBy, select: MEMBERSHIP_FIELDS });
  return memberships(docs);
}

export const firestoreSource: KbfSource = {
  // Индекс: posts (isPublished ASC, publishedAt DESC); с тегом — (tags CONTAINS, isPublished, publishedAt DESC)
  posts: async ({ offset, limit, tag }) =>
    (
      await runQuery("posts", {
        where: published(tag),
        orderBy: [["publishedAt", "DESCENDING"]],
        offset,
        limit,
        select: POST_LIST_FIELDS,
      })
    ).map((d) => summary(d.id, d)),

  postsCount: (tag) => countQuery("posts", published(tag)),

  postBySlug: async (slug) => {
    const [doc] = await runQuery("posts", {
      where: [...published(), ["slug", "EQUAL", slug]],
      limit: 1,
    });
    return doc ? toPost(doc.id, doc) : null;
  },

  postIndex: async () =>
    (
      await runQuery("posts", {
        where: published(),
        orderBy: [["publishedAt", "DESCENDING"]],
        select: ["slug", "tags", "publishedAt", "updatedAt"],
      })
    )
      .map((d): PostIndexItem => {
        const p = toPost(d.id, d);
        return { slug: p.slug, tags: p.tags, publishedAt: p.publishedAt, updatedAt: p.updatedAt };
      })
      .filter((p) => p.slug),

  players: async () =>
    (await listCollection("players", { fields: PLAYER_LIST_FIELDS })).map((d) => toPlayer(d.id, d)),

  playerBySlug: async (slug) => {
    const [doc] = await runQuery("players", { where: [["slug", "EQUAL", slug]], limit: 1 });
    return doc ? toPlayer(doc.id, doc) : null;
  },

  // Справочники — целиком, но с проекцией (mask): без служебных полей (seed, createdAt)
  teams: async () => (await listCollection("teams", { fields: TEAM_FIELDS })).map((d) => toTeam(d.id, d)),
  coaches: async () =>
    (await listCollection("coaches", { fields: COACH_LIST_FIELDS })).map((d) => toCoach(d.id, d)),
  coachBySlug: async (slug) => {
    const [doc] = await runQuery("coaches", { where: [["slug", "EQUAL", slug]], limit: 1 });
    return doc ? toCoach(doc.id, doc) : null;
  },
  gyms: async () => (await listCollection("gyms", { fields: GYM_FIELDS })).map((d) => toGym(d.id, d)),
  games: async () =>
    (await listCollection("games", { fields: GAME_FIELDS }))
      .map((d) => toGame(d.id, d))
      .filter((g): g is Game => g !== null),
  tournaments: async () =>
    (await listCollection("tournaments", { fields: TOURNAMENT_FIELDS })).map((d) => toTournament(d.id, d)),
  about: async () => toAbout(await getDocument("settings/about")),

  getCurrentSeason: async () => {
    const current = toSeasonSettings(await getDocument("settings/season")).current;
    return current && isSeason(current) ? current : null;
  },

  getMemberships: (q) => queryMemberships(q),

  // Индекс memberships (playerId ASC, season DESC)
  getPlayerMemberships: async (playerId) =>
    memberships(
      await runQuery("memberships", {
        where: [["playerId", "EQUAL", playerId]],
        orderBy: [["season", "DESCENDING"]],
        select: MEMBERSHIP_FIELDS,
      }),
    ),
};
