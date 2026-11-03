import type { Metadata } from "next";
import { ListHero } from "@/components/ui/Heads";
import { QuickLinks } from "@/components/ui/QuickLinks";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: false },
};

/** 404 в стиле концепции А: тёмная шапка раздела и разделы карточками «Я хочу». */
export default function NotFound() {
  return (
    <>
      <ListHero
        title="Страница не найдена"
        eyebrow="Ошибка 404"
        sub="Возможно, адрес изменился или запись удалена из базы"
        facts={[{ label: "Код", value: "404", accent: true }]}
      />
      <QuickLinks />
    </>
  );
}
