import type { ReactNode } from "react";
import { Icon } from "./Icons";

/**
 * Заглушка вместо блоков FIBA LiveStats (лидеры, статистика игрока, сравнение команд,
 * онлайн-статистика): выдуманных цифр на сайте нет. Одна аккуратная карточка; компоненты
 * под данные (Leaders, SeasonStats) выводятся, только когда данные есть.
 */
export function FibaStub({ title = "Статистика", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="k-card k-fibastub">
      <span className="k-fibastub__icon">
        <Icon name="chart" />
      </span>
      <span className="k-fibastub__body">
        <span className="k-title">{title}</span>
        <span className="k-meta">{children ?? "Статистика появится после подключения FIBA LiveStats"}</span>
      </span>
    </div>
  );
}

export interface LeaderItem {
  category: string;
  value: string;
  unit?: string;
  who: string;
  /** Майка игрока (уже готовая разметка Shirt). */
  shirt?: ReactNode;
}

/** Лидеры (.k-leaders) — только при наличии данных FIBA; пусто — ничего (вызывающий покажет FibaStub). */
export function Leaders({ items }: { items: LeaderItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="k-leaders">
      {items.map((l) => (
        <div key={l.category} className="k-card k-leader">
          <span className="k-eyebrow">{l.category}</span>
          <span className="k-leader__val">
            {l.value}
            {l.unit ? <small>{l.unit}</small> : null}
          </span>
          <span className="k-leader__who">
            {l.shirt}
            <b>{l.who}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SeasonStat {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}

/** Статистика сезона игрока (.k-sstats) — только при наличии данных. */
export function SeasonStats({ items }: { items: SeasonStat[] }) {
  if (items.length === 0) return null;
  return (
    <div className="k-sstats">
      {items.map((s) => (
        <div key={s.label} className={s.accent ? "k-card k-sstat is-accent" : "k-card k-sstat"}>
          <span className="k-eyebrow">{s.label}</span>
          <b>{s.value}</b>
          {s.note ? <span className="k-caption">{s.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
