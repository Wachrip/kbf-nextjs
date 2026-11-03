import Link from "next/link";
import type { CSSProperties } from "react";
import { TickerNav } from "@/components/islands/TickerNav.client";
import { cx } from "@/lib/cx";
import { dayLabelAbsolute, formatTime } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { paths } from "@/lib/routes";
import { hasScore, isOverdue, recordOf, teamAbbr, winner, type TickerGroups } from "@/lib/sport";
import { gameKit } from "@/lib/teamPalette";
import { DayText } from "./DayText";
import type { Game, Team, Tournament } from "@/lib/types";

/** Мини-майка 16×18 в цвете формы (концепция А, .k-tkit; обводка светлая — на тёмной ленте видна). */
export function TickKit({ fill }: { fill: string }) {
  return (
    <svg className="k-tkit" viewBox="0 0 40 44" style={{ "--kit": fill } as CSSProperties} aria-hidden focusable="false">
      <path d="M13 2H17C17 8 23 8 23 2H27L28 8C29 13 32 16 36 17V41Q36 43 34 43H6Q4 43 4 41V17C8 16 11 13 12 8Z" />
    </svg>
  );
}

function Tick({
  game,
  teams,
  tournaments,
  now,
  today,
}: {
  game: Game;
  teams: Map<string, Team>;
  tournaments: Map<string, Tournament>;
  now: number;
  today?: boolean;
}) {
  const scored = hasScore(game);
  const live = game.status === "live";
  const w = winner(game);
  const t = game.tournamentId ? tournaments.get(game.tournamentId) : undefined;
  // aria-label — абсолютная дата (не устаревает в кэше); видимая — «Вчера/Сегодня/Завтра» через DayText
  const day = dayLabelAbsolute(game.scheduledAt, now, DEFAULT_LOCALE, true);
  const time = formatTime(game.scheduledAt, DEFAULT_LOCALE);
  const right = live ? null : game.status === "finished" ? "Финал" : game.status === "cancelled" ? "Отменён" : isOverdue(game, now) ? "Нет счёта" : time;
  const row = (side: "home" | "away") => {
    const id = side === "home" ? game.homeTeamId : game.awayTeamId;
    const name = side === "home" ? game.homeTeamName : game.awayTeamName;
    const pts = side === "home" ? game.homeScore : game.awayScore;
    return (
      <span className={cx("k-tick__row", w === side && "is-win", w && w !== side && "is-lose")}>
        <TickKit fill={gameKit(teams.get(id), side).fill} />
        <span className="k-tick__team">{teamAbbr(name)}</span>
        {scored ? <span className="k-tick__pts">{pts}</span> : <span className="k-tick__rec">{recordOf(t, id)}</span>}
      </span>
    );
  };
  const status = live ? "идёт сейчас" : scored ? "финал" : game.status === "cancelled" ? "отменён" : time;
  const side = (n: string, s?: number) => (scored ? `${n} ${s}` : n);
  return (
    <Link
      className={cx("k-tick", live && "is-live", game.status === "finished" && "is-final")}
      href={paths.game(game.id)}
      aria-label={`${day}, ${status}: ${side(game.homeTeamName, game.homeScore)} — ${side(game.awayTeamName, game.awayScore)}`}
      {...(today ? { "data-today": "" } : {})}
    >
      <span className="k-tick__head">
        {live ? (
          <span className="k-tick__live">Идёт</span>
        ) : (
          <span>
            <DayText at={game.scheduledAt} now={now} short />
          </span>
        )}
        {right ? <span className={right === time ? "k-tick__time" : undefined}>{right}</span> : null}
      </span>
      <span className="k-tick__teams">
        {row("home")}
        {row("away")}
      </span>
    </Link>
  );
}

/**
 * Лента матчей под шапкой (как на NBA.com): вчера · сегодня (идущие первыми) · далее, в конце
 * «Календарь →». Мини-майки — форма по FIBA (хозяева светлая, гости тёмная), у сыгранных —
 * счёт, у предстоящих — В–П в турнире. Прокрутка без JS; на десктопе стрелки и стартовая
 * позиция на сегодняшних — островок TickerNav. Пусто — ленты нет.
 */
export function Ticker({
  groups,
  teams,
  tournaments,
  now,
}: {
  groups: TickerGroups;
  teams: Map<string, Team>;
  tournaments: Map<string, Tournament>;
  now: number;
}) {
  const { yesterday, today, next } = groups;
  if (yesterday.length + today.length + next.length === 0) return null;
  const blocks = [yesterday, today, next].filter((b) => b.length > 0);
  const id = "k-ticker-track";
  return (
    <section className="k-ticker" aria-label="Матчи: вчера, сегодня и ближайшие">
      <div className="k-ticker__track" id={id}>
        {blocks.map((b, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 ? <span className="k-ticker__sep" aria-hidden /> : null}
            {b.map((g, j) => (
              <Tick
                key={g.id}
                game={g}
                teams={teams}
                tournaments={tournaments}
                now={now}
                today={b === today && j === 0}
              />
            ))}
          </span>
        ))}
        <Link className="k-ticker__more" href={paths.games()}>
          Календарь →<small>все матчи сезона</small>
        </Link>
      </div>
      <TickerNav trackId={id} />
    </section>
  );
}
