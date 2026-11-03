import { cx } from "@/lib/cx";
import { KIT_BG, kitOutline, type Kit } from "@/lib/teamPalette";

/** Силуэт майки концепции А (viewBox 120×132): лямки, вырез, проймы. */
const BODY = "M39 6H51C51 24 69 24 69 6H81L84 24C87 39 96 48 108 51V123Q108 129 102 129H18Q12 129 12 123V51C24 48 33 39 36 24Z";
const TRIM = "M51 6C51 24 69 24 69 6M36 24C33 39 24 48 12 51M84 24C87 39 96 48 108 51";

/**
 * Майка концепции А (.k-shirt, ширина задаётся классом: 44 / --64 / --xl, высота — по
 * пропорции): цвет формы, окантовка trim, номер или буква Oswald. Тёмная форма на тёмном фоне
 * (on="dark") и светлая на светлом получают контрастную обводку (kitOutline, порог 1.8).
 * Декоративная — aria-hidden, подпись рядом текстом.
 */
export function Shirt({
  kit,
  label,
  trim,
  on = "light",
  className,
}: {
  kit: Kit;
  /** Номер строкой («0», «07») или буква команды. */
  label: string;
  /** Цвет окантовки: обычно цвет второй формы; нет — цвет номера. */
  trim?: string;
  on?: keyof typeof KIT_BG;
  className?: string;
}) {
  const long = label.length > 2;
  const edge = kitOutline(kit.fill, KIT_BG[on]);
  return (
    <svg className={cx("k-shirt", className)} viewBox="0 0 120 132" aria-hidden focusable="false">
      <path d={BODY} fill={kit.fill} stroke={edge ?? "rgba(18,23,43,.16)"} strokeWidth={edge ? 3 : 2} />
      <path d={TRIM} fill="none" stroke={trim ?? kit.num} strokeOpacity={trim ? 1 : 0.55} strokeWidth={4} />
      <text x="60" y={long ? 94 : 101} textAnchor="middle" fontSize={long ? 30 : 50} fill={kit.num}>
        {label}
      </text>
    </svg>
  );
}
