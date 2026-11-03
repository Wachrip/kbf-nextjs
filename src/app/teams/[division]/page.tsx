import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChipLinks, FilterChips } from "@/components/ui/Chips";
import { BackBlock, Empty, FilterBar, ListHero, Section, SecHead, type Fact } from "@/components/ui/Heads";
import { TeamTile } from "@/components/ui/TeamTile";
import { PageShell } from "@/components/ui/Vt";
import { getGames, getTeams, getTournaments } from "@/data/repo";
import { count, FORMS, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { DIVISIONS, divisionLabel, isDivision, presentRegions, regionLabel } from "@/lib/labels";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, pickFilter, type PageProps, type SearchParams } from "@/lib/routes";
import { currentTournament, hasResults, isPlayed, lastPlayedRound, placedStandings, sortTeams, teamAbbr, teamForm, withResults } from "@/lib/sport";
import type { Division, Game, Region, Team, Tournament } from "@/lib/types";

type Params = { division: string };

// dynamicParams несовместим с cacheComponents: неизвестный дивизион — notFound() в странице.
// Страница пререндерится без фильтра; ?region читается внутри <Suspense>. Неизвестный регион —
// 308 в proxy.ts; регион, которого нет у команд дивизиона, — список без фильтра (canonical
// любого ?region — чистый адрес дивизиона).
export const instant = false;

export function generateStaticParams(): Params[] {
  return DIVISIONS.map((d) => ({ division: d.id }));
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { division } = await params;
  if (!isDivision(division)) return notFoundMeta;
  return pageMetadata({
    path: paths.division(division),
    title: `Команды · ${divisionLabel(division)}`,
    description: `Команды дивизиона «${divisionLabel(division)}» Кыргызской баскетбольной федерации: города, тренеры, составы.`,
  });
}

interface GridData {
  division: Division;
  teams: Team[];
  tournament: Tournament | null;
  games: Game[];
}

/**
 * Фильтр регионов (k-fbar со счётчиком) и сетка плиток команд (k-tgrid): по месту в таблице
 * текущего турнира, команды вне таблицы — по названию после. region — выбранный (или все).
 */
function TeamGrid({ division, teams, tournament, games, region }: GridData & { region?: Region }) {
  const regions = presentRegions(teams);
  const placed = placedStandings(tournament);
  const rowOf = new Map(placed.map((r) => [r.teamId, r]));
  const list = sortTeams(teams.filter((t) => !region || t.region === region)).sort(
    (a, b) => (rowOf.get(a.id)?.place ?? Infinity) - (rowOf.get(b.id)?.place ?? Infinity),
  );
  const ordered = placed.length > 0 && list.some((t) => rowOf.has(t.id));
  return (
    <>
      <FilterBar
        count={
          list.length ? (
            <>
              <b>{list.length}</b> {plural(list.length, FORMS.team, DEFAULT_LOCALE)} · {ordered ? "по месту в таблице" : "по названию"}
            </>
          ) : null
        }
      >
        <FilterChips
          label="Регион"
          options={regions.map((r) => ({ id: r, label: regionLabel(r) }))}
          current={region}
          allLabel="Все регионы"
          hrefOf={(id) => paths.division(division, id as Region | undefined)}
        />
      </FilterBar>
      {list.length === 0 ? (
        <Empty>Команд пока нет</Empty>
      ) : (
        <div className="k-tgrid">
          {list.map((team) => (
            <TeamTile
              key={team.id}
              team={team}
              row={withResults(rowOf.get(team.id))}
              form={tournament ? teamForm(games, tournament.id, team.id) : []}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Внутри <Suspense>: ?region (только регионы команд дивизиона; один регион — фильтра нет). */
async function FilteredGrid({ searchParams, ...data }: GridData & { searchParams: Promise<SearchParams> }) {
  const { value } = pickFilter<Region>((await searchParams).region, presentRegions(data.teams));
  return <TeamGrid {...data} region={value} />;
}

/**
 * Команды дивизиона (концепция А): тёмная шапка с цифрами турнира и переключателем
 * дивизионов, фильтр регионов, плитки команд в цвете клуба; ниже — команды следующего
 * дивизиона (компактно).
 */
async function DivisionPageContent({ params, searchParams }: PageProps<Params>) {
  const { division: raw } = await params;
  if (!isDivision(raw)) notFound();
  const division: Division = raw;
  const [teams, tournaments, games] = await Promise.all([getTeams(), getTournaments(), getGames()]);
  const own = teams.filter((t) => t.division === division);
  const t = currentTournament(tournaments, division, games);
  const tGames = t ? games.filter((g) => g.tournamentId === t.id) : [];
  const playedN = tGames.filter(isPlayed).length;
  const round = lastPlayedRound(tGames);
  // Лидер — только когда сыгран хотя бы один матч
  const leaderRow = hasResults(t?.standings[0]) ? t?.standings[0] : undefined;
  const leader = leaderRow ? teams.find((x) => x.id === leaderRow.teamId) : undefined;
  // Подзаголовок — весь дивизион (оболочка общая для всех ?region)
  const sub = [count(own.length, FORMS.team, DEFAULT_LOCALE), t ? t.name : "", round ? `после ${round} тура` : ""].filter(Boolean).join(" · ");
  const facts: Fact[] = own.length
    ? [
        { label: "Команд", value: own.length },
        ...(t ? [{ label: "Сыграно", value: playedN }] : []),
        ...(leader ? [{ label: "Лидер", value: teamAbbr(leader.name), accent: true }] : []),
      ]
    : [];
  // «Также в …»: следующий дивизион по кругу (взрослые → U18 → U16 → взрослые)
  const at = DIVISIONS.findIndex((d) => d.id === division);
  const other = DIVISIONS[(at + 1) % DIVISIONS.length]!;
  const otherTeams = sortTeams(teams.filter((x) => x.division === other.id));
  const data: GridData = { division, teams: own, tournament: t, games };

  return (
    <>
      <ListHero
        title={divisionLabel(division)}
        sub={sub}
        eyebrow="Дивизион"
        back={{ href: paths.teams(), label: "Все дивизионы" }}
        facts={facts}
        chips={
          <>
            <ChipLinks
              label="Дивизион"
              items={DIVISIONS.map((d) => ({ label: d.label, href: paths.division(d.id), current: d.id === division }))}
            />
            {t ? (
              <Link className="k-lhero__cta" href={paths.tournament(t.slug)}>
                Таблица турнира →
              </Link>
            ) : null}
          </>
        }
      />
      <Section>
        {/* Оболочка — все команды дивизиона (пререндер); с ?region — отфильтрованные */}
        <Suspense fallback={<TeamGrid {...data} />}>
          <FilteredGrid {...data} searchParams={searchParams} />
        </Suspense>
      </Section>
      {otherTeams.length ? (
        <Section>
          <SecHead
            title={`Также в ${other.id === "adult" ? "дивизионе «Взрослые»" : other.label}`}
            link={{ href: paths.division(other.id), label: `Все ${count(otherTeams.length, FORMS.team, DEFAULT_LOCALE)} →` }}
          />
          <div className="k-tgrid k-tgrid--youth">
            {otherTeams.slice(0, 4).map((x) => (
              <TeamTile key={x.id} team={x} compact vt={false} />
            ))}
          </div>
        </Section>
      ) : null}
      <BackBlock href={paths.teams()} label="Все дивизионы" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function DivisionPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <DivisionPageContent {...props} />
    </PageShell>
  );
}
