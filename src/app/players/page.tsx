import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayerFields, PlayerResults, PlayersFilters, type PlayerLite, type TeamLite } from "@/components/islands/PlayersBrowser.client";
import { ChipLinks } from "@/components/ui/Chips";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getCurrentSeason, getMemberships, getPlayers, getTeams } from "@/data/repo";
import { count, FORMS, nameLastFirst, yearOf } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { activeMemberships } from "@/lib/membership";
import { DEFAULT_DIVISION, DIVISIONS, divisionLabel, divisionLower, isDivision } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { firstParam, paths, type PageProps } from "@/lib/routes";
import { sortTeams } from "@/lib/sport";
import { seasonLabel } from "@/lib/season";
import { ListHero, type Fact } from "@/components/ui/Heads";
import type { Division, Player } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = firstParam((await searchParams).division);
  const division: Division = isDivision(raw) ? raw : DEFAULT_DIVISION;
  return pageMetadata({
    path: paths.players(division),
    title: division === "adult" ? "Игроки" : `Игроки ${divisionLower(division)}`,
    description: `Игроки команд Кыргызской баскетбольной федерации, ${divisionLower(division)}: амплуа, рост, год рождения.`,
  });
}

/** Игроки дивизиона (?division=u18): фильтры по имени, команде, году рождения и амплуа — островок. */
function PlayersPageContent({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<ListSkeleton title="Игроки" variant="cards" />}>
      <Players searchParams={searchParams} />
    </Suspense>
  );
}

async function Players({ searchParams }: Pick<PageProps, "searchParams">) {
  const raw = firstParam((await searchParams).division);
  const division: Division = isDivision(raw) ? raw : DEFAULT_DIVISION;
  // Составы сезона зависят только от сезона — цепочка current → memberships идёт параллельно
  // с игроками и командами, а не после них
  const [players, teams, [current, memberships]] = await Promise.all([
    getPlayers(),
    getTeams(),
    getCurrentSeason().then(async (c) => [c, await getMemberships({ season: c })] as const),
  ]);

  const divisionTeams = sortTeams(teams.filter((t) => t.division === division));
  const teamIds = new Set(divisionTeams.map((t) => t.id));
  const allTeamIds = new Set(teams.map((t) => t.id));
  // Команды игрока в текущем сезоне — из активных записей memberships (взрослые первыми);
  // записи на удалённую команду не считаются. Пока записей сезона нет совсем (старые данные) —
  // по player.teamIds, как в v1.
  const legacy = memberships.length === 0;
  const activeByPlayer = new Map<string, string[]>();
  // Номер в команде этого дивизиона (майка без фото): первая активная запись в его командах
  const numberInDivision = new Map<string, string | undefined>();
  for (const m of activeMemberships(memberships, current)) {
    if (!allTeamIds.has(m.teamId)) continue;
    activeByPlayer.set(m.playerId, [...(activeByPlayer.get(m.playerId) ?? []), m.teamId]);
    if (teamIds.has(m.teamId) && !numberInDivision.has(m.playerId)) numberInDivision.set(m.playerId, m.number);
  }
  const teamsOf = (p: Player): string[] =>
    legacy ? p.teamIds.filter((id) => allTeamIds.has(id)) : (activeByPlayer.get(p.id) ?? []);
  // Список режется по дивизиону команды (как в архитектуре); неактивные — в конце.
  // Игроки без активной записи (или со ссылкой на удалённую команду) попадают в основной
  // список «Взрослые» с подписью «Без команды» — иначе их страниц не найти с сайта.
  const teamless = (p: Player) => teamsOf(p).length === 0;
  const list = players
    .filter((p) => teamsOf(p).some((id) => teamIds.has(id)) || (division === DEFAULT_DIVISION && teamless(p)))
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        nameLastFirst(a).localeCompare(nameLastFirst(b), "ru"),
    );

  // Лёгкие поля карточек; цвета формы и подписи считает островок по карте команд
  const cards: PlayerLite[] = list.map((p) => {
    const ids = teamsOf(p);
    const own = ids.filter((id) => teamIds.has(id));
    return {
      slug: p.slug,
      name: nameLastFirst(p),
      positions: p.positions,
      teamIds: ids,
      own,
      kitTeam: own[0] ?? ids[0],
      number: numberInDivision.get(p.id),
      height: p.height,
      birthYear: yearOf(p.birthDate) ?? undefined,
      isActive: p.isActive,
    };
  });
  // Карта команд: только те, что встречаются в карточках, без лишних полей
  const used = new Set(cards.flatMap((c) => [...c.own, ...(c.kitTeam ? [c.kitTeam] : [])]).concat(divisionTeams.map((t) => t.id)));
  const teamLite: TeamLite[] = teams
    .filter((t) => used.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, color: t.color, kitLight: t.kitLight, kitDark: t.kitDark }));

  // Цифры шапки: игроков и команд дивизиона, средний рост (по тем, у кого он указан)
  const heights = list.map((p) => p.height).filter((h): h is number => typeof h === "number" && h > 0);
  const facts: Fact[] = list.length
    ? [
        { label: "Игроков", value: list.length },
        { label: "Команд", value: divisionTeams.length },
        ...(heights.length ? [{ label: "Рост, ср.", value: Math.round(heights.reduce((a, b) => a + b, 0) / heights.length), accent: true }] : []),
      ]
    : [];

  return (
    <PlayersFilters players={cards} teams={teamLite} options={divisionTeams.map((t) => t.id)}>
      {/* Шапка — серверная; поля поиска в ней — островок PlayerFields (общее состояние с сеткой) */}
      <ListHero
        title="Игроки"
        sub={`Заявки команд на сезон ${seasonLabel(current)}: номер, амплуа и год рождения`}
        eyebrow={[divisionLabel(division), count(cards.length, FORMS.player, DEFAULT_LOCALE)].join(" · ")}
        facts={facts}
        bar={<PlayerFields />}
        chips={
          <ChipLinks
            label="Дивизион"
            items={DIVISIONS.map((d) => ({
              label: d.label,
              href: paths.players(d.id),
              current: d.id === division,
            }))}
          />
        }
      />
      <PlayerResults />
    </PlayersFilters>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function PlayersPage(props: PageProps) {
  return (
    <PageShell>
      <PlayersPageContent {...props} />
    </PageShell>
  );
}
