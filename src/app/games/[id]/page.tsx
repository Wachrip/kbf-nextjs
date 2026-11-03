import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import { DayGuard } from "@/components/islands/DayGuard.client";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { FibaStub } from "@/components/ui/Fiba";
import { GameCard } from "@/components/ui/GameCard";
import { BackBlock, BackLink, Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { Img } from "@/components/ui/Img";
import { Shirt } from "@/components/ui/Shirt";
import { PageShell, Vt, vtName } from "@/components/ui/Vt";
import { JsonLd } from "@/components/seo/JsonLd";
import { getGames, getGyms, getNow, getTeams, getTournaments, getGamesStrict } from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { dayKey, dayLabel, firstLetter, formatDayMonthWeekday, formatLongDate, formatTime } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { divisionLabel, gameStatusLabel, placeLine } from "@/lib/labels";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { absoluteUrl } from "@/lib/site";
import { isStorageUrl } from "@/lib/images";
import { mapSearchUrl } from "@/lib/social";
import { indexById, isOverdue, maxRound, recordOf, teamAbbr, upcoming, winner } from "@/lib/sport";
import { teamColors } from "@/lib/teamPalette";
import type { Game } from "@/lib/types";

type Params = { id: string };

export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const games = await getGames();
  return nonEmpty(
    games.map((g) => ({ id: g.id })),
    { id: PLACEHOLDER },
  );
}

async function findGame(params: PageProps<Params>["params"]): Promise<Game | null> {
  const { id } = await params;
  // strict: ошибка базы — error.tsx, а не 404
  const games = await getGamesStrict();
  return games.find((g) => g.id === safeDecode(id)) ?? null;
}

const pairOf = (g: Game) => `${g.homeTeamName} — ${g.awayTeamName}`;

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const game = await findGame(params);
  if (!game) return notFoundMeta;
  const score = winner(game) ? ` ${game.homeScore}:${game.awayScore}` : "";
  return pageMetadata({
    path: paths.game(game.id),
    title: `${pairOf(game)}${score}`,
    description: `${pairOf(game)}, ${formatLongDate(game.scheduledAt, DEFAULT_LOCALE)}, ${formatTime(game.scheduledAt, DEFAULT_LOCALE)} · ${game.gymName}. ${gameStatusLabel(game.status)}.`,
  });
}

