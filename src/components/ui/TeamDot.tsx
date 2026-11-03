import { teamColors } from "@/lib/teamPalette";
import type { Team } from "@/lib/types";

/**
 * Точка цвета команды перед названием в карточках матчей (основной цвет; без color — navy).
 * Команда не найдена (удалена, справочник не передан) — точки нет.
 */
export function TeamDot({ team }: { team: Team | undefined }) {
  if (!team) return null;
  return <span className="k-teamdot" style={{ background: teamColors(team).color }} aria-hidden />;
}
