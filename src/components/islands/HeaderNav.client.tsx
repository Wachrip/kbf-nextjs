"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NAV, sectionOf } from "@/lib/routes";

/**
 * Меню шапки: на десктопе ряд ссылок, на мобилке бургер → полноэкранное меню на navy.
 * Активный пункт — по адресу (usePathname), поэтому это клиентский островок. Логотип и
 * футер меню приходят с сервера через пропсы (logo, foot).
 * Меню рисуется порталом в <body>: .k-page — контейнер (container-type), а он создаёт
 * layout containment, и position: fixed внутри него считался бы от страницы, а не от экрана.
 */
export function HeaderNav({ logo, foot }: { logo: ReactNode; foot?: ReactNode }) {
  const pathname = usePathname();
  const active = sectionOf(pathname ?? "/");
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Ловушка фокуса: Tab/Shift+Tab ходят по кругу внутри открытого меню. */
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !menuRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !menuRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  // Закрыть меню при переходе
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Страница под меню недоступна ни фокусу, ни читалкам (меню — портал вне .k-page)
    const page = document.querySelector<HTMLElement>(".k-page");
    page?.setAttribute("inert", "");
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const burger = burgerRef.current;
    return () => {
      document.body.style.overflow = prev;
      page?.removeAttribute("inert");
      window.removeEventListener("keydown", onKey);
      burger?.focus();
    };
  }, [open]);

  return (
    <>
      <nav className="k-nav" aria-label="Разделы">
        {NAV.map((n) => (
          <Link key={n.key} href={n.href} aria-current={n.key === active ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <button
        ref={burgerRef}
        type="button"
        className="k-burger"
        aria-label="Меню"
        aria-expanded={open}
        aria-controls={open ? "k-menu" : undefined}
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {open
        ? createPortal(
        <div
          ref={menuRef}
          className="k-menu"
          id="k-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Меню сайта"
          onKeyDown={trapFocus}
        >
          <div className="k-wrap k-menu__top">
            {logo}
            <button
              ref={closeRef}
              type="button"
              className="k-menu__close"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <nav className="k-wrap k-menu__list" aria-label="Разделы">
            {NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                aria-current={n.key === active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          {foot ? <div className="k-wrap k-menu__foot">{foot}</div> : null}
        </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** То же меню без активного пункта и без JS — запасной вид до определения адреса. */
export function HeaderNavFallback() {
  return (
    <>
      <nav className="k-nav" aria-label="Разделы">
        {NAV.map((n) => (
          <Link key={n.key} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
      <button type="button" className="k-burger" aria-label="Меню" disabled>
        <span />
        <span />
        <span />
      </button>
    </>
  );
}
