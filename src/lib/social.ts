// Ссылки на соцсети и 2ГИС — правила старого сайта (about_page.dart, gym_detail.dart):
// значение в базе может быть ником, @ником или полным URL.

import type { Region } from "./types";

export type SocialKind = "instagram" | "youtube" | "telegram";

const BASE: Record<SocialKind, string> = {
  instagram: "https://instagram.com/",
  youtube: "https://youtube.com/@",
  telegram: "https://t.me/",
};

export function socialUrl(kind: SocialKind, raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `${BASE[kind]}${v.replace(/^@/, "")}`;
}

/** Подпись: «@kbf.kg» или адрес без протокола. */
export function socialHandle(raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  return v.startsWith("@") ? v : `@${v}`;
}

/**
 * Город 2ГИС по региону: у 2gis.kg свои разделы для Бишкека и Оша (с окрестностями); прочие
 * регионы ищутся из раздела Бишкека с городом в запросе. TODO: сверить разделы 2ГИС для
 * Каракола, Джалал-Абада и т. д., если появятся площадки там.
 */
const GIS_CITY: Partial<Record<Region, string>> = {
  bishkek: "bishkek",
  chui: "bishkek",
  osh: "osh",
  oshRegion: "osh",
  jalalAbad: "osh",
  batken: "osh",
};

/** Поиск в 2ГИС по адресу — когда готовой ссылки (gym.mapUrl) нет. */
export function mapSearchUrl(address: string, city?: string, region?: Region): string {
  const slug = (region && GIS_CITY[region]) ?? "bishkek";
  const c = (city ?? "").trim();
  // Город в запросе, если он не совпадает с разделом 2ГИС (Кант, Каракол…)
  const inSection = !c || c.toLowerCase() === (slug === "osh" ? "ош" : "бишкек");
  const q = inSection ? address : `${c}, ${address}`;
  return `https://2gis.kg/${slug}/search/${encodeURIComponent(q)}`;
}
