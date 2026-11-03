import Link from "next/link";
import { LinkPending } from "@/components/islands/LinkPending.client";
import { FORMS, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";

/** Номера страниц для пагинации: 1 … 4 5 6 … 12. */
function pageList(current: number, total: number): (number | "gap")[] {
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3].forEach((n) => set.add(n));
  if (current >= total - 2) [total - 1, total - 2].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

/** Пагинация ленты номерами страниц в URL (/news?page=2) — индексируется, без JS. */
export function Pager({
  page,
  pages,
  total,
  href,
}: {
  page: number;
  pages: number;
  total: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <>
      <nav className="k-pager" aria-label="Страницы новостей">
        {page > 1 ? (
          <Link href={href(page - 1)} aria-label="Предыдущая страница" rel="prev">
            <LinkPending>←</LinkPending>
          </Link>
        ) : (
          <span className="is-off" aria-hidden>
            ←
          </span>
        )}
        {pageList(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="is-gap" aria-hidden>
              …
            </span>
          ) : (
            <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined}>
              <LinkPending>{n}</LinkPending>
            </Link>
          ),
        )}
        {page < pages ? (
          <Link href={href(page + 1)} aria-label="Следующая страница" rel="next">
            <LinkPending>→</LinkPending>
          </Link>
        ) : (
          <span className="is-off" aria-hidden>
            →
          </span>
        )}
      </nav>
      <p className="k-count" style={{ textAlign: "center", margin: "10px 0 0" }}>
        Страница {page} из {pages} · <b>{total}</b> {plural(total, FORMS.news, DEFAULT_LOCALE)}
      </p>
    </>
  );
}
