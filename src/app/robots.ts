import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_NOINDEX, SITE_URL, SITE_URL_MISSING } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Демо (SITE_NOINDEX=1): индексация закрыта целиком
  if (SITE_NOINDEX) return { rules: [{ userAgent: "*", disallow: "/" }] };
  if (SITE_URL_MISSING) {
    console.error("[seo] NEXT_PUBLIC_SITE_URL не задан — индексация закрыта в robots.txt");
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
