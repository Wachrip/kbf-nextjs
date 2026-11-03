import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatBox, Stats } from "@/components/ui/Cards";
import { FibaStub } from "@/components/ui/Fiba";
import { GameCard } from "@/components/ui/GameCard";
import { CourtArt } from "@/components/ui/Icons";
import { Shirt } from "@/components/ui/Shirt";
import { BackBlock, BackLink, Empty, LabelHead, Rule, Section, SecHead } from "@/components/ui/Heads";
import { StandingsTable } from "@/components/ui/Standings";
import { getGames, getNow, getTeams, getTournaments, getTournamentsStrict } from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { firstLetter, formatDateRange, formatTime } from "@/lib/format";
import { DEFAULT_LOCALE, pickTr } from "@/lib/i18n";
import { divisionLabel, divisionLower, tournamentKind, tournamentScope, tournamentStatusLabel } from "@/lib/labels";
import { seasonLabel } from "@/lib/season";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { groupByRound, hasScore, indexById, isPlayed, lastPlayedRound, maxRound, played, upcoming, type RoundGroup } from "@/lib/sport";
import { teamColors } from "@/lib/teamPalette";
import type { Game, Tournament } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

type Params = { slug: string };

export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const list = await getTournaments();
  return nonEmpty(
    list.map((t) => ({ slug: t.slug })),
    { slug: PLACEHOLDER },
  );
}

async function findTournament(params: PageProps<Params>["params"]): Promise<Tournament | null> {
  const { slug } = await params;
  // strict: ошибка базы — error.tsx, а не 404
  const list = await getTournamentsStrict();
  return list.find((t) => t.slug === safeDecode(slug)) ?? null;
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const t = await findTournament(params);
  if (!t) return notFoundMeta;
  return pageMetadata({
    path: paths.tournament(t.slug),
    title: pickTr(t, "name", DEFAULT_LOCALE),
    description: `${pickTr(t, "name", DEFAULT_LOCALE)} — ${tournamentKind(t).toLowerCase()} КБФ, ${divisionLower(t.division)}, ${tournamentScope(t).toLowerCase()}, сезон ${seasonLabel(t.season)}: турнирная таблица, ближайшие матчи и результаты.`,
  });
}

