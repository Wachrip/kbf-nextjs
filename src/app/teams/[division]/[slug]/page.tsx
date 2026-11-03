import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { FibaStub } from "@/components/ui/Fiba";
import { GameCard } from "@/components/ui/GameCard";
import { CourtArt } from "@/components/ui/Icons";
import { Img } from "@/components/ui/Img";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { Shirt } from "@/components/ui/Shirt";
import { ChipLinks } from "@/components/ui/Chips";
import { BackBlock, BackLink, Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { FormDots } from "@/components/ui/Form";
import { PersonPhoto, TeamLogo } from "@/components/ui/Media";
import { PageShell, Vt, vtName } from "@/components/ui/Vt";
import {
  getCoaches,
  getCurrentSeason,
  getGames,
  getGyms,
  getMemberships,
  getNow,
  getPlayers,
  getTeams,
  getTeamsStrict,
  getTournaments,
} from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { count, firstLetter, FORMS, formatTime, initialsOf, nameFirstLast, nameLastFirst, signed, yearOf } from "@/lib/format";
import { DEFAULT_LOCALE, pickTr } from "@/lib/i18n";
import {
  divisionLabel,
  divisionLower,
  isDivision,
  placeLine,
  positionCodes,
  positionLabel,
  tournamentKind,
} from "@/lib/labels";
import { periodLabel, rosterOf, seasonsOf } from "@/lib/membership";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { firstParam, paths, type PageProps, type SearchParams } from "@/lib/routes";
import { bySeasonDesc, isSeason, seasonLabel } from "@/lib/season";
import { safeDecode } from "@/lib/url";
import { mapSearchUrl } from "@/lib/social";
import { indexById, placedStandings, played, standingOf, teamForm, teamTournament, upcoming, withResults } from "@/lib/sport";
import { teamColors, teamVars } from "@/lib/teamPalette";
import type { Game, Membership, Player, RosterItem, Team } from "@/lib/types";

type Params = { division: string; slug: string };

// slug читается до Suspense: несуществующая команда — настоящий 404. Страница пререндерится
// с составом текущего сезона; ?season читается внутри <Suspense> (статическая оболочка и CDN
// сохраняются). Мусорный формат ?season — 308 в proxy.ts; сезон, которого нет у команды, или
// текущий — состав текущего сезона (canonical всегда чистый адрес).
export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const teams = await getTeams();
  return nonEmpty(
    teams.map((t) => ({ division: t.division, slug: t.slug })),
    { division: "adult", slug: PLACEHOLDER },
  );
}

async function findTeam(params: PageProps<Params>["params"]): Promise<{ team: Team | null; division: string }> {
  const { division, slug } = await params;
  // strict: ошибка базы — error.tsx, а не 404
  const teams = await getTeamsStrict();
  const team = teams.find((t) => t.slug === safeDecode(slug)) ?? null;
  return { team, division };
}

/** Сезоны команды: из её записей + текущий (пустой текущий состав — тоже состояние). */
function teamSeasons(memberships: Membership[], current: string): string[] {
  return [...new Set([current, ...seasonsOf(memberships)])].sort(bySeasonDesc);
}

/** ?season, если это архивный сезон команды; иначе undefined (текущий состав). */
function archiveSeason(sp: SearchParams, seasons: string[], current: string): string | undefined {
  const asked = firstParam(sp.season);
  return asked && asked !== current && seasons.includes(asked) ? asked : undefined;
}

// Метаданные статические (без searchParams): canonical любого ?season — чистый адрес команды
export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { team } = await findTeam(params);
  if (!team) return notFoundMeta;
  const place = placeLine(team.city, team.region);
  const desc =
    pickTr(team, "description", DEFAULT_LOCALE) ??
    `${team.name} — команда Кыргызской баскетбольной федерации (${divisionLower(team.division)}${place ? `, ${place}` : ""}): состав, тренер, зал, ближайший матч.`;
  // Архивные сезоны (?season=) — вариант той же страницы: canonical на текущий состав
  return pageMetadata({
    path: paths.team(team.division, team.slug),
    title: `${team.name} · ${divisionLabel(team.division)}`,
    description: desc,
    images: [team.logoUrl],
  });
}

/** playerName записи («Имя Фамилия») → «Фамилия Имя», как в списках; для удалённых игроков. */
function lastFirst(playerName: string): string {
  const [first, ...rest] = playerName.trim().split(/\s+/);
  return rest.length ? `${rest.join(" ")} ${first}` : (first ?? "");
}

