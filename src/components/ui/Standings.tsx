import Link from "next/link";
import { cx } from "@/lib/cx";
import { signed } from "@/lib/format";
import { paths } from "@/lib/routes";
import { placedStandings, teamForm } from "@/lib/sport";
import type { Game, Team, Tournament } from "@/lib/types";
import { FormDots } from "./Form";
import { TeamDot } from "./TeamDot";
import { Empty } from "./Heads";
import { TeamLogo } from "./Media";

/**
 * Турнирная таблица из tournament.standings (хранится, не считается при показе).
 * Мобилка: # · команда (разница мелко под названием) · И · В · П · О. Десктоп: + логотип и
 * колонка «Разн.». Строка — ссылка на команду, если у неё есть slug.
 */
export function StandingsTable({
  tournament,
  teams,
  highlightTeamId,
  games,
}: {
  tournament: Tournament;
  teams: Map<string, Team>;
  highlightTeamId?: string;
  /** Матчи турнира — колонка «Форма» (последние 5 регулярки; на мобилке 3). */
  games?: Game[];
}) {
  const rows = placedStandings(tournament);
  const withForm = Boolean(games?.length) && rows.some((r) => teamForm(games!, tournament.id, r.teamId).length > 0);
  if (rows.length === 0) return <Empty>Таблица появится после первых матчей</Empty>;
  return (
    <>
      <div className="k-tablewrap">
        <table className="k-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className="is-left">
                Команда
              </th>
              <th scope="col" title="Игры">
                И
              </th>
              <th scope="col" title="Победы">
                В
              </th>
              <th scope="col" title="Поражения">
                П
              </th>
              <th scope="col" className="is-desk" title="Разница мячей">
                Разн.
              </th>
              {withForm ? (
                <th scope="col" title="Последние матчи регулярного этапа">
                  Форма
                </th>
              ) : null}
              <th scope="col" title="Очки">
                О
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const team = teams.get(r.teamId);
              const name = team?.name ?? "Команда";
              const diff = signed(r.diff);
              const inner = (
                <>
                  <TeamLogo name={name} logoUrl={team?.logoUrl} />
                  <span>
                    <span className="k-table__name">
                      <TeamDot team={team} />
                      {name}
                    </span>
                    <span className="k-table__diff">{diff} разница</span>
                  </span>
                </>
              );
              return (
                <tr
                  key={r.teamId}
                  className={cx(r.place === 1 && "is-lead")}
                  style={highlightTeamId === r.teamId && r.place !== 1 ? { background: "var(--orange-wash)" } : undefined}
                >
                  <td>
                    <span className="k-num">{r.place}</span>
                  </td>
                  <td className="is-left">
                    {team?.slug ? (
                      <Link className="k-table__team" href={paths.team(team.division, team.slug)}>
                        {inner}
                      </Link>
                    ) : (
                      <span className="k-table__team">{inner}</span>
                    )}
                  </td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.lost}</td>
                  <td className="is-desk">{diff}</td>
                  {withForm ? (
                    <td>
                      <FormDots results={teamForm(games!, tournament.id, r.teamId)} mobileLast={3} />
                    </td>
                  ) : null}
                  <td className="pts">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="k-note" style={{ margin: "10px 0 0" }}>
        И — игры, В — победы, П — поражения, О — очки{withForm ? "; форма — последние матчи регулярного этапа" : ""}.
        При равенстве очков выше команда с лучшей разницей мячей.
      </p>
    </>
  );
}
