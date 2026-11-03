import { ViewTransition, type ReactNode } from "react";

/**
 * View Transitions (React <ViewTransition>, стабильный в react 19.3). Только общие элементы:
 * карточка матча → табло на странице матча, логотип в плитке команды → шапка команды.
 * share="auto" — анимируется только пара «ушёл на одной странице, появился на другой»;
 * default="none" — никаких анимаций при обновлении на месте (Suspense reveal, смена
 * searchParams). Crossfade страниц — PageShell в корне каждой page.tsx (не в layout: он
 * не размонтируется, enter/exit там не срабатывают; docs Next 16.4, view-transitions.md).
 * Выключение — NEXT_PUBLIC_VIEW_TRANSITIONS=off (по умолчанию on). reduced-motion — CSS.
 */
export const VIEW_TRANSITIONS = process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "off";

export function Vt({ name, children }: { name: string; children: ReactNode }) {
  if (!VIEW_TRANSITIONS) return <>{children}</>;
  return (
    <ViewTransition name={name} share="auto" default="none">
      {children}
    </ViewTransition>
  );
}

/**
 * Корень страницы: лёгкий crossfade при навигации (enter/exit класса k-fade), на update
 * (Suspense reveal, searchParams) — ничего (default="none"). CSS — kbf-extra.css.
 */
export function PageShell({ children }: { children: ReactNode }) {
  if (!VIEW_TRANSITIONS) return <>{children}</>;
  return (
    <ViewTransition enter="k-fade" exit="k-fade" default="none">
      {children}
    </ViewTransition>
  );
}

/** Имена общих элементов (уникальны на странице). */
export const vtName = {
  game: (id: string) => `k-game-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
  team: (id: string) => `k-team-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
};
