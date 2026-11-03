import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import { DayGuard } from "@/components/islands/DayGuard.client";
import Link from "next/link";
import { Suspense } from "react";
import { ChipLinks } from "@/components/ui/Chips";
import { GameCard } from "@/components/ui/GameCard";
import { Empty, ListHero, Rule, Section, type Fact } from "@/components/ui/Heads";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getGames, getNow, getTeams, getTournaments } from "@/data/repo";
import { cx } from "@/lib/cx";
import {
  count,
  dayDiff,
  dayKey,
  dayLabel,
  dayLabelAbsolute,
  FORMS,
  formatDateRange,
  formatDayMonth,
  formatDayMonthWeekday,
  formatTime,
  gamesPlayed,
  weekRange,
} from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { DEFAULT_DIVISION, DIVISIONS, divisionLower, isDivision } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { firstParam, paths, type PageProps } from "@/lib/routes";
import { divisionCalendar, groupByRound, hasScore, indexById, isPlayed, type RoundGroup } from "@/lib/sport";
import type { Division, Game } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

const TITLE = "Календарь";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = firstParam((await searchParams).division);
  const division: Division = isDivision(raw) ? raw : DEFAULT_DIVISION;
  return pageMetadata({
    path: paths.games(division),
    title: division === "adult" ? TITLE : `${TITLE} · ${divisionLower(division)}`,
    description: `Расписание и результаты матчей Кыргызской баскетбольной федерации, ${divisionLower(division)}: туры, залы, счёт.`,
  });
}