/** Турнир: шапка с бейджами и плитками, таблица слева, ближайшие матчи и результаты справа. */
async function TournamentPageContent({ params }: PageProps<Params>) {
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getNow(), getGames(), getTeams()]);
  const t = await findTournament(params);
  if (!t) notFound();
  const [now, games, teamsList] = await rest;
  const teams = indexById(teamsList);
  const list = games.filter((g) => g.tournamentId === t.id);
  const total = maxRound(list);
  const done = lastPlayedRound(list);
  const next = upcoming(list, now).slice(0, 3);
  const results = played(list);
  const lastRound = results[0]?.round;
  const lastResults = lastRound ? results.filter((g) => g.round === lastRound) : results.slice(0, 3);
  const teamCount = t.standings.length || new Set(list.flatMap((g) => [g.homeTeamId, g.awayTeamId])).size;
  const playedCount = list.filter(isPlayed).length;
  const name = pickTr(t, "name", DEFAULT_LOCALE);
  // Кубок/плей-офф без таблицы: матчи по стадиям (stage), таблица и «Тур» скрыты
  const showTable = t.type === "league" || t.standings.length > 0;
  // С таблицей — отдельно только матчи без тура (плей-офф лиги); без таблицы — все матчи
  const stages = groupByRound(showTable ? list.filter((g) => !g.round) : list, now);

  const progress = total ? Math.round((done / total) * 100) : 0;
  // Участники: из таблицы, иначе из матчей
  const participantIds = t.standings.length
    ? t.standings.map((r) => r.teamId)
    : [...new Set(list.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  const participants = participantIds.map((id) => teams.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  // Туры: несыгранные выше, сыгранные — свежие первыми; первые два — открыто, остальные — под «Показать»
  const rounds = groupByRound(showTable ? list.filter((g) => g.round) : [], now);
  const [r1, r2, ...older] = rounds;
  const live = list.filter((g) => g.status === "live");
  const side = [...live, ...next.filter((g) => g.status !== "live")].slice(0, 3);
  const tabs = [
    showTable ? { href: "#table", label: "Таблица" } : null,
    rounds.length ? { href: "#rounds", label: "Туры" } : null,
    stages.length ? { href: "#stages", label: showTable ? "Плей-офф" : "Матчи" } : null,
    { href: "#leaders", label: "Лидеры" },
  ].filter((x): x is { href: string; label: string } => Boolean(x));
  const card = (g: Game, vt = true) => (
    <GameCard
      key={g.id}
      game={g}
      teams={teams}
      tournament={t}
      vt={vt}
      dark={g.status === "live"}
      head={
        g.status === "live" ? (
          <span className="k-live">Идёт</span>
        ) : hasScore(g) ? (
          <>
            <span className="k-eyebrow"><DayText at={g.scheduledAt} now={now} /></span>
            <span className="k-eyebrow">Финал</span>
          </>
        ) : (
          <>
            <span className="k-eyebrow"><DayText at={g.scheduledAt} now={now} /></span>
            {g.status === "cancelled" ? <span className="k-eyebrow">Отменён</span> : <span className="k-gc__time">{formatTime(g.scheduledAt, DEFAULT_LOCALE)}</span>}
          </>
        )
      }
      footLeft={g.gymName}
      footRight={g.statsPdfUrl ? "Протокол →" : undefined}
    />
  );
  const roundBlock = (g: RoundGroup, vt: boolean) => (
    <div key={g.key} style={{ paddingTop: 16 }}>
      <Rule label={`${g.label} · ${g.done ? "сыгран" : "впереди"}`} accent={!g.done} />
      <div className="k-games">{g.games.map((x) => card(x, vt))}</div>
    </div>
  );

  return (
    <>
      {/* JSON-LD SportsEvent не выводится: у турнира нет location (обязательное поле Event) */}
      <section className="k-tourhero k-on-dark">
        <CourtArt className="k-tourhero__art" />
        <div className="k-wrap">
          <BackLink href={paths.tournaments()} label="Все турниры" />
          <div className="k-tourhero__grid">
            <div className="k-tourhero__id">
              <div className="k-tourhero__badges">
                <span className="k-badge">{tournamentKind(t)}</span>
                <span className="k-eyebrow">
                  {divisionLabel(t.division)} · сезон {seasonLabel(t.season)} · {tournamentScope(t)}
                </span>
              </div>
              <h1 className="k-d-xl">{name}</h1>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span className={t.status === "finished" ? "k-status k-status--muted" : "k-status"}>
                  {tournamentStatusLabel(t.status)}
                  {t.status === "ongoing" && done ? ` · тур ${done}` : ""}
                </span>
                {t.startDate || t.endDate ? (
                  <span className="k-meta">{formatDateRange(t.startDate, t.endDate, DEFAULT_LOCALE, true)}</span>
                ) : null}
              </div>
              {total ? (
                <div className="k-tourhero__prog">
                  <div
                    className="k-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={done}
                    aria-label={`Тур ${done} из ${total}`}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div>
                    <span>{done === total ? "Регулярный этап сыгран" : "Регулярный этап"}</span>
                    <span>
                      {done} из {total} туров
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <Stats fixed n={3}>
              <StatBox label="Команд" value={teamCount || "—"} dark />
              <StatBox label="Матчей" value={playedCount} unit="сыграно" dark />
              {total ? <StatBox label="Туров" value={total} dark /> : <StatBox label="Стадий" value={stages.length || "—"} dark />}
            </Stats>
          </div>
        </div>
        {participants.length ? (
          <nav className="k-teamsstrip" aria-label="Участники">
            <div className="k-teamsstrip__in">
              {participants.map((x) => {
                const c = teamColors(x);
                return (
                  <Link key={x.id} href={paths.team(x.division, x.slug)}>
                    <Shirt kit={c.dark} label={firstLetter(x.name)} trim={c.light.fill} on="dark" />
                    {x.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </section>

      {tabs.length > 1 ? (
        <section className="k-section" style={{ paddingBottom: 0 }}>
          <div className="k-wrap">
            <nav className="k-tabs" aria-label="Разделы турнира">
              {tabs.map((x) => (
                <a key={x.href} href={x.href}>
                  {x.label}
                </a>
              ))}
            </nav>
          </div>
        </section>
      ) : null}

      <Section>
        <div className="k-split k-split--t380">
          <div className="k-stack" style={{ gap: 24 }}>
            {showTable ? (
              <div id="table">
                <SecHead title="Таблица" />
                {done ? (
                  <p className="k-meta" style={{ margin: "-4px 0 12px" }}>
                    после {done} тура
                  </p>
                ) : null}
                <StandingsTable tournament={t} teams={teams} games={list} />
              </div>
            ) : stages.length === 0 ? (
              <Empty>Матчей пока нет</Empty>
            ) : null}
          </div>
          <aside className="k-stack" style={{ gap: 22 }}>
            <div>
              <LabelHead title={live.length ? "Сейчас" : "Ближайшие матчи"} link={{ href: paths.games(t.division), label: "Календарь →" }} />
              {side.length ? (
                <div className="k-stack" style={{ gap: "var(--space-2)" }}>
                  {/* vt=false: эти матчи есть и в турах ниже — имя view-transition должно быть одно */}
                  {side.map((g) => card(g, false))}
                </div>
              ) : (
                <Empty>{t.status === "finished" ? "Турнир завершён" : "Матчей пока нет"}</Empty>
              )}
            </div>
            {lastResults.length ? (
              <div>
                <LabelHead title={lastRound ? `Результаты ${lastRound} тура` : "Последние результаты"} />
                <div className="k-card k-resultlist" style={{ overflow: "hidden" }}>
                  {lastResults.map((g) => (
                    <Link key={g.id} href={paths.game(g.id)} className="k-row">
                      <span className="k-title" style={{ fontWeight: 600 }}>
                        {g.homeTeamName} — {g.awayTeamName}
                      </span>
                      <span className="k-num" style={{ color: "var(--ink)" }}>
                        {g.homeScore} : {g.awayScore}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>

      {rounds.length ? (
        <Section id="rounds">
          <SecHead title="Туры" />
          {roundBlock(r1!, true)}
          {r2 ? roundBlock(r2, true) : null}
          {older.length ? (
            <details className="k-more">
              <summary>
                <span className="k-btn k-btn--outline k-more__btn">Показать ранние туры · {older.length}</span>
              </summary>
              {older.map((g) => roundBlock(g, true))}
            </details>
          ) : null}
        </Section>
      ) : null}

      {stages.length ? (
        <Section id="stages">
          <SecHead title={showTable ? "Плей-офф" : "Матчи"} />
          {stages.map((g) => (
            <div key={g.key} style={{ paddingTop: 12 }}>
              <Rule label={g.label} accent={!g.done} />
              <div className="k-games k-games--2">{g.games.map((x) => card(x, true))}</div>
            </div>
          ))}
        </Section>
      ) : null}

      <Section id="leaders">
        <SecHead title="Лидеры турнира" />
        <FibaStub title="Лидеры турнира" />
      </Section>
      <BackBlock href={paths.tournaments()} label="Все турниры" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function TournamentPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <TournamentPageContent {...props} />
    </PageShell>
  );
}
