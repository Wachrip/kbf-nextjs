// Метаданные страниц в одном месте. openGraph в Next сливается поверхностно: если страница
// задаёт openGraph, родительский заменяется целиком, поэтому общие поля — в каждом вызове.
import type { Metadata } from "next";
import { OG_DEFAULT, SITE_NAME, SITE_NOINDEX } from "./site";

export interface PageMeta {
  /** Путь страницы (без домена) — canonical и og:url. */
  path: string;
  title: string;
  description?: string;
  /** Абсолютные или корневые адреса картинок; нет — og-default.png. */
  images?: (string | undefined)[];
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
}

export function pageMetadata(page: PageMeta): Metadata {
  const images = (page.images ?? []).filter((x): x is string => Boolean(x));
  return {
    title: page.title,
    ...(page.description ? { description: page.description } : {}),
    alternates: { canonical: page.path },
    openGraph: {
      type: page.type ?? "website",
      siteName: SITE_NAME,
      locale: "ru_RU",
      url: page.path,
      title: page.title,
      ...(page.description ? { description: page.description } : {}),
      images: images.length ? images : [{ url: OG_DEFAULT, width: 1200, height: 630 }],
      ...(page.type === "article"
        ? {
            publishedTime: page.publishedTime,
            modifiedTime: page.modifiedTime,
          }
        : {}),
    },
    // Демо — noindex,nofollow везде (страница не перекрывает robots из layout)
    ...(SITE_NOINDEX
      ? { robots: { index: false, follow: false } }
      : page.noindex
        ? { robots: { index: false, follow: true } }
        : {}),
  };
}

/** Метаданные несуществующей записи (страница отдаст 404). */
export const notFoundMeta: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: false },
};
