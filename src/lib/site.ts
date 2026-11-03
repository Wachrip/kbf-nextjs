// Адрес сайта для canonical, Open Graph, sitemap и JSON-LD — одна переменная окружения.
const DEFAULT_SITE_URL = "http://localhost:3000";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

/**
 * Адрес сайта не задан в production: canonical и sitemap указывали бы на localhost. Тогда
 * robots.txt закрывает индексацию целиком (app/robots.ts), пока переменную не зададут.
 */
export const SITE_URL_MISSING = !process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production";

/**
 * Демо-режим: SITE_NOINDEX=1 закрывает сайт от поисковиков целиком — robots.txt disallow,
 * meta robots noindex,nofollow, заголовок X-Robots-Tag (next.config.ts). Снять при запуске.
 */
export const SITE_NOINDEX = process.env.SITE_NOINDEX === "1";

export const SITE_NAME = "Кыргызская баскетбольная федерация";
export const SITE_SHORT = "КБФ";
export const SITE_DESCRIPTION =
  "Официальный сайт Кыргызской баскетбольной федерации: календарь матчей, турнирные таблицы, команды, игроки, тренеры и площадки.";
export const OG_DEFAULT = "/images/og-default.png";
/** Год основания и членство — статичный текст (в модели этих полей нет). */
export const FOUNDED_YEAR = 2019;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
