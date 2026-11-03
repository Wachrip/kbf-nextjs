"use client";

import { useEffect, useState, type ReactNode } from "react";
import { dayKey } from "@/lib/format";

/**
 * Прячет блок «на сегодня», если его день (по Бишкеку) уже прошёл: страница могла прийти из
 * кэша, собранного вчера. Первая отрисовка совпадает с серверной (рассинхрона нет), проверка —
 * после гидрации и раз в минуту.
 */
export function DayGuard({ day, children, fallback = null }: { day: string; children: ReactNode; fallback?: ReactNode }) {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const check = () => setStale(dayKey(Date.now()) > day);
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [day]);
  return <>{stale ? fallback : children}</>;
}
