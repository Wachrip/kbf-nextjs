import Link from "next/link";
import { LinkPending } from "@/components/islands/LinkPending.client";
import { cx } from "@/lib/cx";

export interface ChipItem {
  label: string;
  href: string;
  current: boolean;
}

/** Чипы-фильтры — ССЫЛКИ с query-параметром, не состояние. */
export function ChipLinks({
  items,
  light = false,
  label,
}: {
  items: ChipItem[];
  light?: boolean;
  label: string;
}) {
  return (
    <nav className={cx("k-chips", light && "k-chips--light")} aria-label={label}>
      {items.map((c) => (
        <Link
          key={c.href}
          className="k-chip"
          href={c.href}
          aria-current={c.current ? "true" : undefined}
          scroll={false}
        >
          <LinkPending>{c.label}</LinkPending>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Фильтр «Регион»: светлые чипы над списком (как амплуа у игроков). «Все» + варианты; меньше
 * двух вариантов — фильтра нет (решает страница, pickFilter). Обёртка — FilterBar (k-fbar)
 * со счётчиком.
 */
export function FilterChips({
  label,
  options,
  current,
  hrefOf,
  allLabel = "Все",
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  current?: string;
  hrefOf: (id?: string) => string;
  allLabel?: string;
}) {
  if (options.length < 2) return null;
  return (
    <ChipLinks
      light
      label={label}
      items={[
        { label: allLabel, href: hrefOf(undefined), current: !current },
        ...options.map((o) => ({ label: o.label, href: hrefOf(o.id), current: o.id === current })),
      ]}
    />
  );
}
