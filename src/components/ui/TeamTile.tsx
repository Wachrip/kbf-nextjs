import Link from "next/link";
import { firstLetter } from "@/lib/format";
import { placeLine } from "@/lib/labels";
import { paths } from "@/lib/routes";
import type { FormResult, PlacedRow } from "@/lib/sport";
import { teamVars } from "@/lib/teamPalette";
import type { Team } from "@/lib/types";
import { FormDots } from "./Form";
import { CourtArt } from "./Icons";
import { TeamLogo } from "./Media";
import { Vt, vtName } from "./Vt";

/**
 * Плитка команды концепции А (.k-ttile): шапка в цвете клуба (--team-head, разметка
 * площадки), эмблема или буква, город и год основания, место в таблице; ниже — В–П, очки,
 * форма и тренер. compact — только шапка («Также в U18»). Эмблема — общий элемент View
 * Transitions с шапкой команды (vt = false, если команда уже есть на странице с vt).
 */
export function TeamTile({
  team,
  row,
  form = [],
  compact = false,
  vt = true,
}: {
  team: Team;
  row?: PlacedRow | null;
  form?: FormResult[];
  compact?: boolean;
  vt?: boolean;
}) {
  const meta = [placeLine(team.city, team.region), team.foundedYear ? `с ${team.foundedYear}` : ""].filter(Boolean).join(" · ");
  const crest = team.logoUrl ? (
    <TeamLogo name={team.name} logoUrl={team.logoUrl} className="k-crest" />
  ) : (
    <span className="k-crest" aria-hidden>
      {firstLetter(team.name)}
    </span>
  );
  return (
    <Link className="k-card k-ttile" style={teamVars(team)} href={paths.team(team.division, team.slug)}>
      <span className="k-ttile__head">
        <CourtArt className="k-ttile__art" />
        {vt ? <Vt name={vtName.team(team.id)}>{crest}</Vt> : crest}
        <span className="k-ttile__id">
          <span className="k-ttile__name">{team.name}</span>
          {meta ? <span className="k-ttile__meta">{meta}</span> : null}
        </span>
        {row ? <span className="k-ttile__place">{row.place} место</span> : null}
      </span>
      {compact ? null : (
        <>
          {row || form.length ? (
            <span className="k-ttile__body">
              {row ? (
                <>
                  <span className="k-ttile__stat">
                    <span className="k-eyebrow">В — П</span>
                    <b>
                      {row.won}–{row.lost}
                    </b>
                  </span>
                  <span className="k-ttile__stat">
                    <span className="k-eyebrow">Очки</span>
                    <b>{row.points}</b>
                  </span>
                </>
              ) : null}
              <FormDots results={form} />
            </span>
          ) : null}
          <span className="k-ttile__foot">
            <span className="k-meta">{team.coachName ? `Тренер: ${team.coachName}` : "Состав и матчи"}</span>
            <span className="k-arrow" aria-hidden style={{ marginLeft: "auto" }}>
              →
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