function rosterItem(m: Membership, player: Player | undefined): RosterItem {
  return {
    key: m.id,
    slug: player?.slug,
    name: player ? nameLastFirst(player) : lastFirst(m.playerName),
    photoUrl: player?.photoUrl,
    number: m.number,
    codes: player ? positionCodes(player.positions) : "",
    positionsFull: player ? player.positions.map(positionLabel).join(", ") : "",
    height: player?.height,
    birthYear: player ? (yearOf(player.birthDate) ?? undefined) : undefined,
    isActive: player?.isActive ?? false,
  };
}

/** v1: состав по player.teamIds — пока у команды нет ни одной записи memberships (старые данные). */
function legacyRoster(players: Player[], team: Team): RosterItem[] {
  return players
    .filter((p) => p.teamIds.includes(team.id))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || nameLastFirst(a).localeCompare(nameLastFirst(b), "ru"))
    .map((p) => ({
      key: p.slug,
      slug: p.slug,
      name: nameLastFirst(p),
      photoUrl: p.photoUrl,
      codes: positionCodes(p.positions),
      positionsFull: p.positions.map(positionLabel).join(", "),
      height: p.height,
      birthYear: yearOf(p.birthDate) ?? undefined,
      isActive: p.isActive,
    }));
}

interface RosterData {
  team: Team;
  memberships: Membership[];
  players: Player[];
  current: string;
  seasons: string[];
  /** Главный тренер — последней карточкой состава. */
  coach?: { name: string; href: string; photoUrl?: string };
}

/**
 * Состав сезона (концепция А): заголовок с числом, переключатель сезонов (светлые чипы, от
 * двух сезонов), сетка карточек с майками-номерами, тренер последней карточкой, «Покинули
 * команду». season — выбранный сезон.
 */
