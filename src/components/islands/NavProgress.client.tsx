"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Короче — полоску не показываем (быстрые переходы не мигают). */
const SHOW_AFTER_MS = 150;
/** Навигация не случилась (ошибка, отмена) — полоска убирается сама. */
const GIVE_UP_MS = 15000;
/** Сколько длится «добегание» до конца перед исчезновением. */
const FINISH_MS = 400;

type State = "idle" | "loading" | "done";

/** Адрес без хэша — для сравнения «та же страница». */
const keyOf = (u: URL) => `${u.pathname}${u.search}`;

/**
 * Глобальная полоска перехода сверху. Старт — capture-обработчик click на document (любая
 * внутренняя ссылка, в том числе <Link> из серверных компонентов — onNavigate пришлось бы
 * добавлять в каждый Link), submit GET-форм того же origin и back/forward (popstate). Финиш —
 * смена pathname или search (usePathname/useSearchParams; островок стоит в <Suspense>).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<State>("idle");
  const timers = useRef<{ show?: number; giveUp?: number; reset?: number }>({});

  const clear = () => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearTimeout(t.giveUp);
    window.clearTimeout(t.reset);
    timers.current = {};
  };

  // Финиш: адрес сменился
  useEffect(() => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearTimeout(t.giveUp);
    t.show = t.giveUp = undefined;
    setState((s) => {
      if (s !== "loading") return "idle";
      t.reset = window.setTimeout(() => setState("idle"), FINISH_MS);
      return "done";
    });
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      clear();
      const t = timers.current;
      t.show = window.setTimeout(() => setState("loading"), SHOW_AFTER_MS);
      t.giveUp = window.setTimeout(() => {
        clear();
        setState("idle");
      }, GIVE_UP_MS);
    };

    const sameDoc = (url: URL) => url.origin === window.location.origin;
    const here = () => keyOf(new URL(window.location.href));

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (!sameDoc(url) || !/^https?:$/.test(url.protocol)) return;
      // Якорь на той же странице и ссылка на текущий адрес — навигации не будет
      if (keyOf(url) === here()) return;
      start();
    };

    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const form = e.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() !== "get" || (form.target && form.target !== "_self")) return;
      const url = new URL(form.action || window.location.href, window.location.href);
      if (sameDoc(url)) start();
    };

    const onPop = () => start();

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPop);
      clear();
    };
  }, []);

  return <div className="k-navprogress" data-state={state} aria-hidden />;
}
