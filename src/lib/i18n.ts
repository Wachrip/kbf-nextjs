// Подготовка к языкам. Сейчас язык один — русский: маршрутов [lang] нет, все вызовы
// форматирования передают DEFAULT_LOCALE. Будущая схема (cookie lang, /ky/..., hreflang) —
// в README, «Языки».
import type { Translations } from "./types";

export type Locale = "ru";

export const LOCALES: readonly Locale[] = ["ru"];

export const DEFAULT_LOCALE: Locale = "ru";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Тег языка для Intl и <html lang>. */
export function intlLocale(locale: Locale): string {
  return locale;
}

type WithTr = { tr?: Translations };

/**
 * Поле на нужном языке: tr.<locale>.<field>, если он есть и того же вида (строка — непустая,
 * список строк — непустой), иначе основное (русское) поле. Для русского tr не читается.
 */
export function pickTr<T extends WithTr, K extends Exclude<keyof T, "tr"> & string>(
  entity: T,
  field: K,
  locale: Locale,
): T[K] {
  const base = entity[field];
  if (locale === DEFAULT_LOCALE) return base;
  const v = entity.tr?.[locale]?.[field];
  if (typeof v === "string" && v.trim() !== "") return v as T[K];
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) return v as T[K];
  return base;
}

/**
 * Копия сущности с переводимыми полями на нужном языке (pickTr для каждого). Для русского —
 * та же сущность без копирования.
 */
export function localized<T extends WithTr, K extends Exclude<keyof T, "tr"> & string>(
  entity: T,
  fields: readonly K[],
  locale: Locale,
): T {
  if (locale === DEFAULT_LOCALE) return entity;
  const out = { ...entity };
  for (const f of fields) out[f] = pickTr(entity, f, locale);
  return out;
}
