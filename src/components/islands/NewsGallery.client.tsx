"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canOptimize } from "@/lib/images";

/** В сетке — до шести кадров; остальные открываются в просмотре («+N» на последнем). */
const SHOWN = 6;

/**
 * Пропорции кадров мозаики (.k-gal, концепция А): высокие и широкие ячейки по числу фото.
 * Сетка 2 колонки на мобилке и 4 на десктопе, grid-auto-flow: dense.
 */
function shapes(n: number): string[] {
  if (n >= 5) return ["is-tall", "is-wide", "", "", "is-tall", ""];
  if (n === 4) return ["is-wide", "", "", "is-wide"];
  if (n === 3) return ["is-wide", "", ""];
  if (n === 1) return ["is-wide"];
  return ["", ""];
}

/**
 * Галерея новости (posts.gallery): мозаика .k-gal (до 6 кадров, на последнем «+N»); клик —
 * просмотр на весь экран (все фото, стрелки и клавиши ←/→, Esc). Просмотр — порталом в
 * <body> (fixed внутри контейнера .k-page считался бы от страницы).
 */
export function NewsGallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Кнопка-миниатюра, с которой открыли просмотр — ей вернётся фокус. */
  const returnTo = useRef<HTMLElement | null>(null);
  const total = photos.length;
  const isOpen = open != null;

  // Открытие/закрытие: прокрутка страницы, inert на .k-page (фон недоступен с клавиатуры и
  // читалкам), фокус в диалог и обратно на миниатюру
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const page = document.querySelector<HTMLElement>(".k-page");
    page?.setAttribute("inert", "");
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      page?.removeAttribute("inert");
      returnTo.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % total));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + total) % total));
      // Ловушка фокуса: Tab ходит по кнопкам диалога по кругу
      if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, total]);

  if (total === 0) return null;

  return (
    <>
      <div className="k-gal">
        {photos.slice(0, SHOWN).map((src, i) => {
          const more = i === SHOWN - 1 ? total - SHOWN : 0;
          return (
            <button
              key={`${i}-${src}`}
              type="button"
              className={shapes(Math.min(total, SHOWN))[i] || undefined}
              onClick={(e) => {
                returnTo.current = e.currentTarget;
                setOpen(i);
              }}
              aria-label={more > 0 ? `Открыть фото ${i + 1} из ${total}, ещё ${more}` : `Открыть фото ${i + 1} из ${total}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(min-width: 1024px) 380px, 50vw"
                unoptimized={!canOptimize(src)}
              />
              {more > 0 ? (
                <span className="k-gal__more" aria-hidden>
                  +{more}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {open != null
        ? createPortal(
        <div ref={dialogRef} className="k-lightbox" role="dialog" aria-modal="true" aria-label={`Фото: ${title}`}>
          <div className="k-lightbox__bar">
            <span>
              {open + 1} / {total}
            </span>
            <button
              ref={closeRef}
              type="button"
              className="k-lightbox__btn"
              aria-label="Закрыть"
              onClick={() => setOpen(null)}
            >
              ×
            </button>
          </div>
          <div className="k-lightbox__stage">
            <Image
              key={`${open}-${photos[open]}`}
              src={photos[open]!}
              alt={`${title}, фото ${open + 1}`}
              fill
              sizes="100vw"
              unoptimized={!canOptimize(photos[open]!)}
            />
            {total > 1 ? (
              <>
                <button
                  type="button"
                  className="k-lightbox__btn k-lightbox__nav k-lightbox__nav--prev"
                  aria-label="Предыдущее фото"
                  onClick={() => setOpen((open - 1 + total) % total)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="k-lightbox__btn k-lightbox__nav k-lightbox__nav--next"
                  aria-label="Следующее фото"
                  onClick={() => setOpen((open + 1) % total)}
                >
                  →
                </button>
              </>
            ) : null}
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