function Roster({ team, memberships, players, current, seasons, season, coach }: RosterData & { season: string }) {
  const isCurrent = season === current;
  const playerById = new Map(players.map((p) => [p.id, p]));
  const legacy = memberships.length === 0;
  const { roster, left } = rosterOf(memberships, team.id, season);
  const rosterItems = legacy ? legacyRoster(players, team) : roster.map((m) => rosterItem(m, playerById.get(m.playerId)));
  const c = teamColors(team);
  const facts = (it: RosterItem) => [it.height ? `${it.height} см` : "", it.birthYear ? `${it.birthYear} г. р.` : ""].filter(Boolean).join(" · ");
  const rosterTitle = isCurrent ? `Состав · ${rosterItems.length}` : `Состав ${seasonLabel(season)} · ${rosterItems.length}`;
  return (
    // Цвета формы — CSS-переменные на корне блока (фон под майкой, номер)
    <div className="k-stack" style={{ gap: "var(--space-6)", ...teamVars(team) }}>
      <div>
        <SecHead title={rosterTitle} />
        {seasons.length > 1 ? (
          <div style={{ marginBottom: 12 }}>
            <ChipLinks
              light
              label="Состав по сезонам"
              items={seasons.map((s) => ({
                label: seasonLabel(s),
                href: paths.team(team.division, team.slug, s === current ? undefined : s),
                current: s === season,
              }))}
            />
          </div>
        ) : null}
        {rosterItems.length === 0 ? (
          <Empty>Состав пока не заявлен</Empty>
        ) : (
          <div className="k-roster">
            {rosterItems.map((it) => (
              <PlayerCard
                key={it.key}
                href={it.slug ? paths.player(it.slug) : undefined}
                name={it.name}
                number={it.number}
                initials={initialsOf(it.name)}
                kit={c.dark}
                trim={c.light.fill}
                codes={it.codes}
                meta={facts(it)}
              />
            ))}
            {coach ? (
              <Link className="k-card k-roster__coach" href={coach.href}>
                <PersonPhoto name={coach.name} photoUrl={coach.photoUrl} />
                <span className="k-pcard__body">
                  <span className="k-pcard__name">{coach.name}</span>
                  <span className="k-meta">Главный тренер</span>
                </span>
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </Link>
            ) : null}
          </div>
        )}
      </div>
      {left.length ? (
        <div>
          <SecHead title="Покинули команду" />
          <div className="k-roster">
            {left.map((m) => {
              const p = playerById.get(m.playerId);
              const name = p ? nameLastFirst(p) : lastFirst(m.playerName);
              return (
                <PlayerCard
                  key={m.id}
                  gone
                  href={p ? paths.player(p.slug) : undefined}
                  name={name}
                  number={m.number}
                  initials={initialsOf(name)}
                  kit={c.dark}
                  trim={c.light.fill}
                  codes={p ? positionCodes(p.positions) : undefined}
                  meta={periodLabel(m, current, DEFAULT_LOCALE)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Лёгкая оболочка состава (fallback Suspense): заголовок с числом и серые строки — без
 * полного списка и без островка (раньше fallback дублировал весь состав в HTML и пропсах).
 */
function RosterSkeleton({ count }: { count: number }) {
  return (
    <div className="k-stack" style={{ gap: 12 }} aria-busy="true">
      <SecHead title={`Состав · ${count}`} />
      {Array.from({ length: Math.min(5, Math.max(count, 1)) }, (_, i) => (
        <span key={i} className="k-skel k-skel--row" />
      ))}
    </div>
  );
}

/** Внутри <Suspense>: ?season → архивный сезон команды или текущий. */
async function SeasonRoster({ searchParams, ...data }: RosterData & { searchParams: Promise<SearchParams> }) {
  const season = archiveSeason(await searchParams, data.seasons, data.current) ?? data.current;
  return <Roster {...data} season={season} />;
}

/**
 * Команда: шапка с плитками, состав сезона (номера; переключатель сезона ?season=; ушедшие в
 * течение сезона — «Покинули команду»), справа «О команде», тренер, зал, матч, турнир.
 */
async function TeamPageContent({ params, searchParams }: PageProps<Params>) {
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getCurrentSeason(), getNow(), getPlayers(), getCoaches(), getGyms(), getGames(), getTournaments(), getTeams()]);
  const { team, division } = await findTeam(params);
  if (!team) notFound();
  // Дивизион в адресе не совпал (команду перевели) — постоянный редирект на верный адрес с тем
  // же ?season. Такие адреса не пререндерятся (их нет в generateStaticParams), поэтому
  // searchParams здесь читаются только на запросе и статической оболочке не мешают.
  if (!isDivision(division) || division !== team.division) {
    const season = firstParam((await searchParams).season);
    permanentRedirect(paths.team(team.division, team.slug, isSeason(season) ? season : undefined));
  }

  const [[current, now, players, coaches, gyms, games, tournaments, allTeams], memberships] = await Promise.all([
    rest,
    getMemberships({ teamId: team.id }),
  ]);
  const seasons = teamSeasons(memberships, current);
  const tournament = teamTournament(tournaments, team, games);
  // До первых результатов место, В–П и разница — «—»
  const row = withResults(standingOf(tournament, team.id));
  const coach = team.coachId ? coaches.find((c) => c.id === team.coachId) : undefined;
  const gym = team.gymId ? gyms.find((g) => g.id === team.gymId) : undefined;
  const nextGame = upcoming(
    games.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id),
    now,
  )[0];
  // Плитка «Игроков» в шапке — всегда текущий состав
  const currentCount =
    memberships.length === 0 ? legacyRoster(players, team).length : rosterOf(memberships, team.id, current).roster.length;
  const rosterData: RosterData = { team, memberships, players, current, seasons };

  const coachName = coach ? nameFirstLast(coach) : team.coachName;
  const sub = [
    placeLine(team.city, team.region),
    team.foundedYear ? `основан в ${team.foundedYear}` : "",
    coachName ? `тренер ${coachName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const eyebrow = [divisionLabel(team.division), tournament ? `${tournamentKind(tournament)} КБФ` : ""]
    .filter(Boolean)
    .join(" · ");
  const description = pickTr(team, "description", DEFAULT_LOCALE);
  const form = tournament ? teamForm(games, tournament.id, team.id) : [];

  const colors = teamColors(team);
  const teamGames = games.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
  const lastGame = played(teamGames)[0];
  const teamsById = indexById(allTeams);
  const resultOf = (g: Game) => {
    const home = g.homeTeamId === team.id;
    const mine = home ? g.homeScore! : g.awayScore!;
    const theirs = home ? g.awayScore! : g.homeScore!;
    return { home, mine, theirs, win: mine > theirs, /** Равный счёт — ошибка ввода (ничьих нет): без победы и поражения */ even: mine === theirs, opp: home ? g.awayTeamName : g.homeTeamName };
  };
  const recent = played(teamGames).slice(0, 5);
  // Мини-таблица: 4 строки вокруг места команды
  const placed = placedStandings(tournament);
  const at = placed.findIndex((r) => r.teamId === team.id);
  const from = at < 0 ? 0 : Math.max(0, Math.min(at - 1, placed.length - 4));
  const miniRows = placed.slice(from, from + 4);
  const stage = (g: Game) => (g.round ? `тур ${g.round}` : (g.stage ?? ""));
  const coachCard = coachName ? { name: coachName, href: coach ? paths.coach(coach.slug) : paths.coaches(), photoUrl: coach?.photoUrl } : undefined;
  const rosterProps: RosterData = { ...rosterData, coach: coachCard };
  const mapUrl = gym?.mapUrl || (gym?.address ? mapSearchUrl(gym.address, gym.city, gym.region) : undefined);

  return (
    <>
      {/* Шапка в цвете команды (k-teamhero): градиент от цвета команды, полоса светлой формы снизу */}
      <section className="k-teamhero" style={teamVars(team)}>
        <CourtArt className="k-teamhero__art" />
        <div className="k-wrap">
          <div className="k-teamhero__top">
            <BackLink href={paths.division(team.division)} label={`Все команды · ${divisionLower(team.division)}`} />
          </div>
          <div className="k-teamhero__grid">
            <div>
              <div className="k-teamhero__main">
                <Vt name={vtName.team(team.id)}>
                  {team.logoUrl ? (
                    <TeamLogo name={team.name} logoUrl={team.logoUrl} size={96} className="k-crest" />
                  ) : (
                    <span className="k-crest" aria-hidden>
                      {firstLetter(team.name)}
                    </span>
                  )}
                </Vt>
                <div className="k-teamhero__id">
                  <span className="k-teamhero__eyebrow">{eyebrow}</span>
                  <h1 className="k-teamhero__name">{team.name}</h1>
                  {sub ? <span className="k-teamhero__meta">{sub}</span> : null}
                </div>
              </div>
              {/* Мобилка — 3 колонки (форма — отдельной строкой, разница скрыта); десктоп — по числу плиток */}
              <div className="k-tstats" style={{ "--n": 3, "--nd": 3 + (row ? 1 : 0) + (form.length ? 1 : 0) } as CSSProperties}>
                <div className="k-tstat">
                  <span>Место</span>
                  <b>
                    {row ? row.place : "—"}
                    {row ? <small>из {placed.length}</small> : null}
                  </b>
                </div>
                <div className="k-tstat">
                  <span>В — П</span>
                  <b>{row ? `${row.won}–${row.lost}` : "—"}</b>
                </div>
                <div className="k-tstat">
                  <span>Игроков</span>
                  <b>{currentCount}</b>
                </div>
                {row ? (
                  <div className="k-tstat k-only-d k-flexd">
                    <span>Разница</span>
                    <b>{signed(row.diff)}</b>
                  </div>
                ) : null}
                {form.length ? (
                  <div className="k-tstat k-tstat--form">
                    <span>Форма</span>
                    <FormDots results={form} dark />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="k-teamhero__kits k-only-d k-flexd" aria-label="Форма команды" role="group">
              <figure>
                <Shirt kit={colors.light} label={firstLetter(team.name)} trim={colors.color} on="dark" />
                <figcaption>Дома</figcaption>
              </figure>
              <figure>
                <Shirt kit={colors.dark} label={firstLetter(team.name)} trim={colors.light.fill} on="dark" />
                <figcaption>В гостях</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <SecHead title="Матчи" link={{ href: paths.games(team.division), label: "Календарь →" }} />
        {lastGame || nextGame ? (
          <div className="k-duo">
            {lastGame ? (
              <GameCard
                game={lastGame}
                teams={teamsById}
                tournament={tournament}
                head={
                  <>
                    <span className="k-eyebrow">Последний матч{stage(lastGame) ? ` · ${stage(lastGame)}` : ""}</span>
                    {resultOf(lastGame).even ? null : <span className="k-badge k-badge--navy">{resultOf(lastGame).win ? "Победа" : "Поражение"}</span>}
                  </>
                }
                footLeft={<><DayText at={lastGame.scheduledAt} now={now} /> · {lastGame.gymName}</>}
                footRight="Матч →"
              />
            ) : null}
            {nextGame ? (
              <GameCard
                game={nextGame}
                teams={teamsById}
                tournament={tournament}
                dark={nextGame.status === "live"}
                head={
                  nextGame.status === "live" ? (
                    <>
                      <span className="k-eyebrow">Сейчас{stage(nextGame) ? ` · ${stage(nextGame)}` : ""}</span>
                      <span className="k-live">Идёт</span>
                    </>
                  ) : (
                    <>
                      <span className="k-eyebrow">Ближайший{stage(nextGame) ? ` · ${stage(nextGame)}` : ""}</span>
                      <span className="k-gc__time">{formatTime(nextGame.scheduledAt, DEFAULT_LOCALE)}</span>
                    </>
                  )
                }
                footLeft={<><DayText at={nextGame.scheduledAt} now={now} /> · {nextGame.gymName}</>}
                footRight="О матче →"
              />
            ) : null}
          </div>
        ) : (
          <Empty>Матчей пока нет — расписание появится в календаре</Empty>
        )}
      </Section>

      <Section>
        <div className="k-split">
          <div className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <SecHead title="Лидеры команды" />
              <FibaStub title="Лидеры команды" />
            </div>
            {/* Оболочка — заголовок и серые строки; состав сезона (?season) — внутри Suspense */}
            <Suspense fallback={<RosterSkeleton count={currentCount} />}>
              <SeasonRoster {...rosterProps} searchParams={searchParams} />
            </Suspense>
          </div>
          <aside className="k-stack" style={{ gap: "var(--space-6)" }}>
            {tournament && miniRows.length ? (
              <div style={teamVars(team)}>
                <LabelHead title="Место в таблице" link={{ href: paths.tournament(tournament.slug), label: "Таблица →" }} />
                <div className="k-card" style={{ overflow: "hidden" }}>
                  <table className="k-mini-table">
                    <caption className="k-sr">{tournament.name}: место команды</caption>
                    <tbody>
                      {miniRows.map((r) => {
                        const t = teamsById.get(r.teamId);
                        return (
                          <tr key={r.teamId} className={r.teamId === team.id ? "is-me" : undefined} style={{ "--team": teamColors(t).color } as CSSProperties}>
                            <td>{r.place}</td>
                            <td className="is-team">
                              <span className="k-table__team">
                                <span className="k-dot" aria-hidden />
                                <span className="k-table__name">{t?.name ?? "Команда"}</span>
                              </span>
                            </td>
                            <td>
                              {r.won}–{r.lost}
                            </td>
                            <td>{r.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {recent.length ? (
              <div>
                <LabelHead title={`Последние ${count(recent.length, FORMS.game, DEFAULT_LOCALE)}`} />
                <div className="k-card" style={{ overflow: "hidden" }}>
                  {recent.map((g, i) => {
                    const r = resultOf(g);
                    return (
                      <Link
                        key={g.id}
                        className="k-row"
                        href={paths.game(g.id)}
                        style={{ padding: "10px 14px", ...(i ? { borderTop: "1px solid var(--line-faint)" } : {}) }}
                      >
                        <span className={r.even ? "k-wl" : r.win ? "k-wl is-w" : "k-wl is-l"} aria-hidden>
                          {r.even ? "" : r.win ? "В" : "П"}
                        </span>
                        <span className="k-row__body">
                          <span className="k-title" style={{ fontSize: 14 }}>
                            {r.even ? null : <span className="k-sr">{r.win ? "Победа" : "Поражение"}: </span>}
                            {r.home ? "" : "@ "}
                            {r.opp}
                          </span>
                          <span className="k-meta">{[stage(g), r.home ? "дома" : "в гостях"].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="k-num" style={{ marginLeft: "auto", color: "var(--ink)" }}>
                          {r.mine}:{r.theirs}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {description ? (
              <div>
                <LabelHead title="О команде" />
                <div className="k-card k-card--pad">
                  <p className="k-body">{description}</p>
                </div>
              </div>
            ) : null}
            {gym || team.gymName ? (
              <div>
                <LabelHead title="Домашний зал" />
                <div className="k-card k-venue">
                  <span className="k-media">
                    {gym?.photoUrls[0] ? (
                      <Img src={gym.photoUrls[0]} alt="" sizes="(min-width: 1024px) 400px, 100vw" />
                    ) : (
                      <span className="k-initials" aria-hidden style={{ fontSize: 40 }}>
                        {firstLetter(gym?.name ?? team.gymName ?? "")}
                      </span>
                    )}
                  </span>
                  <span className="k-venue__body">
                    {gym ? (
                      <Link className="k-title" href={paths.gym(gym.slug)}>
                        {gym.name}
                      </Link>
                    ) : (
                      <span className="k-title">{team.gymName}</span>
                    )}
                    {gym?.address ? <span className="k-meta">{[placeLine(gym.city, gym.region), gym.address].filter(Boolean).join(", ")}</span> : null}
                    <span className="k-venue__foot">
                      <span className="k-meta">{gym?.capacity ? count(gym.capacity, FORMS.place, DEFAULT_LOCALE) : "Площадка"}</span>
                      {mapUrl ? (
                        <a className="k-link" href={mapUrl} target="_blank" rel="noopener noreferrer">
                          2ГИС →
                        </a>
                      ) : null}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.division(team.division)} label={`Все команды · ${divisionLower(team.division)}`} />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function TeamPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <TeamPageContent {...props} />
    </PageShell>
  );
}
