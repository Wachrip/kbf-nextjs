import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Строка-карточка: медиа слева, надзаголовок/заголовок/подписи, стрелка. Вся карточка — одна
 * ссылка (или div без href). muted — архив, dark — акцентная тёмная карточка.
 */
export function RowCard({
  href,
  title,
  meta,
  meta2,
  media,
  eyebrow,
  accent = false,
  variant,
  external = false,
  arrow = true,
  teamColor,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  meta2?: ReactNode;
  media?: ReactNode;
  eyebrow?: ReactNode;
  accent?: boolean;
  variant?: "muted" | "dark";
  external?: boolean;
  arrow?: boolean;
  /** Карточка команды: тонкая полоса основного цвета слева (teamColors(team).color). */
  teamColor?: string;
}) {
  const cls = cx("k-card", variant && `k-card--${variant}`, "k-row", teamColor && "k-row--team");
  const style = teamColor ? ({ "--team": teamColor } as CSSProperties) : undefined;
  const inner = (
    <>
      {media}
      <span className="k-row__body">
        {eyebrow ? (
          <span className={cx("k-eyebrow", accent && "k-eyebrow--accent")}>{eyebrow}</span>
        ) : null}
        <span className="k-row__title">{title}</span>
        {meta ? <span className="k-meta">{meta}</span> : null}
        {meta2 ? <span className="k-meta">{meta2}</span> : null}
      </span>
      {href && arrow ? (
        <span className="k-arrow" aria-hidden>
          →
        </span>
      ) : null}
    </>
  );
  if (!href)
    return (
      <div className={cls} style={style}>
        {inner}
      </div>
    );
  if (external)
    return (
      <a className={cls} style={style} href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  return (
    <Link className={cls} style={style} href={href}>
      {inner}
    </Link>
  );
}

/** Плитка статистики: подпись eyebrow над значением (Oswald). */
export function StatBox({
  label,
  value,
  unit,
  dark = false,
  center = false,
  accent = false,
  large = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  dark?: boolean;
  center?: boolean;
  accent?: boolean;
  /** «О федерации»: крупная цифра stat-lg над подписью. */
  large?: boolean;
}) {
  const cls = cx("k-statbox", dark && "k-statbox--dark", center && "k-statbox--center");
  if (large) {
    return (
      <div className={cls}>
        <span className="k-stat-lg">{value}</span>
        <span className="k-eyebrow">{label}</span>
      </div>
    );
  }
  return (
    <div className={cls}>
      <span className="k-eyebrow">{label}</span>
      <span className={cx("k-stat", accent && "is-accent")}>{value}</span>
      {unit ? <span className="k-statbox__unit">{unit}</span> : null}
    </div>
  );
}

export function Stats({
  children,
  n = 3,
  fixed = false,
  className,
  style,
}: {
  children: ReactNode;
  n?: number;
  fixed?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("k-stats", fixed && "k-stats--fixed", className)}
      style={{ ["--n" as string]: n, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Нумерованный список «01 02 03». */
export function NumList({ items }: { items: string[] }) {
  return (
    <div className="k-card k-numlist">
      <ol>
        {items.map((t, i) => (
          <li key={`${i}-${t}`}>
            <span className="k-num">{String(i + 1).padStart(2, "0")}</span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}
