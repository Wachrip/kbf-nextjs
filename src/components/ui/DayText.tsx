import { DayGuard } from "@/components/islands/DayGuard.client";
import { dayKey, dayLabel, dayLabelAbsolute, dayLabelShort } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * Понятная дата матча: «Сегодня / Завтра / Вчера», иначе «Сб, 7 ноября». Относительная подпись
 * считается от now сервера (кэш): если страница пришла из кэша прошлого дня, DayGuard после
 * гидрации заменяет её абсолютной датой. Абсолютная дата — без островка.
 */
export function DayText({ at, now, short = false }: { at: string; now: number; short?: boolean }) {
  const label = short ? dayLabelShort(at, now, DEFAULT_LOCALE) : dayLabel(at, now, DEFAULT_LOCALE);
  const absolute = dayLabelAbsolute(at, now, DEFAULT_LOCALE, short);
  if (label === absolute) return <>{label}</>;
  return (
    <DayGuard day={dayKey(now)} fallback={absolute}>
      {label}
    </DayGuard>
  );
}
