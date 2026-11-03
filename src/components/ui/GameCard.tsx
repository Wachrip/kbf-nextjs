import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { firstLetter } from "@/lib/format";
import { paths } from "@/lib/routes";
import { hasScore, recordOf, winner } from "@/lib/sport";
import { gameKit, teamColors } from "@/lib/teamPalette";
import type { Game, Team, Tournament } from "@/lib/types";
import { Shirt } from "./Shirt";
import { Vt, vtName } from "./Vt";

/**
 * Карточка матча концепции А (.k-gc): полоса цветов двух команд сверху (--h/--a), хозяева в
 * светлой форме, гости в тёмной; справа счёт или В–П в турнире. head — строка сверху
 * (статус, тур), foot — подписи снизу. dark — тёмный вариант (идёт сейчас). vt — общий
 * элемент View Transitions (false, если матч уже есть на странице с vt).
 */
export function GameCard({
  game,
  teams,
  tournament,
  head,
  footLeft,
  footRight,
  dark = false,
  vt = true,
}: {
  game: Game;
  teams: Map<string, Team>;
  tournament?: Tournament | null;
  head?: ReactNode;
  footLeft?: ReactNode;
  footRight?: ReactNode;
  dark?: boolean;
  vt?: boolean;
}) {
  const scored = hasScore(game);
  const w = winner(game);
  const home = teams.get(game.homeTeamId);
  const away = teams.get(game.awayTeamId);
  const style = { "--h": teamColors(home).color, "--a": teamColors(away).color } as CSSProperties;
  const row = (side: "home" | "away") => {
    const id = side === "home" ? game.homeTeamId : game.awayTeamId;
    const name = side === "home" ? game.homeTeamName : game.awayTeamName;
    const pts = side === "home" ? game.homeScore : game.awayScore;
    const t = side === "home" ? home : away;
    const c = teamColors(t);
    const kit = gameKit(t, side);
    return (
      <span className={cx("k-gc__row", w && w !== side && "is-lose")}>
        <Shirt kit={kit} label={firstLetter(name)} trim={side === "home" ? c.color : c.light.fill} on={dark ? "dark" : "light"} />
        <span className="k-gc__name">{name}</span>
        {scored ? (
          <span className="k-gc__pts">{pts}</span>
        ) : (
          <span className="k-gc__rec" style={{ marginLeft: "auto" }}>
            {recordOf(tournament, id)}
          </span>
        )}
      </span>
    );
  };
  const label = scored
    ? `${game.homeTeamName} ${game.homeScore} — ${game.awayTeamName} ${game.awayScore}`
    : `${game.homeTeamName} — ${game.awayTeamName}`;
  const card = (
    <Link
      className={cx("k-card k-gc", game.status === "live" && "is-live", dark && "k-gc--dark")}
      style={style}
      href={paths.game(game.id)}
      aria-label={label}
    >
      {head ? <span className="k-gc__head">{head}</span> : null}
      <span className="k-gc__teams">
        {row("home")}
        {row("away")}
      </span>
      {footLeft || footRight ? (
        <span className="k-gc__foot">
          <span className="k-meta">{footLeft}</span>
          {footRight ? <span className="k-link">{footRight}</span> : <span className="k-arrow">→</span>}
        </span>
      ) : null}
    </Link>
  );
  return vt ? <Vt name={vtName.game(game.id)}>{card}</Vt> : card;
}
