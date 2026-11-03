// Иконки концепции А (inline SVG, без <symbol>): «Я хочу», соцсети, турниры. Декоративные —
// aria-hidden; подпись рядом текстом.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const P: Record<string, ReactNode> = {
  ticket: (
    <>
      <path d="M3 8.5V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M15 5v2M15 11v2M15 17v2" />
      <path d="M7 10h4M7 14h3" />
    </>
  ),
  hoop: (
    <>
      <path d="M4 3h16v8H4z" />
      <path d="M9 7h6v4" />
      <path d="M7 11h10" />
      <path d="M8 11l1.5 8M16 11l-1.5 8M10.2 11l.6 8M13.8 11l-.6 8" />
      <path d="M8.7 15h6.6" />
    </>
  ),
  kid: (
    <>
      <circle cx="8" cy="5" r="2.2" />
      <path d="M8 8.5v6M8 14.5l-2.5 6M8 14.5l2.5 6M5 11l3-1.5 4 2" />
      <circle cx="17" cy="9.5" r="1.7" />
      <path d="M17 12v4.5M17 16.5l-1.8 4M17 16.5l1.8 4M14.5 14l2.5-1 2.5 1" />
    </>
  ),
  cup: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 4M17 6h2.5a2.5 2.5 0 0 1-2.6 4" />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 20.5c0-1.7 1.1-3 2.5-3s2.5 1.3 2.5 3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  phone: <path d="M5 4h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6 6l1.4-2.3 4.6 1.8V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-11.4a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.6" r="2.5" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  chat: <path d="M4 20l1.4-4A8 8 0 1 1 8.3 19Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
};

export type IconName = keyof typeof P;

/** Иконка-обводка 24×24 (k-ico): цвет — currentColor. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={cx("k-ico", className)} viewBox="0 0 24 24" aria-hidden focusable="false">
      {P[name]}
    </svg>
  );
}

/** Логотип Instagram (заливка — фон карточки бренда). */
export function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Логотип YouTube: треугольник «play». */
export function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d="M9.5 8.2v7.6l6.6-3.8z" />
    </svg>
  );
}

/** Логотип Telegram: бумажный самолётик. */
export function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d="M20.7 4.3 3.1 11.1c-1.1.4-1.1 1.4 0 1.8l4.4 1.4 1.7 5.3c.2.6 1 .8 1.5.3l2.5-2.3 4.6 3.4c.6.4 1.4.1 1.6-.6L22.3 5.8c.3-1.1-.6-1.9-1.6-1.5ZM9.5 14.1l8.2-6.6-6.7 7.8-.4 3.1-1.1-4.3Z" />
    </svg>
  );
}

/** Разметка площадки — фоновый рисунок шапок (k-teamhero__art, k-lhero__art, k-tourhero__art). */
export function CourtArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="5">
        <circle cx="200" cy="200" r="196" />
        <path d="M60 0V150Q60 330 200 330Q340 330 340 150V0" />
        <path d="M140 0V190H260V0" />
        <circle cx="200" cy="190" r="60" />
        <path d="M175 30H225M200 30V44" />
        <circle cx="200" cy="56" r="12" />
      </g>
    </svg>
  );
}
