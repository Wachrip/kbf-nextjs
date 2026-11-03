// Окно «матч идёт» и относительное время начала — без зависимостей: этот модуль тянет
// клиентский островок RelTime, ему не нужны lib/sport и lib/format целиком.

/** Матч считается идущим (или «ещё впереди») не дольше 3 часов от начала. */
export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
/** live дольше 4 часов от начала — статус забыли сменить; ближайшим такой матч не считается. */
export const LIVE_STALE_MS = 4 * 60 * 60 * 1000;

const pluralRu = (n: number, forms: readonly [string, string, string]) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
};

/**
 * Относительное время матча: «через 25 минут», «через 2 ч 10 мин», «идёт» (начался не позже
 * liveMs назад); дальше 12 часов или в прошлом — null (показывается абсолютное время).
 */
export function relativeStart(at: number, now: number, liveMs: number = LIVE_WINDOW_MS): string | null {
  const diff = at - now;
  if (diff <= 0) return -diff <= liveMs ? "идёт" : null;
  const min = Math.ceil(diff / 60000);
  if (min > 12 * 60) return null;
  if (min < 60) return `через ${min} ${pluralRu(min, ["минута", "минуты", "минут"])}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `через ${h} ч ${m} мин` : `через ${h} ${pluralRu(h, ["час", "часа", "часов"])}`;
}
