import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { RowCard } from "@/components/ui/Cards";
import { FibaStub } from "@/components/ui/Fiba";
import { GameCard } from "@/components/ui/GameCard";
import { BackBlock, BackLink, Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { CourtArt } from "@/components/ui/Icons";
import { Img } from "@/components/ui/Img";
import { Shirt } from "@/components/ui/Shirt";
import {
  getCurrentSeason,
  getGames,
  getMemberships,
  getNow,
  getPlayer,
  getPlayerMemberships,
  getPlayers,
  getTeams,
  getTournaments,
} from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { ageAt, excerptOf, firstLetter, FORMS, formatTime, initialsOf, nameLastFirst, plural, yearOf } from "@/lib/format";
import { DEFAULT_LOCALE, pickTr } from "@/lib/i18n";
import { divisionLabel, positionCode, positionLabel, tournamentKind } from "@/lib/labels";
import { activeMemberships, careerOf, isActiveMembership, mainMembership, numberLabel, periodLabel, rosterOf } from "@/lib/membership";
import { seasonLabel } from "@/lib/season";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { standingOf, teamTournament, upcoming, withResults } from "@/lib/sport";
import { teamColors, teamVars } from "@/lib/teamPalette";
import type { Membership, Player, Team } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

type Params = { slug: string };

export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const players = await getPlayers();
  return nonEmpty(
    players.map((p) => ({ slug: p.slug })),
    { slug: PLACEHOLDER },
  );
}

function describe(p: Player, team?: Team): string {
  const parts = [
    p.positions.map(positionLabel).join(", "),
    team ? `«${team.name}»` : "",
    p.height ? `рост ${p.height} см` : "",
  ].filter(Boolean);
  const bio = pickTr(p, "bio", DEFAULT_LOCALE);
  return bio ? excerptOf(bio) : `${nameLastFirst(p)} — игрок ${parts.join(", ")}.`;
}

/**
 * Команды игрока: активные записи текущего сезона (взрослая первой) с номерами; пока записей
 * нет совсем (старые данные) — по player.teamIds, без номеров.
 */
function currentTeams(
  player: Player,
  list: Membership[],
  current: string,
  teams: Team[],
): { team: Team; membership?: Membership }[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  if (list.length === 0) {
    return player.teamIds.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t)).map((team) => ({ team }));
  }
  return activeMemberships(list, current)
    .map((m) => ({ team: byId.get(m.teamId), membership: m }))
    .filter((x): x is { team: Team; membership: Membership } => Boolean(x.team));
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const [player, teams, current] = await Promise.all([getPlayer(safeDecode(slug)), getTeams(), getCurrentSeason()]);
  if (!player) return notFoundMeta;
  const memberships = await getPlayerMemberships(player.id);
  const team = currentTeams(player, memberships, current, teams)[0]?.team;
  return pageMetadata({
    path: paths.player(player.slug),
    title: nameLastFirst(player),
    description: describe(player, team),
    images: [player.photoUrl],
  });
}

