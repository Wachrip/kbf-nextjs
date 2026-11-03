"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { canOptimize } from "@/lib/images";

const REDUCED = "(prefers-reduced-motion: reduce)";

/** prefers-reduced-motion без setState в эффекте; на сервере — «уменьшать» (без автопрокрутки). */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
}

/**
 * Фото-шапка площадки (концепция А, .k-gymhero): лента со scroll-snap (свайп на телефоне),
 * стрелки на десктопе, счётчик «1 / 5»; под шапкой — полоса миниатюр всех фото (.k-gthumbs,
 * обе ширины).
 * Автопрокрутка раз в 6 с — только без prefers-reduced-motion; есть кнопка паузы (WCAG 2.2.2),
 * любое действие пользователя её останавливает. Счётчик объявляется читалкам (aria-live)
 * только после действий пользователя, не на каждом автослайде. При reduced-motion прокрутка
 * мгновенная. Подписи и кнопки поверх фото приходят с сервера (children, top).
 */
export function GymGallery({
  photos,
  name,
  top,
  children,
}: {
  photos: string[];
  name: string;
  top: ReactNode;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userActed, setUserActed] = useState(false);
  const reduced = useReducedMotion();
  const total = photos.length;
  const autoplay = total > 1 && !reduced;
  const playing = autoplay && !paused;

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || total === 0) return;
      const next = (i + total) % total;
      el.scrollTo({ left: next * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
    },
    [total, reduced],
  );

  /** Действие пользователя: останавливает автопрокрутку и включает объявления счётчика. */
  const act = useCallback(() => {
    setPaused(true);
    setUserActed(true);
  }, []);

  // Индекс по прокрутке (свайп, стрелки, клавиатура, автопрокрутка)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        setIndex(Math.min(total - 1, Math.max(0, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [total]);

  // Активная миниатюра — в зоне видимости ленты миниатюр
  useEffect(() => {
    const strip = thumbs.current;
    const btn = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !btn) return;
    const left = btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2;
    strip.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  }, [index, reduced]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => go(index + 1), 6000);
    return () => clearInterval(t);
  }, [go, index, playing]);

  return (
    <>
      <div className="k-photo k-gymhero">
        <div
          ref={track}
          className="k-gallery"
          tabIndex={total > 1 ? 0 : -1}
          aria-roledescription="галерея"
          aria-label={`Фото: ${name}`}
          onPointerDown={act}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              act();
              go(index + 1);
            }
            if (e.key === "ArrowLeft") {
              act();
              go(index - 1);
            }
          }}
        >
          {photos.map((src, i) => (
            <div
              key={i}
              className="k-gallery__slide"
              role="group"
              aria-roledescription="слайд"
              aria-label={`${i + 1} из ${total}`}
            >
              <Image
                src={src}
                alt={i === 0 ? name : ""}
                fill
                sizes="100vw"
                unoptimized={!canOptimize(src)}
                fetchPriority={i === 0 ? "high" : undefined}
                loading={i === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
        <div className="k-photo__top">
          {top}
          {total > 1 ? (
            <span style={{ display: "flex", gap: 8 }}>
              {autoplay ? (
                <button
                  type="button"
                  className="k-back k-back--overlay"
                  style={{ cursor: "pointer" }}
                  aria-pressed={paused}
                  onClick={() => {
                    setUserActed(true);
                    setPaused((p) => !p);
                  }}
                >
                  {paused ? "Листать" : "Пауза"}
                </button>
              ) : null}
              <span className="k-gymhero__count" aria-live={userActed ? "polite" : "off"} aria-atomic="true">
                {index + 1} / {total}
              </span>
            </span>
          ) : null}
        </div>
        {total > 1 ? (
          <>
            <button
              type="button"
              className="k-gallery__nav k-gallery__nav--prev"
              aria-label="Предыдущее фото"
              onClick={() => {
                act();
                go(index - 1);
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="k-gallery__nav k-gallery__nav--next"
              aria-label="Следующее фото"
              onClick={() => {
                act();
                go(index + 1);
              }}
            >
              →
            </button>
          </>
        ) : null}
        <div className="k-photo__veil">
          {children}
        </div>
      </div>
      {total > 1 ? (
        <nav className="k-gthumbs" aria-label="Фото площадки">
          <div ref={thumbs} className="k-gthumbs__in">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Фото ${i + 1} из ${total}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => {
                  act();
                  go(i);
                }}
              >
                <Image src={src} alt="" fill sizes="(min-width: 1024px) 120px, 76px" unoptimized={!canOptimize(src)} />
              </button>
            ))}
          </div>
        </nav>
      ) : null}
    </>
  );
}
