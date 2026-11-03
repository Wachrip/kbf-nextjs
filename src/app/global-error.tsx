"use client";

import "./globals.css";

/**
 * Ошибка в самом layout: свой документ (глобальные стили и шрифты layout сюда не доходят —
 * globals.css подключён здесь, шрифты — системные фолбэки). Тот же вид, что error.tsx.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body>
        <title>Ошибка — КБФ</title>
        <div className="k-page">
          <main className="k-main">
            <section className="k-pagehead">
              <div className="k-wrap k-pagehead__in">
                <div className="k-pagehead__title">
                  <span className="k-eyebrow" style={{ color: "var(--orange)" }}>
                    Ошибка
                  </span>
                  <h1 className="k-d-lg">Сайт временно недоступен</h1>
                  <span className="k-pagehead__sub">Попробуйте обновить страницу через минуту</span>
                </div>
              </div>
            </section>
            <section className="k-section">
              <div className="k-wrap" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="k-btn k-btn--accent" onClick={() => retry()}>
                  Повторить
                </button>
                {/* Обычная ссылка: роутер мог не подняться */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className="k-btn k-btn--outline" href="/">
                  На главную
                </a>
                {error.digest ? (
                  <span className="k-caption" style={{ alignSelf: "center" }}>
                    Код ошибки: {error.digest}
                  </span>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}
