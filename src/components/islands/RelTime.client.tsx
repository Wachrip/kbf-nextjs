"use client";

import { useEffect, useState } from "react";
import { LIVE_WINDOW_MS, relativeStart } from "@/lib/live";

/**
 * Время начала матча: на сервере и до гидрации — absolute (разметка совпадает, рассинхрона
 * нет), после — «через 2 ч 10 мин» / «идёт», раз в минуту; дальше 12 часов и прошедшее —
 * снова absolute. Модуль lib/live — без lib/sport и lib/format (лёгкий клиентский бандл).
 */
export function RelTime({ at, absolute }: { at: string; absolute: string }) {
  const [rel, setRel] = useState<string | null>(null);
  useEffect(() => {
    const ms = Date.parse(at);
    const tick = () => setRel(relativeStart(ms, Date.now(), LIVE_WINDOW_MS));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [at]);
  return <time dateTime={at}>{rel ?? absolute}</time>;
}
