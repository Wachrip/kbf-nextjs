// Цвета команд (teams.color / kitLight / kitDark — «#RRGGBB»). Палитра — общий контракт с
// админкой: те же id, названия и hex, что в kbf/packages/core/lib/constants/team_palette.dart.
// Админка выбирает только из палитры, сайт принимает любой корректный hex (normalizeHex) и
// проверяет контраст по WCAG — для произвольного цвета есть фолбэк на navy.
import type { CSSProperties } from "react";
import type { Team } from "./types";

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

/** Тёмные цвета: основной цвет клуба и тёмная форма. */
export const DARK_COLORS: readonly PaletteColor[] = [
  { id: "burgundy", name: "Бордовый", hex: "#7A1F2B" },
  { id: "red", name: "Красный", hex: "#B3261E" },
  { id: "orange", name: "Оранжевый", hex: "#C2410C" },
  { id: "forest", name: "Тёмно-зелёный", hex: "#1F5E3A" },
  { id: "teal", name: "Изумрудный", hex: "#0F766E" },
  { id: "blue", name: "Синий", hex: "#1D4ED8" },
  { id: "navy", name: "Тёмно-синий", hex: "#1E3A8A" },
  { id: "purple", name: "Фиолетовый", hex: "#5B21B6" },
  { id: "raspberry", name: "Малиновый", hex: "#9D174D" },
  { id: "brown", name: "Коричневый", hex: "#6B3F1D" },
  { id: "graphite", name: "Графит", hex: "#2F3542" },
  { id: "black", name: "Чёрный", hex: "#111318" },
];

/** Светлые цвета: светлая форма. */
export const LIGHT_COLORS: readonly PaletteColor[] = [
  { id: "white", name: "Белый", hex: "#FFFFFF" },
  { id: "cream", name: "Кремовый", hex: "#F7F1E3" },
  { id: "yellow", name: "Жёлтый", hex: "#F5C518" },
  { id: "gold", name: "Золотой", hex: "#E0B84F" },
  { id: "sky", name: "Светло-голубой", hex: "#9CC9EE" },
  { id: "mint", name: "Мятный", hex: "#A7E3C9" },
  { id: "silver", name: "Светло-серый", hex: "#D9DCE1" },
  { id: "sand", name: "Песочный", hex: "#E8D3A8" },
];

/** navy дизайн-системы — цвет команды без color. */
export const NAVY = "#12172B";
export const WHITE = "#FFFFFF";
/** Светлая форма без kitLight. */
export const DEFAULT_KIT_LIGHT = "#F7F1E3";

/** Крупный номер на майке — не ниже 3:1; белый текст на шапке команды — не ниже 4.5:1. */
export const MIN_NUMBER_CONTRAST = 3;
export const MIN_TEXT_CONTRAST = 4.5;

/** «#rrggbb» → «#RRGGBB»; всё остальное (в том числе #RGB и имена цветов) — undefined. */
export function normalizeHex(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : undefined;
}

/** Относительная яркость по WCAG 2.x. */
export function luminance(hex: string): number {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

/** Контраст двух цветов, 1…21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Цвет на фоне fill: первый из кандидатов с контрастом ≥ min (крупный номер — 3:1, мелкий
 * текст — 4.5:1), иначе самый контрастный.
 */
function numberOn(fill: string, candidates: string[], min = MIN_NUMBER_CONTRAST): string {
  const ok = candidates.find((c) => contrast(c, fill) >= min);
  return ok ?? [...candidates].sort((a, b) => contrast(b, fill) - contrast(a, fill))[0]!;
}

export interface Kit {
  /** Цвет майки. */
  fill: string;
  /** Цвет крупного номера (и инициалов), ≥ 3:1. */
  num: string;
  /** Мелкий текст на цвете формы (бейдж номера в составе), ≥ 4.5:1 — белый или navy. */
  small: string;
}

/** Майка почти сливается с фоном (контраст ниже 1.8) — нужна обводка. */
export const MIN_KIT_EDGE = 1.8;

/**
 * Обводка силуэта майки на фоне bg: если контраст формы и фона ниже 1.8 (тёмная форма на
 * navy, белая — на светлом), — белый или navy, что контрастнее фону; иначе undefined.
 */
export function kitOutline(fill: string, bg: string): string | undefined {
  if (contrast(fill, bg) >= MIN_KIT_EDGE) return undefined;
  return contrast(WHITE, bg) >= contrast(NAVY, bg) ? WHITE : NAVY;
}

/** Фоны, на которых рисуется майка (токены DS): k-media--kit, тёмные секции и портрет. */
export const KIT_BG = { light: "#E4DED1", dark: "#1B2340" } as const;

export interface TeamColors {
  /** Основной цвет (без color — navy). */
  color: string;
  /** Белый текст на основном цвете проходит 4.5:1 — тогда шапка в цвете команды. */
  headOk: boolean;
  /** Фон шапки: основной цвет или navy (произвольный светлый hex). */
  head: string;
  /** Текст на шапке. */
  ink: string;
  light: Kit;
  dark: Kit;
}

type TeamColorFields = Pick<Team, "color" | "kitLight" | "kitDark">;

/**
 * Цвета команды с фолбэками: нет color — navy; нет kitDark — color; нет kitLight — кремовый.
 * Номер на тёмной форме белый, на светлой — цвета color (без color — navy); если контраст
 * ниже 3:1 — navy (и белый, если и он не проходит).
 */
export function teamColors(t: TeamColorFields | null | undefined): TeamColors {
  const color = normalizeHex(t?.color) ?? NAVY;
  const darkFill = normalizeHex(t?.kitDark) ?? color;
  const lightFill = normalizeHex(t?.kitLight) ?? DEFAULT_KIT_LIGHT;
  const headOk = contrast(WHITE, color) >= MIN_TEXT_CONTRAST;
  return {
    color,
    headOk,
    head: headOk ? color : NAVY,
    ink: WHITE,
    light: {
      fill: lightFill,
      num: numberOn(lightFill, [color, NAVY, WHITE]),
      small: numberOn(lightFill, [NAVY, WHITE], MIN_TEXT_CONTRAST),
    },
    dark: {
      fill: darkFill,
      num: numberOn(darkFill, [WHITE, NAVY]),
      small: numberOn(darkFill, [WHITE, NAVY], MIN_TEXT_CONTRAST),
    },
  };
}

/** Форма по правилу FIBA: хозяева — светлая, гости — тёмная. */
export function gameKit(t: TeamColorFields | null | undefined, side: "home" | "away"): Kit {
  const c = teamColors(t);
  return side === "home" ? c.light : c.dark;
}

/**
 * CSS-переменные на корне блока команды: --team, --team-ink, --kit-light, --kit-dark,
 * --kit-light-num, --kit-dark-num, --kit-dark-small (мелкий текст ≥ 4.5:1) и --team-head
 * (фон шапки: color или navy-фолбэк).
 */
export function teamVars(t: TeamColorFields | null | undefined): CSSProperties {
  const c = teamColors(t);
  return {
    "--team": c.color,
    "--team-ink": c.ink,
    "--team-head": c.head,
    "--kit-light": c.light.fill,
    "--kit-dark": c.dark.fill,
    "--kit-light-num": c.light.num,
    "--kit-dark-num": c.dark.num,
    // Мелкий текст на тёмной форме (бейдж номера), ≥ 4.5:1
    "--kit-dark-small": c.dark.small,
  } as CSSProperties;
}