/** Карточка игрока: портрет, бейджи амплуа и статуса, 4 плитки, амплуа, команды, биография. */
async function PlayerPageContent({ params }: PageProps<Params>) {
  const { slug } = await params;
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getNow(), getTeams(), getGames(), getTournaments(), getCurrentSeason(), getPlayers()]);
  const player = await getPlayer(safeDecode(slug));
  if (!player) notFound();
  // Карьера зависит от id игрока — единственное неизбежное звено цепочки
  const [[now, teams, games, tournaments, current, allPlayers], memberships] = await Promise.all([
    rest,
    getPlayerMemberships(player.id),
  ]);

  const playerTeams = currentTeams(player, memberships, current, teams);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  // Номер в шапке — из активной записи взрослой команды, иначе из первой активной; только
  // среди записей существующих команд, чтобы номер и команда в подписи не разошлись
  const mainM = mainMembership(memberships.filter((m) => teamById.has(m.teamId)), current);
  const main = mainM ? teamById.get(mainM.teamId) : playerTeams[0]?.team;
  const number = mainM?.number;
  const mainT = main ? teamTournament(tournaments, main, games) : null;
  const teamIds = new Set(playerTeams.map((x) => x.team.id));
  const career = careerOf(memberships);
  const bio = pickTr(player, "bio", DEFAULT_LOCALE);
  const nextGame = upcoming(
    games.filter((g) => teamIds.has(g.homeTeamId) || teamIds.has(g.awayTeamId)),
    now,
  )[0];

  const name = nameLastFirst(player);
  const age = ageAt(player.birthDate, now);
  const by = yearOf(player.birthDate);

  // Партнёры по команде: активные записи главной команды в текущем сезоне (без самого игрока)
  const teamMs = main ? await getMemberships({ teamId: main.id }) : [];
  const slugById = new Map(allPlayers.map((p) => [p.id, p.slug]));
  const mates = main ? rosterOf(teamMs, main.id, current).roster.filter((m) => m.playerId !== player.id).slice(0, 8) : [];
  const colors = teamColors(main);
  // До первых результатов места нет
  const row = main ? withResults(standingOf(mainT, main.id)) : null;
  const positions = player.positions.map(positionCode).join("/");
  const label = number ?? initialsOf(name);

  return (
    <>
      {/* Шапка игрока в цвете главной команды (k-playerhero); без команды — navy */}
      <section className="k-teamhero k-playerhero" style={teamVars(main)}>
        <CourtArt className="k-teamhero__art" />
        <div className="k-wrap">
          <div className="k-teamhero__top">
            <BackLink href={paths.players(main?.division)} label="Все игроки" />
          </div>
          <div className="k-teamhero__grid">
            <div className="k-pportrait">
              {player.photoUrl ? (
                <Img src={player.photoUrl} alt={name} sizes="(min-width: 1024px) 380px, 100vw" priority />
              ) : (
                <>
                  {number != null ? (
                    <span className="k-bignum" aria-hidden>
                      {number}
                    </span>
                  ) : null}
                  <Shirt kit={colors.dark} label={label} trim={colors.light.fill} on="dark" />
                </>
              )}
              {main ? (
                <span className="k-pportrait__tag">
                  <span className="k-dot" aria-hidden />
                  {main.name}
                  {number != null ? ` · #${number}` : ""}
                </span>
              ) : null}
            </div>
            <div>
              <div className="k-playerhero__badges">
                {positions ? <span className="k-badge k-badge--team">{positions}</span> : null}
                {player.positions[0] ? <span className="k-badge k-badge--team-ghost">{positionLabel(player.positions[0])}</span> : null}
                {/* «В заявке» — только при активной записи состава текущего сезона */}
                {!player.isActive ? (
                  <span className="k-badge k-badge--team-ghost">Не выступает</span>
                ) : mainM != null ? (
                  <span className="k-badge k-badge--team-ghost">В заявке {seasonLabel(current)}</span>
                ) : null}
              </div>
              <h1 className="k-teamhero__name k-playerhero__name">
                {player.lastName}
                <br />
                {player.firstName}
              </h1>
              {main ? (
                <span className="k-teamhero__meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <Link className="k-teamlink" href={paths.team(main.division, main.slug)}>
                    <span className="k-dot" aria-hidden />
                    {main.name}
                  </Link>
                  {[mainT ? `${tournamentKind(mainT)} КБФ` : divisionLabel(main.division), row ? `${row.place} место` : ""].filter(Boolean).join(" · ")}
                </span>
              ) : (
                <span className="k-teamhero__meta">Пока не в команде</span>
              )}
              <div className="k-tstats" style={{ "--n": 4 } as CSSProperties}>
                <div className="k-tstat">
                  <span>Рост</span>
                  <b>{player.height ?? "—"}{player.height ? <small>см</small> : null}</b>
                </div>
                <div className="k-tstat">
                  <span>Вес</span>
                  <b>{player.weight ?? "—"}{player.weight ? <small>кг</small> : null}</b>
                </div>
                {/* Только год рождения — день и месяц не выводим (несовершеннолетние) */}
                <div className="k-tstat">
                  <span>Год рожд.</span>
                  <b>{by ?? "—"}</b>
                </div>
                <div className="k-tstat">
                  <span>{age != null ? "Возраст" : "Амплуа"}</span>
                  <b>
                    {age != null ? age : positions || "—"}
                    {age != null ? <small>{plural(age, FORMS.year, DEFAULT_LOCALE)}</small> : null}
                  </b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="k-split">
          <div className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <SecHead title="Статистика сезона" />
              <FibaStub title="Статистика сезона" />
            </div>
            {bio ? (
              <div>
                <SecHead title="Об игроке" />
                <div className="k-card k-card--pad">
                  <p className="k-body-lg">{bio}</p>
                </div>
              </div>
            ) : null}
            <div>
              <SecHead title="Карьера" />
              {career.length ? (
                <div className="k-card">
                  <ol className="k-career">
                    {career.map((m) => {
                      const t = teamById.get(m.teamId);
                      const tc = teamColors(t);
                      const active = isActiveMembership(m, current);
                      const body = (
                        <>
                          <Shirt kit={tc.dark} label={m.number ?? firstLetter(t?.name ?? m.teamName)} trim={tc.light.fill} />
                          <span className="k-career__body">
                            <b>{t?.name ?? m.teamName}</b>
                            <span className="k-meta">
                              {[divisionLabel(m.division), m.number != null ? numberLabel(m.number) : "", periodLabel(m, current, DEFAULT_LOCALE)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          {t ? (
                            <span className="k-arrow" aria-hidden style={{ marginLeft: "auto" }}>
                              →
                            </span>
                          ) : null}
                        </>
                      );
                      return (
                        <li key={m.id} className={active ? "is-now" : undefined} style={teamVars(t)}>
                          <span className="k-career__years">{seasonLabel(m.season)}</span>
                          <span className="k-career__line" aria-hidden />
                          {t ? (
                            <Link className="k-career__item" href={paths.team(t.division, t.slug, m.season === current ? undefined : m.season)}>
                              {body}
                            </Link>
                          ) : (
                            <span className="k-career__item">{body}</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <Empty>Записей о командах пока нет</Empty>
              )}
            </div>
          </div>
          <aside className="k-stack" style={{ gap: "var(--space-6)" }}>
            {nextGame ? (
              <div>
                <LabelHead title="Ближайший матч команды" />
                <GameCard
                  game={nextGame}
                  teams={teamById}
                  tournament={mainT}
                  dark
                  head={
                    nextGame.status === "live" ? (
                      <>
                        <span className="k-eyebrow">Сейчас</span>
                        <span className="k-live">Идёт</span>
                      </>
                    ) : (
                      <>
                        <span className="k-eyebrow"><DayText at={nextGame.scheduledAt} now={now} /></span>
                        <span className="k-gc__time">{formatTime(nextGame.scheduledAt, DEFAULT_LOCALE)}</span>
                      </>
                    )
                  }
                  footLeft={nextGame.gymName}
                  footRight="О матче →"
                />
              </div>
            ) : null}
            <div>
              <LabelHead title="Команды" />
              {playerTeams.length ? (
                <div className="k-list">
                  {playerTeams.map(({ team: t, membership: m }) => {
                    const tt = teamTournament(tournaments, t, games);
                    const r = withResults(standingOf(tt, t.id));
                    return (
                      <RowCard
                        key={m?.id ?? t.id}
                        href={paths.team(t.division, t.slug)}
                        media={
                          <span className="k-crest" style={{ ...teamVars(t), width: 44, height: 44, fontSize: 22, boxShadow: "none" }} aria-hidden>
                            {firstLetter(t.name)}
                          </span>
                        }
                        teamColor={teamColors(t).color}
                        title={t.name}
                        meta={[divisionLabel(t.division), numberLabel(m?.number), r ? `${r.place} место` : ""].filter(Boolean).join(" · ")}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty>Пока не в команде</Empty>
              )}
            </div>
            {main && mates.length ? (
              <div style={teamVars(main)}>
                <LabelHead title="Партнёры по команде" link={{ href: paths.team(main.division, main.slug), label: "Весь состав →" }} />
                <div className="k-mates">
                  {mates.map((m) => {
                    const slug2 = slugById.get(m.playerId);
                    const short = lastFirst(m.playerName).split(" ")[0] ?? m.playerName;
                    const inner = (
                      <>
                        <Shirt kit={colors.dark} label={m.number ?? initialsOf(m.playerName)} trim={colors.light.fill} />
                        <b>{short}</b>
                      </>
                    );
                    return slug2 ? (
                      <Link key={m.id} className="k-card k-mate" href={paths.player(slug2)}>
                        {inner}
                      </Link>
                    ) : (
                      <span key={m.id} className="k-card k-mate">
                        {inner}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.players(main?.division)} label="Все игроки" />
    </>
  );
}

/** «Имя Фамилия» → «Фамилия Имя». */
function lastFirst(playerName: string): string {
  const [first, ...rest] = playerName.trim().split(/\s+/);
  return rest.length ? `${rest.join(" ")} ${first}` : (first ?? "");
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function PlayerPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <PlayerPageContent {...props} />
    </PageShell>
  );
}
