"use client";

import { useEffect, useState } from "react";

/**
 * Стрелки ленты матчей (только десктоп, CSS) и стартовая позиция: после гидрации лента
 * прокручивается к первому сегодняшнему матчу (data-today), без анимации. Без JS кнопки
 * скрыты (hidden), лента — обычный горизонтальный скролл.
 */
export function TickerNav({ trackId }: { trackId: string }) {
  const [ready, setReady] = useState(false);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const track = document.getElementById(trackId);
    if (!track) return;
    const first = track.querySelector<HTMLElement>("[data-today]");
    if (first) track.scrollLeft = Math.max(0, first.offsetLeft - track.offsetLeft - 44);
    const update = () =>
      setEdge({ start: track.scrollLeft <= 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    // Состояние — в колбэке кадра, не синхронно в эффекте
    const raf = requestAnimationFrame(() => {
      update();
      setReady(true);
    });
    track.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("scroll", update);
    };
  }, [trackId]);

  const go = (dir: -1 | 1) => {
    const track = document.getElementById(trackId);
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="k-ticker__nav" hidden={!ready}>
      <button type="button" aria-label="Предыдущие матчи" aria-controls={trackId} disabled={edge.start} onClick={() => go(-1)}>
        ←
      </button>
      <button type="button" aria-label="Следующие матчи" aria-controls={trackId} disabled={edge.end} onClick={() => go(1)}>
        →
      </button>
    </div>
  );
}
