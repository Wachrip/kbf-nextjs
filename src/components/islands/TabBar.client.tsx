"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { paths, sectionOf } from "@/lib/routes";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
    {d}
  </svg>
);

const TABS: { key: string; label: string; href: string; icon: ReactNode }[] = [
  { key: "home", label: "Главная", href: paths.home(), icon: icon(<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />) },
  {
    key: "games",
    label: "Матчи",
    href: paths.games(),
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3v18M5.6 5.6c3.2 3 3.2 9.8 0 12.8M18.4 5.6c-3.2 3-3.2 9.8 0 12.8" />
      </>,
    ),
  },
  {
    key: "news",
    label: "Новости",
    href: paths.news(),
    icon: icon(
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>,
    ),
  },
  {
    key: "teams",
    label: "Команды",
    href: paths.teams(),
    icon: icon(<path d="M12 3 4 6v6c0 4.4 3.4 8 8 9 4.6-1 8-4.6 8-9V6z" />),
  },
];

/**
 * Нижняя панель на мобилке (< 1024px): Главная, Матчи, Новости, Команды. Фиксированная, с
 * отступом safe-area; вне .k-page (container-type ломает position: fixed), поэтому скрытие —
 * медиазапросом по ширине окна (= ширине .k-page). Шапка и бургер остаются.
 */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  return <TabBarView active={pathname === "/" ? "home" : sectionOf(pathname)} pathname={pathname} />;
}

/** Та же панель без активного пункта — fallback Suspense (адрес ещё не известен). */
export function TabBarView({ active, pathname }: { active?: string | null; pathname?: string }) {
  return (
    <nav className="k-tabbar" aria-label="Быстрые разделы">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className="k-tabbar__item" aria-current={active === t.key ? (pathname === t.href ? "page" : "true") : undefined}>
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
