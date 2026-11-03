import type { MetadataRoute } from "next";
import { getCoaches, getGames, getGyms, getPlayers, getPostIndexOrEmpty, getTeams, getTournaments } from "@/data/repo";
import { DIVISIONS } from "@/lib/labels";
import { paths } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

const lastMod = (...dates: (string | undefined)[]) => {
  const d = dates.find((x) => x && Number.isFinite(Date.parse(x)));
  return d ? new Date(d) : undefined;
};

/** Все разделы и записи, включая матчи и /about (в старой версии их не хватало). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, players, teams, coaches, gyms, games, tournaments] = await Promise.all([
    getPostIndexOrEmpty(),
    getPlayers(),
    getTeams(),
    getCoaches(),
    getGyms(),
    getGames(),
    getTournaments(),
  ]);

  const page = (path: string, priority: number, changeFrequency: Entry["changeFrequency"], lastModified?: Date): Entry => ({
    url: absoluteUrl(path),
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  });

  return [
    page("/", 1, "daily"),
    page(paths.news(), 0.9, "daily"),
    page(paths.games(), 0.9, "daily"),
    page(paths.tournaments(), 0.8, "weekly"),
    page(paths.teams(), 0.8, "weekly"),
    page(paths.players(), 0.7, "weekly"),
    page(paths.coaches(), 0.6, "monthly"),
    page(paths.gyms(), 0.6, "monthly"),
    page(paths.about(), 0.5, "monthly"),
    ...DIVISIONS.map((d) => page(paths.division(d.id), 0.7, "weekly")),
    // Списки по дивизионам (взрослые — основной адрес выше)
    ...DIVISIONS.filter((d) => d.id !== "adult").flatMap((d) => [
      page(paths.players(d.id), 0.5, "weekly"),
      page(paths.games(d.id), 0.7, "daily"),
    ]),
    ...posts.map((p) => page(paths.post(p.slug), 0.7, "monthly", lastMod(p.updatedAt, p.publishedAt))),
    ...tournaments.map((t) => page(paths.tournament(t.slug), 0.7, "daily", lastMod(t.updatedAt))),
    ...teams.map((t) => page(paths.team(t.division, t.slug), 0.6, "weekly", lastMod(t.updatedAt))),
    ...games.map((g) => page(paths.game(g.id), 0.5, "weekly", lastMod(g.updatedAt, g.scheduledAt))),
    ...players.map((p) => page(paths.player(p.slug), 0.4, "monthly", lastMod(p.updatedAt))),
    ...coaches.map((c) => page(paths.coach(c.slug), 0.4, "monthly", lastMod(c.updatedAt))),
    ...gyms.map((g) => page(paths.gym(g.slug), 0.4, "monthly", lastMod(g.updatedAt))),
  ];
}
