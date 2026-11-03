import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { CourtArt } from "./Icons";

export interface LinkSpec {
  href: string;
  label: string;
}

/** Кнопка «← Все …» на тёмной шапке или поверх фото (overlay). */
export function BackLink({ href, label, overlay = false }: LinkSpec & { overlay?: boolean }) {
  return (
    <Link className={cx("k-back", overlay && "k-back--overlay")} href={href}>
      ← {label}
    </Link>
  );
}

/** Контурная кнопка «← Все …» в конце страницы — только мобилка. */
export function BackBlock({ href, label }: LinkSpec) {
  return (
    <section className="k-section k-only-m">
      <div className="k-wrap">
        <Link className="k-back-block" href={href}>
          ← {label}
        </Link>
      </div>
    </section>
  );
}

/** Секция страницы с контейнером. */
export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cx("k-section", className)} id={id}>
      <div className="k-wrap">{children}</div>
    </section>
  );
}

/** Заголовок секции на светлом: display-md + ссылка справа. */
export function SecHead({
  title,
  link,
  as: Tag = "h2",
}: {
  title: string;
  link?: LinkSpec;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="k-sechead">
      <Tag className="k-d-md">{title}</Tag>
      {link ? (
        <Link className="k-link" href={link.href}>
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Заголовок блока боковой колонки: label капсом. */
export function LabelHead({ title, link }: { title: string; link?: LinkSpec }) {
  return (
    <div className="k-sechead" style={{ marginBottom: 10 }}>
      <h2 className="k-label" style={{ margin: 0 }}>
        {title}
      </h2>
      {link ? (
        <Link className="k-link" href={link.href}>
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Разделитель групп: label + линия. accent — текущая группа. */
export function Rule({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <div className={cx("k-rule", accent && "k-rule--accent")}>
      <h2 className="k-label" style={{ margin: 0 }}>
        {label}
      </h2>
    </div>
  );
}

/** Пусто: короткая фраза по центру блока. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="k-empty">{children}</p>;
}

/** Плитка-цифра тёмной шапки раздела (.k-lfact): подпись капсом и значение Oswald. */
export interface Fact {
  label: string;
  value: ReactNode;
  /** Одна акцентная (orange) на шапку. */
  accent?: boolean;
}

/**
 * Тёмная шапка раздела концепции А (.k-lhero): navy, разметка площадки фоном, надзаголовок,
 * h1, подзаголовок; цифры из данных справа (десктоп) или под заголовком (мобилка); bar —
 * поля поиска под подзаголовком; chips — строка чипов внизу шапки (+ кнопка k-lhero__cta).
 * back — «← Все …» над заголовком (как в PageHead, правка TeamList). Пустые цифры не
 * выводятся (facts без значений — без блока).
 */
export function ListHero({
  title,
  sub,
  eyebrow,
  facts = [],
  bar,
  chips,
  back,
}: {
  title: string;
  sub?: ReactNode;
  eyebrow?: ReactNode;
  facts?: Fact[];
  bar?: ReactNode;
  chips?: ReactNode;
  back?: LinkSpec;
}) {
  return (
    <section className="k-lhero k-on-dark">
      <CourtArt className="k-lhero__art" />
      <div className="k-wrap">
        {back ? (
          <div className="k-teamhero__top">
            <BackLink {...back} />
          </div>
        ) : null}
        <div className="k-lhero__in">
          <div className="k-lhero__id">
            {eyebrow ? <span className="k-eyebrow">{eyebrow}</span> : null}
            <h1 className="k-d-xl">{title}</h1>
            {sub ? <p className="k-lhero__sub">{sub}</p> : null}
            {bar}
          </div>
          {facts.length ? (
            <div className="k-lhero__facts">
              {facts.map((f) => (
                <div key={f.label} className="k-lfact">
                  <span>{f.label}</span>
                  <b className={f.accent ? "is-accent" : undefined}>{f.value}</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {chips ? <div className="k-lhero__bar">{chips}</div> : null}
      </div>
    </section>
  );
}

/** Строка над списком на светлом (.k-fbar): чипы-фильтры слева, счётчик k-count справа. */
export function FilterBar({ children, count }: { children?: ReactNode; count?: ReactNode }) {
  if (!children && !count) return null;
  return (
    <div className="k-fbar">
      {children}
      {count ? <span className="k-count">{count}</span> : null}
    </div>
  );
}
