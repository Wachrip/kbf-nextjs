import type { NextConfig } from "next";

/**
 * Фото загружает админка в Storage проекта kbf-site. Оптимизатор принимает только этот бакет:
 * иначе /_next/image стал бы открытым ресайзером чужих картинок. Тот же список — в
 * src/lib/images.ts (фото с других адресов отдаются без оптимизации).
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "kbf-site";
const BUCKETS = [`${PROJECT_ID}.firebasestorage.app`, `${PROJECT_ID}.appspot.com`];

/** Демо (SITE_NOINDEX=1): X-Robots-Tag на всех ответах, включая файлы и картинки. */
const NOINDEX = process.env.SITE_NOINDEX === "1";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Только запрет встраивания чужими сайтами; полный CSP — после аудита скриптов
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  ...(NOINDEX ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  partialPrefetching: true,
  async redirects() {
    return [
      // Старый адрес календаря из Jaspr-версии
      { source: "/calendar", destination: "/games", permanent: true },
      { source: "/calendar/:path*", destination: "/games", permanent: true },
    ];
  },
  images: {
    // Явно: адаптер App Hosting без этого выключает оптимизатор
    unoptimized: false,
    remotePatterns: [
      ...BUCKETS.map((bucket) => ({
        protocol: "https" as const,
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${bucket}/o/**`,
      })),
      ...BUCKETS.map((bucket) => ({
        protocol: "https" as const,
        hostname: "storage.googleapis.com",
        pathname: `/${bucket}/**`,
      })),
      { protocol: "https" as const, hostname: `${PROJECT_ID}.firebasestorage.app` },
    ],
    maximumDiskCacheSize: 128 * 1024 * 1024,
    maximumResponseBody: 10 * 1024 * 1024,
    formats: ["image/avif", "image/webp"],
    // Мобилка 390 (основная аудитория), планшет, десктоп до 1440 и полноширинные шапки
    deviceSizes: [390, 640, 828, 1080, 1440, 1920],
    imageSizes: [48, 64, 96, 128, 256, 384],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
