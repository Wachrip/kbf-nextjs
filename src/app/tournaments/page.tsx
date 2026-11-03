import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CupBracket, finalOf, stagesOf } from "@/components/ui/Bracket";
import { FilterChips } from "@/components/ui/Chips";
import { Empty, FilterBar, ListHero, Rule, Section, type Fact } from "@/components/ui/Heads";
import { Shirt } from "@/components/ui/Shirt";
import { getCurrentSeason, getGames, getTeams, getTournaments } from "@/data/repo";
import { cx } from "@/lib/cx";
import { count, firstLetter, FORMS, formatDateRange, formatDayMonth, formatLongDate, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { divisionLabel, divisionLower, presentRegions, regionFull, regionLabel, tournamentKind, tournamentStatusLabel } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { paths, pickFilter, REPUBLIC, type PageProps, type SearchParams, type TournamentScope } from "@/lib/routes";
import { seasonLabel } from "@/lib/season";
import { hasResults, indexById, lastPlayedRound, maxRound, winner } from "@/lib/sport";
import { teamColors, teamVars } from "@/lib/teamPalette";
import type { Game, Team, Tournament } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

const DESCRIPTION =
  "Чемпионаты, первенства и кубки Кыргызской баскетбольной федерации: идущие, предстоящие и архив с таблицами.";

// Страница пререндерится без фильтра; ?region читается внутри <Suspense>. Мусорное значение —
// 308 в proxy.ts; регион, которого нет у турниров, — список без фильтра. Canonical любого
// ?region — /tournaments (метаданные статические, как в v1).
export const metadata: Metadata = pageMetadata({
  path: paths.tournaments(),
  title: "Турниры",
  description: DESCRIPTION,
});

/**
 * Варианты фильтра: «Республиканские» (region нет), если такие турниры есть, и регионы из
 * данных. Фильтр показывается от двух вариантов.
 */
function scopes(list: Tournament[]): { id: TournamentScope; label: string }[] {
  const out: { id: TournamentScope; label: string }[] = [];
  if (list.some((t) => !t.region)) out.push({ id: REPUBLIC, label: "Республиканские" });
  for (const r of presentRegions(list)) out.push({ id: r, label: regionLabel(r) });
  return out;
}

function parseScope(sp: SearchParams, list: Tournament[]): TournamentScope | undefined {
  return pickFilter<TournamentScope>(sp.region, scopes(list).map((o) => o.id)).value;
}

const inScope = (t: Tournament, scope: TournamentScope | undefined) =>
  !scope || (scope === REPUBLIC ? !t.region : t.region === scope);

/** Подпись масштаба для карточек: регион или ничего (республиканский — по умолчанию). */
const regionTail = (t: Tournament) => (t.region ? ` · ${regionFull(t.region)}` : "");

const startOf = (t: Tournament) => Date.parse(t.startDate ?? t.createdAt ?? "") || 0;

function OngoingCard({ t, games, teams, dark }: { t: Tournament; games: Game[]; teams: Map<string, Team>; dark: boolean }) {
  const total = maxRound(games);
  // Кубок/плей-офф без туров: текущая стадия — у ближайшего несыгранного матча, иначе последнего
  const staged = games.filter((g) => g.stage).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const stageNow = (staged.find((g) => g.status === "scheduled" || g.status === "live") ?? staged[staged.length - 1])?.stage;
  const bracket = t.type !== "league" && t.standings.length === 0;
  const done = lastPlayedRound(games);
  const progress = total ? Math.round((done / total) * 100) : 0;
  // Лидер — только когда сыгран хотя бы один матч
  const leaderRow = hasResults(t.standings[0]) ? t.standings[0] : undefined;
  const leader = leaderRow ? teams.get(leaderRow.teamId) : undefined;
  const n = participants(t, games);
  const colors = teamColors(leader);
  return (
    <Link className={cx("k-card k-tcard", dark && "k-tcard--dark k-on-dark")} href={paths.tournament(t.slug)}>
      <span className="k-tcard__top">
        <span className={dark ? "k-badge" : "k-badge k-badge--navy"}>{tournamentKind(t)}</span>
        <span className="k-eyebrow">
          {[divisionLabel(t.division), n ? count(n, FORMS.team, DEFAULT_LOCALE) : ""].filter(Boolean).join(" · ")}
          {regionTail(t)}
        </span>
        <span className="k-status" style={{ marginLeft: "auto" }}>
          Идёт
        </span>
      </span>
      <span className="k-tcard__title">{t.name}</span>
      {t.startDate || t.endDate ? <span className="k-meta">{formatDateRange(t.startDate, t.endDate, DEFAULT_LOCALE, true)}</span> : null}
      {total ? (
        <span className="k-tcard__prog">
          <span
            className="k-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label={`Тур ${done} из ${total}`}
          >
            <span style={{ width: `${progress}%` }} />
          </span>
          <span aria-hidden>
            <span>
              Тур {done} из {total}
            </span>
            <span>{progress}%</span>
          </span>
        </span>
      ) : (
        <span className="k-meta">{stageNow ? `Стадия: ${stageNow}` : "Расписание уточняется"}</span>
      )}
      <span className="k-tcard__lead" style={leader ? teamVars(leader) : undefined}>
        {bracket ? (
          <span>{stageNow ? `Сейчас: ${stageNow}` : "Сетка уточняется"}</span>
        ) : leader && leaderRow ? (
          <>
            <Shirt kit={colors.dark} label={firstLetter(leader.name)} trim={colors.light.fill} on={dark ? "dark" : "light"} />
            <span>
              Лидер: <b>{leader.name}</b> · {count(leaderRow.points, FORMS.point, DEFAULT_LOCALE)}
            </span>
          </>
        ) : (
          <span>Таблица после первых матчей</span>
        )}
        <span className="k-link">{bracket ? "Матчи →" : "Таблица →"}</span>
      </span>
    </Link>
  );
}

/** Участники: из таблицы, иначе из матчей; региональный — команды дивизиона из региона. */
function participants(t: Tournament, games: Game[], teamsList: Team[] = []): number {
  if (t.standings.length) return t.standings.length;
  const n = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size;
  return n || teamsList.filter((x) => x.division === t.division && (!t.region || x.region === t.region)).length;
}

interface ViewData {
  all: Tournament[];
  games: Game[];
  teamsList: Team[];
  current: string;
}

/**
 * Турниры (концепция А): тёмная шапка с цифрами, фильтр регионов (?region=), «Идут сейчас»
 * (прогресс по турам, лидер), «Предстоят», сетка последнего кубка по стадиям, «Завершены»
 * с победителем. Схемы плей-офф до жеребьёвки и регламентов в модели нет.
 */
async function TournamentsPageContent({ searchParams }: PageProps) {
  const [all, games, teamsList, current] = await Promise.all([getTournaments(), getGames(), getTeams(), getCurrentSeason()]);
  const data: ViewData = { all, games, teamsList, current };
  // Оболочка — все турниры (пререндер, CDN); с ?region — отфильтрованные
  return (
    <Suspense fallback={<TournamentsView {...data} />}>
      <FilteredTournaments {...data} searchParams={searchParams} />
    </Suspense>
  );
}

async function FilteredTournaments({ searchParams, ...data }: ViewData & { searchParams: Promise<SearchParams> }) {
  return <TournamentsView {...data} scope={parseScope(await searchParams, data.all)} />;
}

function TournamentsView({ all, games, teamsList, current, scope }: ViewData & { scope?: TournamentScope }) {
  const options = scopes(all);
  const tournaments = all.filter((t) => inScope(t, scope));
  const teams = indexById(teamsList);
  const gamesOf = (t: Tournament) => games.filter((g) => g.tournamentId === t.id);
  const ongoing = tournaments.filter((t) => t.status === "ongoing").sort((a, b) => startOf(b) - startOf(a));
  const upcomingT = tournaments.filter((t) => t.status === "upcoming").sort((a, b) => startOf(a) - startOf(b));
  const archive = tournaments.filter((t) => t.status === "finished").sort((a, b) => startOf(b) - startOf(a));
  // Сетка по стадиям: последний по старту кубок/плей-офф с матчами стадий (идущий или завершённый)
  const cup = [...ongoing, ...archive]
    .filter((t) => t.type !== "league")
    .sort((a, b) => startOf(b) - startOf(a))
    .map((t) => ({ t, stages: stagesOf(gamesOf(t)) }))
    .find((x) => x.stages.length > 0);
  const cupFinal = cup ? finalOf(cup.stages) : undefined;

  /** Победитель архивного турнира: финал (stage «Финал»), иначе лидер таблицы. */
  const champion = (t: Tournament): { id: string; name: string; final?: Game } | undefined => {
    const final = gamesOf(t).find((g) => g.stage?.toLowerCase() === "финал" && g.status === "finished");
    const w = final ? winner(final) : null;
    if (final && w) return w === "home" ? { id: final.homeTeamId, name: final.homeTeamName, final } : { id: final.awayTeamId, name: final.awayTeamName, final };
    const id = hasResults(t.standings[0]) ? t.standings[0]?.teamId : undefined;
    const team = id ? teams.get(id) : undefined;
    return team ? { id: team.id, name: team.name } : undefined;
  };
  const seasonCount = all.filter((t) => t.season === current).length;
  const facts: Fact[] = all.length
    ? [
        { label: "Идут", value: all.filter((t) => t.status === "ongoing").length, accent: true },
        { label: "Предстоит", value: all.filter((t) => t.status === "upcoming").length },
        { label: "В сезоне", value: seasonCount },
      ]
    : [];

  return (
    <>
      <ListHero title="Турниры" sub="Чемпионаты, первенства U18 и U16 и кубки КБФ" eyebrow={`Сезон ${seasonLabel(current)}`} facts={facts} />
      {options.length > 1 ? (
        <Section>
          <FilterBar
            count={
              <>
                <b>{tournaments.length}</b> {plural(tournaments.length, FORMS.tournament, DEFAULT_LOCALE)}
              </>
            }
          >
            <FilterChips
              label="Регион"
              options={options}
              current={scope}
              allLabel="Все регионы"
              hrefOf={(id) => paths.tournaments(id as TournamentScope | undefined)}
            />
          </FilterBar>
        </Section>
      ) : null}
      {tournaments.length === 0 ? (
        <Section>
          <Empty>Скоро новый сезон</Empty>
        </Section>
      ) : null}
      {ongoing.length ? (
        <Section>
          <Rule label="Идут сейчас" accent />
          <div className={cx("k-tcards", ongoing.length >= 3 && "k-tcards--3")} style={{ marginTop: 14 }}>
            {ongoing.map((t, i) => (
              <OngoingCard key={t.id} t={t} games={gamesOf(t)} teams={teams} dark={i === 0} />
            ))}
          </div>
        </Section>
      ) : null}
      {upcomingT.length ? (
        <Section>
          <Rule label="Предстоят" />
          <div className="k-tcards" style={{ marginTop: 14 }}>
            {upcomingT.map((t) => {
              const n = participants(t, gamesOf(t), teamsList);
              const stages = [...new Set(gamesOf(t).map((g) => g.stage).filter((x): x is string => Boolean(x)))];
              return (
                <Link key={t.id} className="k-card k-tcard k-tcard--soon" href={paths.tournament(t.slug)}>
                  <span className="k-tcard__top">
                    <span className="k-badge k-badge--navy">{tournamentKind(t)}</span>
                    <span className="k-eyebrow">
                      {[divisionLabel(t.division), n ? count(n, FORMS.team, DEFAULT_LOCALE) : ""].filter(Boolean).join(" · ")}
                      {regionTail(t)}
                    </span>
                  </span>
                  <span className="k-tcard__title">{t.name}</span>
                  <span className="k-meta">{t.startDate ? `Старт ${formatLongDate(t.startDate, DEFAULT_LOCALE)}` : "Старт уточняется"}</span>
                  {stages.length ? (
                    <span className="k-tcard__stages">
                      {stages.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </span>
                  ) : null}
                  <span className="k-tcard__lead">
                    {gamesOf(t).length ? `${count(gamesOf(t).length, FORMS.game, DEFAULT_LOCALE)} в расписании` : "Расписание появится позже"}
                    <span className="k-link">Подробнее →</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}
      {cup ? (
        <Section>
          <div className="k-sechead">
            <h2 className="k-d-md">{cup.t.name} · по стадиям</h2>
            <span className="k-meta">
              {cup.t.status === "finished" && cupFinal ? `завершён ${formatDayMonth(cupFinal.scheduledAt, DEFAULT_LOCALE)}` : tournamentStatusLabel(cup.t.status).toLowerCase()}
            </span>
          </div>
          <CupBracket stages={cup.stages} teams={teams} title={cup.t.name} finished={cup.t.status === "finished"} />
        </Section>
      ) : null}
      {archive.length ? (
        <Section>
          <Rule label="Завершены" />
          <div className="k-tcards k-tcards--3" style={{ marginTop: 14 }}>
            {archive.map((t) => {
              const win = champion(t);
              const winTeam = win ? teams.get(win.id) : undefined;
              const c = teamColors(winTeam);
              const total = maxRound(gamesOf(t));
              const n = participants(t, gamesOf(t));
              const meta = win?.final
                ? `Финал: ${win.final.homeTeamName} — ${win.final.awayTeamName} ${win.final.homeScore}:${win.final.awayScore}`
                : [total ? `${total} ${plural(total, ["тур", "тура", "туров"], DEFAULT_LOCALE)}` : "", n ? count(n, FORMS.team, DEFAULT_LOCALE) : ""]
                    .filter(Boolean)
                    .join(" · ") || formatDateRange(t.startDate, t.endDate, DEFAULT_LOCALE, true);
              return (
                <Link key={t.id} className="k-card k-tcard k-tcard--done" href={paths.tournament(t.slug)}>
                  <span className="k-tcard__top">
                    <span className="k-eyebrow">
                      {tournamentKind(t)} · {divisionLower(t.division)}
                      {regionTail(t)}
                    </span>
                  </span>
                  <span className="k-tcard__title">{t.name}</span>
                  {meta ? <span className="k-meta">{meta}</span> : null}
                  {win ? (
                    <span className="k-champ" style={teamVars(winTeam)}>
                      <Shirt kit={c.dark} label={firstLetter(win.name)} trim={c.light.fill} />
                      <span>
                        <span className="k-eyebrow">{t.type === "league" ? "Чемпион" : "Победитель"}</span>
                        <b>{win.name}</b>
                      </span>
                      <span className="k-arrow" aria-hidden style={{ marginLeft: "auto" }}>
                        →
                      </span>
                    </span>
                  ) : (
                    <span className="k-champ">
                      <span className="k-meta">Победитель не указан</span>
                      <span className="k-arrow" aria-hidden style={{ marginLeft: "auto" }}>
                        →
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function TournamentsPage(props: PageProps) {
  return (
    <PageShell>
      <TournamentsPageContent {...props} />
    </PageShell>
  );
}
