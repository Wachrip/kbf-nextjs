import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { KIT_BG, kitOutline, type Kit } from "@/lib/teamPalette";

/** Силуэт баскетбольной майки (viewBox 100×120): лямки, вырез, проймы. */
const BODY = "M31 4H42C44 15 56 15 58 4H69C70 20 77 30 89 33V116H11V33C23 30 30 20 31 4Z";
const TRIM = "M42 4C44 15 56 15 58 4M69 4C70 20 77 30 89 33M31 4C30 20 23 30 11 33";

/**
 * Майка с номером (inline SVG) — вместо фото игрока, которого нет. Цвета — форма команды
 * (teamPalette: kit.fill и kit.num с контрастом ≥ 3:1). Без номера — инициалы. Декоративная:
 * aria-hidden, имя рядом текстом. on — фон под майкой: если форма с ним сливается (контраст
 * < 1.8: navy/чёрная на тёмной секции, белая на светлом), силуэт обводится.
 */
export function JerseySvg({
  kit,
  label,
  className,
  on = "light",
}: {
  kit: Kit;
  label: string;
  className?: string;
  /** light — мягкий светлый фон k-media--kit, dark — тёмные секции (табло, портрет). */
  on?: keyof typeof KIT_BG;
}) {
  const long = label.length > 2;
  const edge = kitOutline(kit.fill, KIT_BG[on]);
  return (
    <svg className={cx("k-kit", className)} viewBox="0 0 100 120" aria-hidden focusable="false">
      <path d={BODY} fill={kit.fill} />
      {/* Окантовка цветом номера; у белой майки на светлом фоне — тонкий контур */}
      <path d={BODY} fill="none" stroke={edge ?? kit.num} strokeOpacity={edge ? 0.9 : 0.18} strokeWidth={edge ? 3 : 2} />
      <path d={TRIM} fill="none" stroke={kit.num} strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
      <text
        x="50"
        y={long ? 84 : 88}
        textAnchor="middle"
        fill={kit.num}
        style={{ font: `600 ${long ? 30 : 44}px var(--font-display), var(--font-display-fallback)`, letterSpacing: "0.02em" } as CSSProperties}
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * Майка в рамке медиа (как PersonPhoto: квадрат size или по CSS-классу), мягкий фон.
 * portrait — крупно для портрета 3:4 в шапке игрока.
 */
export function Jersey({
  kit,
  number,
  initials,
  size,
  round = false,
  dark = false,
  className,
}: {
  kit: Kit;
  /** Тёмный мягкий фон (navy-soft) вместо светлого. */
  dark?: boolean;
  /** Номер строкой как есть («0», «00», «07»). */
  number?: string;
  /** Без номера — инициалы. */
  initials: string;
  size?: number;
  round?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx("k-media", round ? "k-media--round" : "k-media--square", "k-media--kit", dark && "k-media--kit-dark", className)}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden
    >
      <JerseySvg kit={kit} label={number ?? initials} on={dark ? "dark" : "light"} />
    </span>
  );
}
