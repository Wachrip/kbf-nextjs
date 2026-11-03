import Link from "next/link";
import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { firstLetter, formatDateRange, formatDayMonth } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { paths } from "@/lib/routes";
import { byDateAsc, isPlayed, winner } from "@/lib/sport";
import { teamColors } from "@/lib/teamPalette";
import type { Game, Team } from "@/lib/types";
import { Shirt } from "./Shirt";

export interface Stage {
  name: string;
  games: Game[];
}

/** Матчи со стадией (кубок, плей-офф) по стадиям в порядке первого матча. */
export function stagesOf(games: Game[]): Stage[] {
  const map = new Map<string, Game[]>();
  for (const g of [...games].sort(byDateAsc)) {
    if (!g.stage) continue;
    map.set(g.stage, [...(map.get(g.stage) ?? []), g]);
  }
  return [...map.entries()].map(([name, list]) => ({ name, games: list }));
}

/** Финал: последний матч стадии «Финал» (без учёта регистра); другой стадии финалом не считаем. */
export function finalOf(stages: Stage[]): Game | undefined {
  const named = stages.find((s) => s.name.trim().toLowerCase() === "финал");
  return named?.games[named.games.length - 1];
}

/**
 * Сетка кубка/плей-офф по стадиям (.k-bracket): колонки стадий, матчи .k-bgame (майка в
 * тёмной форме, счёт, проигравший приглушён), финал — акцентом; справа — обладатель: только
 * у завершённого турнира и только по сыгранному матчу стадии «Финал». Пары «по таблице» до
 * жеребьёвки не выводятся — в модели их нет.
 */
export function CupBracket({
  stages,
  teams,
  title,
  finished,
}: {
  stages: Stage[];
  teams: Map<string, Team>;
  title: string;
  /** Турнир завершён (status finished) — иначе обладателя нет, даже если финал сыгран. */
  finished: boolean;
}) {
  if (stages.length === 0) return null;
  const final = finalOf(stages);
  const w = finished && final && isPlayed(final) ? winner(final) : null;
  const champ = final && w ? { id: w === "home" ? final.homeTeamId : final.awayTeamId, name: w === "home" ? final.homeTeamName : final.awayTeamName } : null;
  const champTeam = champ ? teams.get(champ.id) : undefined;
  const style = { "--stages": stages.length } as CSSProperties;
  return (
    <div className={cx("k-bracket k-bracket--n", !champ && "is-open")} style={style}>
      {stages.map((s) => {
        const first = s.games[0]?.scheduledAt;
        const last = s.games[s.games.length - 1]?.scheduledAt;
        const dates = s.games.length > 1 ? formatDateRange(first, last, DEFAULT_LOCALE) : formatDayMonth(first, DEFAULT_LOCALE);
        return (
          <div key={s.name} className="k-stage">
            <div className="k-stage__head">
              <b>{s.name}</b>
              {dates ? <span className="k-meta">{dates}</span> : null}
            </div>
            <div className="k-stage__games">
              {s.games.map((g) => {
                const played = isPlayed(g);
                const gw = winner(g);
                const isFinal = g.id === final?.id;
                const row = (side: "home" | "away") => {
                  const id = side === "home" ? g.homeTeamId : g.awayTeamId;
                  const name = side === "home" ? g.homeTeamName : g.awayTeamName;
                  const pts = side === "home" ? g.homeScore : g.awayScore;
                  const c = teamColors(teams.get(id));
                  return (
                    <span className={cx("k-bgame__row", gw && gw !== side && "is-lose")}>
                      <Shirt kit={c.dark} label={firstLetter(name)} trim={c.light.fill} />
                      <span className="k-bgame__name">{name}</span>
                      <span className="k-bgame__pts">{played ? pts : "—"}</span>
                    </span>
                  );
                };
                const label = played
                  ? `${g.homeTeamName} ${g.homeScore} — ${g.awayTeamName} ${g.awayScore}`
                  : `${g.homeTeamName} — ${g.awayTeamName}`;
                return (
                  <Link key={g.id} className={cx("k-card k-bgame", isFinal && "is-final")} href={paths.game(g.id)} aria-label={`${s.name}: ${label}`}>
                    {row("home")}
                    {row("away")}
                    {isFinal && champ ? <span className="k-bgame__meta">{champ.name} — {title.toLowerCase().includes("кубок") ? "обладатель кубка" : "победитель"}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      {champ ? (
        <div className="k-card k-cup k-card--muted">
          <span className="k-eyebrow">{title}</span>
          <Shirt kit={teamColors(champTeam).dark} label={firstLetter(champ.name)} trim={teamColors(champTeam).light.fill} />
          <b>{champ.name}</b>
          <span className="k-meta">{title.toLowerCase().includes("кубок") ? "обладатель кубка" : "победитель"}</span>
        </div>
      ) : null}
    </div>
  );
}
