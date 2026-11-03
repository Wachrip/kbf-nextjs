import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { NavProgress } from "@/components/islands/NavProgress.client";
import { TabBar, TabBarView } from "@/components/islands/TabBar.client";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { OrganizationJsonLd } from "@/components/seo/JsonLd";
import { OG_DEFAULT, SITE_DESCRIPTION, SITE_NAME, SITE_NOINDEX, SITE_URL } from "@/lib/site";
import { manrope, oswald } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s — КБФ` },
  description: SITE_DESCRIPTION,
  applicationName: "КБФ",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ru_RU",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_DEFAULT, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
  // Демо (SITE_NOINDEX=1) — закрыто от индексации
  ...(SITE_NOINDEX ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12172b",
  // env(safe-area-inset-bottom) у нижней панели работает только с viewport-fit=cover
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${oswald.variable}`}>
      <body>
        {/* Первым в body: для клавиатуры и читалок */}
        <a className="k-skip" href="#main">
          Перейти к содержанию
        </a>
        {/* Вне .k-page: container-type ломает position: fixed. useSearchParams — в Suspense */}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <div className="k-page">
          <Header />
          <main className="k-main" id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </div>
        <Suspense fallback={<TabBarView />}>
          <TabBar />
        </Suspense>
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
