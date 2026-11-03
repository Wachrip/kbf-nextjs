// Адреса страниц в одном месте.
import type { Division, GymType, Region } from "./types";

/** Значение фильтра турниров «Республиканские» (region == null) — не Region. */
export const REPUBLIC = "republic";
export type TournamentScope = Region | typeof REPUBLIC;

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export const paths = {
  home: () => "/",
  news: (opts: { page?: number; tag?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.tag) q.set("tag", opts.tag);
    if (opts.page && opts.page > 1) q.set("page", String(opts.page));
    const s = q.toString();
    return s ? `/news?${s}` : "/news";
  },
  post: (slug: string) => `/news/${encodeURIComponent(slug)}`,
  players: (division?: Division) =>
    division && division !== "adult" ? `/players?division=${division}` : "/players",
  player: (slug: string) => `/players/${encodeURIComponent(slug)}`,
  teams: () => "/teams",
  /** region — фильтр ?region= (чипы регионов). */
  division: (d: Division, region?: Region) => withQuery(`/teams/${d}`, { region }),
  /** season — архивный сезон состава (?season=2025-26); текущий сезон — без параметра. */
  team: (d: Division, slug: string, season?: string) =>
    withQuery(`/teams/${d}/${encodeURIComponent(slug)}`, { season }),
  coaches: () => "/coaches",
  coach: (slug: string) => `/coaches/${encodeURIComponent(slug)}`,
  gyms: (type?: GymType, region?: Region) => withQuery("/gyms", { type, region }),
  gym: (slug: string) => `/gyms/${encodeURIComponent(slug)}`,
  games: (division?: Division) =>
    division && division !== "adult" ? `/games?division=${division}` : "/games",
  game: (id: string) => `/games/${encodeURIComponent(id)}`,
  tournaments: (region?: TournamentScope) => withQuery("/tournaments", { region }),
  tournament: (slug: string) => `/tournaments/${encodeURIComponent(slug)}`,
  about: () => "/about",
  contacts: () => "/about#contacts",
};

export const NAV: readonly { key: string; label: string; href: string }[] = [
  { key: "news", label: "Новости", href: "/news" },
  { key: "games", label: "Календарь", href: "/games" },
  { key: "tournaments", label: "Турниры", href: "/tournaments" },
  { key: "teams", label: "Команды", href: "/teams" },
  { key: "players", label: "Игроки", href: "/players" },
  { key: "coaches", label: "Тренеры", href: "/coaches" },
  { key: "gyms", label: "Площадки", href: "/gyms" },
  { key: "about", label: "О федерации", href: "/about" },
];

/** Активный раздел по адресу: /teams/u18/x → teams. */
export function sectionOf(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return NAV.some((n) => n.key === first) ? first! : null;
}

/** Параметр из searchParams: первая строка или undefined. */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Пропсы страниц App Router 16: params и searchParams — промисы. */
export interface PageProps<P extends Record<string, string> = Record<string, never>> {
  params: Promise<P>;
  searchParams: Promise<SearchParams>;
}

/**
 * Фильтр из адреса (?region= и т. п.) по списку допустимых значений. Фильтр показывается,
 * только когда вариантов больше одного (minOptions), иначе любое значение — мусор.
 * clean = false — значение задано, но недопустимо: страница отвечает 308 на адрес без него.
 */
export function pickFilter<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
  minOptions = 2,
): { value?: T; clean: boolean } {
  if (raw === undefined) return { clean: true };
  if (typeof raw === "string" && allowed.length >= minOptions && (allowed as readonly string[]).includes(raw)) {
    return { value: raw as T, clean: true };
  }
  return { clean: false };
}
