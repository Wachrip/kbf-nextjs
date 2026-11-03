import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Kit } from "@/lib/teamPalette";
import { Shirt } from "./Shirt";

/**
 * Карточка игрока в составе (концепция А, .k-pcard): майка в цвете тёмной формы с номером
 * (номер строкой как есть; без номера — инициалы), имя, амплуа и факты. gone — «Покинули
 * команду» (приглушённо). Цвета — переменные --team… на родителе (teamVars).
 */
export function PlayerCard({
  href,
  name,
  number,
  initials,
  kit,
  trim,
  codes,
  meta,
  extra,
  gone = false,
  style,
  hidden,
}: {
  href?: string;
  name: string;
  number?: string;
  initials: string;
  kit: Kit;
  trim?: string;
  codes?: string;
  meta?: string;
  /** Строка под именем (команда — в списке игроков). */
  extra?: ReactNode;
  gone?: boolean;
  /** Цвета команды карточки (teamVars) — в списке игроков у каждой карточки своя команда. */
  style?: CSSProperties;
  /** Карточка в HTML, но скрыта (список «Показать ещё» — ссылки доступны без JS). */
  hidden?: boolean;
}) {
  const inner = (
    <>
      <span className="k-pcard__kit">
        <Shirt kit={kit} label={number ?? initials} trim={trim} />
      </span>
      <span className="k-pcard__body">
        <span className="k-pcard__name">
          {name}
          {number != null ? <span className="k-sr">, номер {number}</span> : null}
        </span>
        {extra}
        {codes || meta ? (
          <span className="k-meta">
            {codes ? <span className="k-pos">{codes}</span> : null}
            {codes && meta ? "  " : null}
            {meta}
          </span>
        ) : null}
      </span>
      {href ? (
        <span className="k-arrow" aria-hidden>
          →
        </span>
      ) : null}
    </>
  );
  const cls = cx("k-card k-pcard", gone && "is-gone");
  return href ? (
    <Link className={cls} href={href} style={style} hidden={hidden}>
      {inner}
    </Link>
  ) : (
    <div className={cls} style={style} hidden={hidden}>
      {inner}
    </div>
  );
}
