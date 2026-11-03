// Какие фото идут через оптимизатор next/image: локальные /images/* и бакет Storage проекта
// (тот же список, что remotePatterns в next.config.ts). Остальные адреса — как есть, иначе
// оптимизатор отклонит их и картинка сломается.
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kbf-site";
const BUCKETS = [`${PROJECT_ID}.firebasestorage.app`, `${PROJECT_ID}.appspot.com`];

export function canOptimize(src: string): boolean {
  // Локальный путь — «/images/x», но не протокол-относительный «//host/x»
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const { hostname, pathname } = new URL(src);
    if (hostname === "firebasestorage.googleapis.com") {
      return BUCKETS.some((b) => pathname.startsWith(`/v0/b/${b}/o/`));
    }
    if (hostname === "storage.googleapis.com") {
      return BUCKETS.some((b) => pathname.startsWith(`/${b}/`));
    }
    return hostname === `${PROJECT_ID}.firebasestorage.app`;
  } catch {
    return false;
  }
}

/** Файл из бакета Storage проекта (https) — только такие PDF встраиваются в iframe. */
export function isStorageUrl(src: string): boolean {
  return /^https:\/\//i.test(src) && canOptimize(src);
}

/** Статичные фото разделов (public/images). */
export const STATIC = {
  logo: "/images/logo-white.png",
  /**
   * Логотип для JSON-LD: знак на navy-квадрате 512×512 (logo-square.png). logo.svg — не знак
   * федерации (другой силуэт), logo-white.png невидим на белом фоне выдачи.
   */
  logoColor: "/images/logo-square.png",
  /** Знак без текста (мяч), белый — шапка и подвал. */
  mark: "/images/logo-mark-white.png",
  hero: "/images/hero-basketball.jpg",
  kids: "/images/kids-training.jpg",
  about: "/images/about-hero.jpg",
  instagram: "/images/instagram.jpeg",
  youtube: "/images/youtube.png",
  og: "/images/og-default.png",
} as const;
