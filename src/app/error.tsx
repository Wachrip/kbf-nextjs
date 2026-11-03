"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ListHero } from "@/components/ui/Heads";
import { QuickLinks } from "@/components/ui/QuickLinks";

/**
 * Ошибка рендера страницы (в том числе недоступный Firestore при поиске записи — repo.ts,
 * strict): в стиле 404 (тёмная шапка концепции А), с кнопкой «Повторить» (retry перечитывает
 * данные сегмента). Шапка и подвал остаются — их рисует layout.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[page]", error.digest ?? "", error.message);
  }, [error]);
  return (
    <>
      <ListHero
        title="Не удалось загрузить страницу"
        eyebrow="Ошибка"
        sub="Похоже, нет связи с базой. Попробуйте ещё раз через минуту"
        chips={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="k-lhero__cta" style={{ border: 0, cursor: "pointer" }} onClick={() => retry()}>
              Повторить
            </button>
            <Link className="k-btn k-btn--cta-ghost" href="/">
              На главную
            </Link>
            {error.digest ? <span className="k-count" style={{ color: "var(--on-dark-3)" }}>Код ошибки: {error.digest}</span> : null}
          </div>
        }
      />
      <QuickLinks title="Пока можно открыть" />
    </>
  );
}