/** Матч: navy-табло со счётом, протокол PDF (встроенный просмотр на десктопе), факты, следующий матч. */
async function GamePageContent({ params }: PageProps<Params>) {
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([
    getNow(),
    getGames(),
    getTeams(),
    getGyms(),
    getTournaments(),
  ]);
  const game = await findGame(params);
  if (!game) notFound();
  const [now, games, teamsList, gyms, tournaments] = await rest;
  const home = teamsList.find((t) => t.id === game.homeTeamId);
  const away = teamsList.find((t) => t.id === game.awayTeamId);
  const gym = gyms.find((g) => g.id === game.gymId);
  const tournament = game.tournamentId ? tournaments.find((t) => t.id === game.tournamentId) : undefined;
  const tGames = tournament ? games.filter((g) => g.tournamentId === tournament.id) : [];
  const roundsTotal = maxRound(tGames);
  const w = winner(game);
  const nextGame = upcoming(
    games.filter((g) => g.id !== game.id && (tournament ? g.tournamentId === tournament.id : g.division === game.division)),
    now,
  )[0];

  const status =
    game.status === "scheduled"
      ? isOverdue(game, now)
        ? "Результат не внесён"
        : "Предстоит"
      : game.status === "live"
        ? "Идёт"
        : game.status === "cancelled"
          ? "Отменён"
          : "Завершён";
  const stage = game.round ? `тур ${game.round}` : game.stage ?? "";
  const statusLine = [status, stage].filter(Boolean).join(" · ");
  const sub = [tournament?.name, divisionLabel(game.division)].filter(Boolean).join(" · ");

  const teamsById = indexById(teamsList);
  const hc = teamColors(home);
  const ac = teamColors(away);
  const scored = (game.status === "finished" || game.status === "live") && game.homeScore != null && game.awayScore != null;
  const record = (id: string) => recordOf(tournament, id);
  const side = (s: "home" | "away") => {
    const t = s === "home" ? home : away;
    const name = s === "home" ? game.homeTeamName : game.awayTeamName;
    const c = s === "home" ? hc : ac;
    const role = [w === s ? "победа" : s === "home" ? "хозяева" : "гости", record(s === "home" ? game.homeTeamId : game.awayTeamId)]
      .filter(Boolean)
      .join(" · ");
    const body = (
      <>
        <span className="k-sb__kit">
          <Shirt
            kit={s === "home" ? c.light : c.dark}
            label={teamAbbr(name)}
            trim={s === "home" ? c.color : c.light.fill}
            on="dark"
          />
        </span>
        <span className="k-sb__name">{name}</span>
        <span className="k-sb__role">{role}</span>
      </>
    );
    return t ? (
      <Link className="k-sb__team" href={paths.team(t.division, t.slug)}>
        {body}
      </Link>
    ) : (
      <div className="k-sb__team">{body}</div>
    );
  };
  const roundGames = tournament
    ? games
        .filter((g) => g.id !== game.id && g.tournamentId === tournament.id && (game.round ? g.round === game.round : g.stage === game.stage))
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
        .slice(0, 4)
    : [];
  const mapUrl = gym?.mapUrl || (gym?.address ? mapSearchUrl(gym.address, gym.city, gym.region) : undefined);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: pairOf(game),
          sport: "Basketball",
          startDate: game.scheduledAt,
          ...(game.status === "cancelled"
            ? { eventStatus: "https://schema.org/EventCancelled" }
            : game.status === "scheduled"
              ? { eventStatus: "https://schema.org/EventScheduled" }
              : {}),
          url: absoluteUrl(paths.game(game.id)),
          homeTeam: { "@type": "SportsTeam", name: game.homeTeamName },
          awayTeam: { "@type": "SportsTeam", name: game.awayTeamName },
          location: {
            "@type": "Place",
            name: game.gymName,
            ...(gym?.address ? { address: [gym.city, gym.address].filter(Boolean).join(", ") } : {}),
          },
          ...(tournament ? { superEvent: { "@type": "SportsEvent", name: tournament.name } } : {}),
        }}
      />
      {/* Табло матча (k-sb): полоса и подсветка цветов двух команд, майки в форме по FIBA */}
      <section className="k-sb" style={{ "--h": hc.color, "--a": ac.color } as CSSProperties}>
        <span className="k-sb__glow" aria-hidden />
        <div className="k-wrap">
          <div className="k-teamhero__top">
            <BackLink href={paths.games(game.division)} label="Календарь" />
            {game.round && roundsTotal ? <span className="k-badge k-badge--ghost">Тур {game.round} из {roundsTotal}</span> : null}
          </div>
          <div className="k-sb__meta">
            <span className="k-eyebrow">{sub || divisionLabel(game.division)}</span>
          </div>
          <h1 className="k-sr">
            {pairOf(game)}
            {scored ? `, ${game.homeScore}:${game.awayScore}` : ""}
          </h1>
          {/* Общий элемент с карточкой матча (View Transitions) */}
          <Vt name={vtName.game(game.id)}>
            <div className="k-sb__grid">
              {side("home")}
              <div className="k-sb__score">
                {game.status === "live" ? <span className="k-live">Идёт</span> : <span className="k-status k-status--muted">{statusLine}</span>}
                {scored ? (
                  <span className="k-score">
                    <span className={w === "home" ? "is-win" : w ? "is-lose" : undefined}>{game.homeScore}</span>
                    <span className="sep">:</span>
                    <span className={w === "away" ? "is-win" : w ? "is-lose" : undefined}>{game.awayScore}</span>
                  </span>
                ) : (
                  <span className="k-score" style={game.status === "cancelled" ? { color: "var(--on-dark-3)" } : undefined}>
                    {game.status === "cancelled" ? "—" : formatTime(game.scheduledAt, DEFAULT_LOCALE)}
                  </span>
                )}
                <span className="k-sb__when">
                  {dayLabel(game.scheduledAt, now, DEFAULT_LOCALE).length < 9 ? (
                    // «Сегодня, 3 ноября 2026»: устаревшее «Сегодня» (кэш прошлого дня) — только дата
                    <DayGuard day={dayKey(now)} fallback={formatLongDate(game.scheduledAt, DEFAULT_LOCALE)}>
                      {`${dayLabel(game.scheduledAt, now, DEFAULT_LOCALE)}, ${formatLongDate(game.scheduledAt, DEFAULT_LOCALE)}`}
                    </DayGuard>
                  ) : (
                    dayLabel(game.scheduledAt, now, DEFAULT_LOCALE)
                  )}
                  {scored || game.status === "cancelled" ? ` · ${formatTime(game.scheduledAt, DEFAULT_LOCALE)}` : ""}
                </span>
              </div>
              {side("away")}
            </div>
          </Vt>
          <div className="k-sb__chips">
            {gym ? (
              <Link className="k-sb__chip" href={paths.gym(gym.slug)}>
                <b>{gym.name}</b>
                {gym.city ? ` · ${gym.city}` : ""}
              </Link>
            ) : game.gymName ? (
              <span className="k-sb__chip">
                <b>{game.gymName}</b>
              </span>
            ) : null}
            {tournament ? (
              <Link className="k-sb__chip" href={paths.tournament(tournament.slug)}>
                <b>{tournament.name}</b>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <Section>
        <div className="k-split">
          <div className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <SecHead title="Онлайн-статистика" />
              <FibaStub title="Онлайн-статистика">
                Статистика матча по игрокам и сравнение команд появятся после подключения FIBA LiveStats
              </FibaStub>
            </div>
            <div>
              <SecHead title="Протокол" />
              {game.statsPdfUrl ? (
                <div className="k-card" style={{ overflow: "hidden" }}>
                  {/* Встраиваем только PDF из бакета проекта; без sandbox — в нём Chrome не
                      показывает PDF (плагины в sandbox-iframe запрещены), см. README */}
                  {isStorageUrl(game.statsPdfUrl) ? (
                    <iframe
                      className="k-pdf k-only-d"
                      src={`${game.statsPdfUrl}#view=FitH`}
                      title={`Протокол матча ${pairOf(game)}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="k-doc">
                    <span className="k-doc__icon" aria-hidden>
                      PDF
                    </span>
                    <span className="k-doc__body">
                      <span className="k-title">Протокол матча</span>
                      <span className="k-meta">Составы, очки, подборы, передачи по игрокам</span>
                    </span>
                    <span className="k-doc__actions">
                      <a className="k-btn k-btn--primary k-btn--sm" href={game.statsPdfUrl} target="_blank" rel="noopener noreferrer">
                        Открыть
                      </a>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="k-card">
                  <Empty>
                    {game.status === "finished"
                      ? "Протокол матча появится позже"
                      : game.status === "cancelled"
                        ? "Матч отменён"
                        : "Протокол появится после матча"}
                  </Empty>
                </div>
              )}
            </div>
          </div>
          <aside className="k-stack" style={{ gap: "var(--space-6)" }}>
            {gym || game.gymName ? (
              <div>
                <LabelHead title="Площадка" />
                <div className="k-card k-venue">
                  <span className="k-media">
                    {gym?.photoUrls[0] ? (
                      <Img src={gym.photoUrls[0]} alt="" sizes="(min-width: 1024px) 400px, 100vw" />
                    ) : (
                      <span className="k-initials" aria-hidden style={{ fontSize: 40 }}>
                        {firstLetter(gym?.name ?? game.gymName)}
                      </span>
                    )}
                  </span>
                  <span className="k-venue__body">
                    {gym ? (
                      <Link className="k-title" href={paths.gym(gym.slug)}>
                        {gym.name}
                      </Link>
                    ) : (
                      <span className="k-title">{game.gymName}</span>
                    )}
                    {gym?.address ? <span className="k-meta">{[placeLine(gym.city, gym.region), gym.address].filter(Boolean).join(", ")}</span> : null}
                    <span className="k-venue__foot">
                      <span className="k-meta">
                        {formatTime(game.scheduledAt, DEFAULT_LOCALE)} · {formatDayMonthWeekday(game.scheduledAt, DEFAULT_LOCALE)}
                      </span>
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
            {roundGames.length ? (
              <div>
                <LabelHead
                  title={game.round ? "Ещё матчи тура" : "Ещё матчи стадии"}
                  link={tournament ? { href: paths.tournament(tournament.slug), label: "Турнир →" } : undefined}
                />
                <div className="k-stack" style={{ gap: "var(--space-2)" }}>
                  {roundGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      teams={teamsById}
                      tournament={tournament}
                      head={
                        <span className="k-eyebrow">
                          <DayText at={g.scheduledAt} now={now} /> · {gameStatusLabel(g.status).toLowerCase()}
                        </span>
                      }
                      footLeft={g.gymName}
                    />
                  ))}
                </div>
              </div>
            ) : nextGame ? (
              <div>
                <LabelHead title="Следующий матч" />
                <GameCard
                  game={nextGame}
                  teams={teamsById}
                  tournament={tournament}
                  head={
                    <>
                      <span className="k-eyebrow"><DayText at={nextGame.scheduledAt} now={now} /></span>
                      <span className="k-gc__time">{formatTime(nextGame.scheduledAt, DEFAULT_LOCALE)}</span>
                    </>
                  }
                  footLeft={nextGame.gymName}
                />
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.games(game.division)} label="Календарь" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function GamePage(props: PageProps<Params>) {
  return (
    <PageShell>
      <GamePageContent {...props} />
    </PageShell>
  );
}