/** Календарь дивизиона: туры по порядку, несыгранные выше сыгранных. */
function GamesPageContent({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<ListSkeleton title={TITLE} variant="rounds" />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

function roundsLabel(groups: RoundGroup[]): string {
  const rounds = groups.map((g) => g.round).filter((r) => r > 0);
  if (rounds.length === 0) return "Показать ранние матчи";
  const min = Math.min(...rounds);
  const max = Math.max(...rounds);
  return min === max ? `Показать тур ${min}` : `Показать туры ${min}–${max}`;
}

/** Якорь блока тура (#tour-…): ключ группы без символов, недопустимых в id. */
const anchorOf = (g: RoundGroup) => `tour-${g.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const OLDER_ID = "tours-older";

/** Матчи группы по дням (Бишкек), по времени. */
function byDay(games: Game[]): { key: string; games: Game[] }[] {
  const out: { key: string; games: Game[] }[] = [];
  for (const g of games) {
    const key = dayKey(g.scheduledAt);
    const last = out[out.length - 1];
    if (last && last.key === key) last.games.push(g);
    else out.push({ key, games: [g] });
  }
  return out;
}

/**
 * Календарь (концепция А): тёмная шапка с цифрами (сегодня, на этой неделе, сыграно),
 * чипы дивизиона и «Таблица турнира →»; выбор тура (якоря); несыгранные туры — по дням
 * карточками матчей, последний сыгранный — результатами, ранние — под «Показать туры …».
 */
async function Calendar({ searchParams }: Pick<PageProps, "searchParams">) {
  const raw = firstParam((await searchParams).division);
  const division: Division = isDivision(raw) ? raw : DEFAULT_DIVISION;
  const [now, games, teamsList, tournaments] = await Promise.all([getNow(), getGames(), getTeams(), getTournaments()]);
  const teams = indexById(teamsList);
  // Все идущие турниры дивизиона (лига + кубок) или главный, плюс игры без турнира
  const cal = divisionCalendar(games, tournaments, division);
  const list = cal.games;
  const tById = indexById(tournaments);
  const names = new Map(cal.tournaments.map((t) => [t.id, t.name]));
  const groups = groupByRound(list, now, names);
  const open = groups.filter((g) => !g.done);
  const closed = groups.filter((g) => g.done);
  const [lastClosed, ...olderClosed] = closed;
  const playedCount = list.filter(isPlayed).length;
  const tableOf = cal.tournaments.find((t) => t.type === "league") ?? cal.tournaments[0];
  const nearest = open[0];
  const sub = [
    ...cal.tournaments.map((t) => t.name),
    list.length ? gamesPlayed(playedCount, DEFAULT_LOCALE) : "Матчей пока нет",
    nearest?.round ? `дальше ${nearest.label.toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // Цифры шапки: матчи сегодня и на этой неделе (пн–вс по Бишкеку, без отменённых), сыграно
  const week = weekRange(now);
  const active = list.filter((g) => g.status !== "cancelled");
  const today = active.filter((g) => dayDiff(g.scheduledAt, now) === 0).length;
  const inWeek = active.filter((g) => {
    const d = dayDiff(g.scheduledAt, now);
    return d != null && d >= week.from && d <= week.to;
  }).length;
  const facts: Fact[] = list.length
    ? [
        { label: "Сегодня", value: today, accent: today > 0 },
        { label: "На неделе", value: inWeek },
        { label: "Сыграно", value: playedCount },
      ]
    : [];

  // Выбор тура: только туры с номером и без повторов номера (несколько турниров с турами —
  // без панели). Ранние сыгранные туры — под кнопкой: ссылка ведёт на неё.
  const numbered = groups.filter((g) => g.round > 0);
  const uniqueRounds = new Set(numbered.map((g) => g.round)).size === numbered.length;
  const olderKeys = new Set(olderClosed.map((g) => g.key));
  const currentKey = (nearest ?? lastClosed)?.key;
  const roundNav =
    numbered.length > 1 && uniqueRounds ? (
      <div className="k-roundbar">
        <span className="k-label">Тур</span>
        <nav className="k-rounds" aria-label="Выбор тура">
          {[...numbered]
            .sort((a, b) => a.round - b.round)
            .map((g) => (
              <a
                key={g.key}
                href={`#${olderKeys.has(g.key) ? OLDER_ID : anchorOf(g)}`}
                className={cx(g.done ? "is-done" : "is-next", g.games.some((x) => x.status === "live") && "is-live")}
                aria-current={g.key === currentKey ? "true" : undefined}
                aria-label={`${g.label}${g.done ? ", сыгран" : ""}`}
              >
                {g.round}
              </a>
            ))}
        </nav>
      </div>
    ) : null;

  const short = (g: Game) => (g.round ? `Тур ${g.round}` : (g.stage ?? ""));
  const card = (g: Game) => (
    <GameCard
      key={g.id}
      game={g}
      teams={teams}
      tournament={g.tournamentId ? tById.get(g.tournamentId) : null}
      dark={g.status === "live"}
      head={
        g.status === "live" ? (
          <>
            <span className="k-live">Идёт</span>
            <span className="k-eyebrow">{short(g)}</span>
          </>
        ) : hasScore(g) ? (
          <>
            <span className="k-eyebrow"><DayText at={g.scheduledAt} now={now} /></span>
            <span className="k-eyebrow">Финал</span>
          </>
        ) : (
          <>
            <span className="k-eyebrow">{short(g)}</span>
            {g.status === "cancelled" ? (
              <span className="k-eyebrow">Отменён</span>
            ) : (
              <span className="k-gc__time">{formatTime(g.scheduledAt, DEFAULT_LOCALE)}</span>
            )}
          </>
        )
      }
      footLeft={g.gymName}
      footRight={g.status === "live" ? "О матче →" : g.statsPdfUrl ? "Протокол →" : undefined}
    />
  );
  const label = (g: RoundGroup, suffix: string) => (g.round ? `${g.label} · ${suffix}` : g.label);

  const openBlock = (g: RoundGroup, i: number) => (
    <div key={g.key} id={anchorOf(g)} className="k-tourblock">
      <Rule label={label(g, g.games.some((x) => x.status === "live") ? "идёт" : i === 0 ? "ближайший" : "впереди")} accent={i === 0} />
      {byDay(g.games).map((d) => {
        const first = d.games[0]!;
        const isToday = dayDiff(first.scheduledAt, now) === 0;
        const n = count(d.games.length, FORMS.game, DEFAULT_LOCALE);
        const rel = dayLabel(first.scheduledAt, now, DEFAULT_LOCALE);
        const abs = dayLabelAbsolute(first.scheduledAt, now, DEFAULT_LOCALE);
        // Без «Сегодня» и .is-today — абсолютная дата (запасной вариант для кэша прошлого дня)
        const plain = (
          <div className="k-day">
            <b>{abs}</b>
            <span>{n}</span>
          </div>
        );
        return (
          <div key={d.key}>
            {rel === abs ? (
              plain
            ) : (
              <DayGuard day={dayKey(now)} fallback={plain}>
                <div className={cx("k-day", isToday && "is-today")}>
                  <b>{rel}</b>
                  <span>{isToday ? `${formatDayMonthWeekday(first.scheduledAt, DEFAULT_LOCALE)} · ${n}` : n}</span>
                </div>
              </DayGuard>
            )}
            <div className="k-cal k-cal--3">{d.games.map(card)}</div>
          </div>
        );
      })}
    </div>
  );
  const closedBlock = (g: RoundGroup) => {
    const first = g.games[0]?.scheduledAt;
    const lastAt = g.games[g.games.length - 1]?.scheduledAt;
    const dates = first && lastAt && dayKey(first) !== dayKey(lastAt) ? formatDateRange(first, lastAt, DEFAULT_LOCALE) : formatDayMonth(first, DEFAULT_LOCALE);
    return (
      <div key={g.key} id={anchorOf(g)} className="k-tourblock">
        <Rule label={[label(g, "сыгран"), dates].filter(Boolean).join(" · ")} />
        <div className="k-cal" style={{ marginTop: 14 }}>
          {g.games.map(card)}
        </div>
      </div>
    );
  };

  return (
    <>
      <ListHero
        title={TITLE}
        sub={sub}
        eyebrow="Матчи"
        facts={facts}
        chips={
          <>
            <ChipLinks
              label="Дивизион"
              items={DIVISIONS.map((d) => ({ label: d.label, href: paths.games(d.id), current: d.id === division }))}
            />
            {/* правка: заметная ссылка на таблицу текущего турнира (лига — первой) */}
            {tableOf ? (
              <Link className="k-lhero__cta" href={paths.tournament(tableOf.slug)}>
                Таблица турнира →
              </Link>
            ) : null}
          </>
        }
      />

      <Section>
        {groups.length === 0 ? <Empty>Матчей пока нет — расписание появится после жеребьёвки</Empty> : null}
        {roundNav}
        {open.map(openBlock)}
        {lastClosed ? closedBlock(lastClosed) : null}
        {olderClosed.length ? (
          <details className="k-more" id={OLDER_ID}>
            <summary>
              <span className="k-btn k-btn--outline k-more__btn" style={{ minWidth: 260 }}>
                {roundsLabel(olderClosed)}
              </span>
            </summary>
            {olderClosed.map(closedBlock)}
          </details>
        ) : null}
      </Section>
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function GamesPage(props: PageProps) {
  return (
    <PageShell>
      <GamesPageContent {...props} />
    </PageShell>
  );
}
