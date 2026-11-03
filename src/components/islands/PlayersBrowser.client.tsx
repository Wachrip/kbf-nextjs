"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { FilterBar } from "@/components/ui/Heads";
import { Icon } from "@/components/ui/Icons";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { FORMS, initialsOf, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { POSITIONS, positionCodes } from "@/lib/labels";
import { paths } from "@/lib/routes";
import { teamColors, teamVars } from "@/lib/teamPalette";
import type { PlayerPosition, Team } from "@/lib/types";

/** Игрок в списке — лёгкие поля (пропс островка). Цвета и подписи считаются здесь. */
export interface PlayerLite {
  slug: string;
  /** «Фамилия Имя» */
  name: string;
  positions: PlayerPosition[];
  /** Все команды игрока в сезоне — фильтр «Команда». */
  teamIds: string[];
  /** Команды этого дивизиона — подпись под именем; пусто — «Без команды». */
  own: string[];
  /** Команда, в форме которой майка (дивизиона, иначе любая); нет — navy. */
  kitTeam?: string;
  number?: string;
  height?: number;
  /** Год рождения (день и месяц не выводятся). */
  birthYear?: number;
  isActive: boolean;
}

/** Лёгкая карта команд: название и цвета формы (teamColors считается на клиенте один раз на команду). */
export type TeamLite = Pick<Team, "id" | "name" | "color" | "kitLight" | "kitDark">;

const STEP = 12;

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

interface State {
  players: PlayerLite[];
  teams: TeamLite[];
  /** Команды дивизиона — варианты «Команда». */
  options: TeamLite[];
  query: string;
  team: string;
  year: string;
  position: PlayerPosition | "";
  limit: number;
  set: (patch: Partial<Pick<State, "query" | "team" | "year" | "position" | "limit">>) => void;
}

const Ctx = createContext<State | null>(null);

function useFilters(): State {
  const s = useContext(Ctx);
  if (!s) throw new Error("PlayersFilters: нет провайдера");
  return s;
}

/**
 * Состояние фильтров списка игроков: поиск по имени, команда, год рождения, амплуа и лимит
 * «Показать ещё». Шапка (ListHero) рендерится на сервере и приходит children; поля внутри
 * неё — PlayerFields, сетка — PlayerResults. Фильтрует уже загруженный список, без запросов.
 */
export function PlayersFilters({
  players,
  teams,
  options,
  children,
}: {
  players: PlayerLite[];
  teams: TeamLite[];
  options: string[];
  children: ReactNode;
}) {
  const [f, setF] = useState({ query: "", team: "", year: "", position: "" as PlayerPosition | "", limit: STEP });
  const value = useMemo<State>(() => {
    const byId = new Map(teams.map((t) => [t.id, t]));
    return {
      players,
      teams,
      options: options.map((id) => byId.get(id)).filter((t): t is TeamLite => Boolean(t)),
      ...f,
      // Любая смена фильтра возвращает лимит к первой странице
      set: (patch) => setF((s) => ({ ...s, ...patch, limit: patch.limit ?? STEP })),
    };
  }, [players, teams, options, f]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Поля в тёмной шапке: поиск, команда (от двух команд), год рождения (от двух лет). */
export function PlayerFields() {
  const { players, options, query, team, year, set } = useFilters();
  const years = useMemo(
    () => [...new Set(players.map((p) => p.birthYear).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [players],
  );
  return (
    <div className="k-fields">
      <label className="k-dsearch">
        <span className="k-sr">Поиск по имени или фамилии</span>
        <Icon name="search" className="" />
        <input
          type="search"
          value={query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Поиск по имени или фамилии"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      {options.length > 1 ? (
        <label className="k-selectbox">
          <span className="k-sr">Команда</span>
          <select value={team} onChange={(e) => set({ team: e.target.value })}>
            <option value="">Все команды</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {years.length > 1 ? (
        <label className="k-selectbox">
          <span className="k-sr">Год рождения</span>
          <select value={year} onChange={(e) => set({ year: e.target.value })}>
            <option value="">Любой год рождения</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y} г. р.
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

/**
 * Амплуа и счётчик над сеткой, карточки с майкой и номером (концепция А: майка вместо фото в
 * списках), «Показать ещё». Все карточки — в HTML (ссылки доступны без JS), сверх лимита —
 * hidden. Цвета формы — teamColors по лёгкой карте команд, один раз на команду.
 */
export function PlayerResults() {
  const { players, teams, query, team, year, position, limit, set } = useFilters();
  const q = useDeferredValue(normalize(query));
  const looks = useMemo(() => {
    const m = new Map<string, { colors: ReturnType<typeof teamColors>; vars: ReturnType<typeof teamVars>; name: string }>();
    for (const t of teams) m.set(t.id, { colors: teamColors(t), vars: teamVars(t), name: t.name });
    return m;
  }, [teams]);
  const fallback = useMemo(() => ({ colors: teamColors(null), vars: teamVars(null) }), []);

  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (!q || normalize(p.name).includes(q)) &&
          (!team || p.teamIds.includes(team)) &&
          (!year || String(p.birthYear) === year) &&
          (!position || p.positions.includes(position)),
      ),
    [players, q, team, year, position],
  );
  const shownCount = Math.min(limit, filtered.length);
  const dirty = query !== "" || team !== "" || year !== "" || position !== "";

  return (
    <section className="k-section">
      <div className="k-wrap">
        <FilterBar
          count={
            <>
              <span aria-live="polite">
                {plural(filtered.length, FORMS.found, DEFAULT_LOCALE)} <b>{filtered.length}</b> · по алфавиту
              </span>
              {/* «Сбросить» — вне aria-live: читалка объявляет только число */}
              {dirty ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="k-link"
                    onClick={() => set({ query: "", team: "", year: "", position: "" })}
                    style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
                  >
                    Сбросить
                  </button>
                </>
              ) : null}
            </>
          }
        >
          <div className="k-chips k-chips--light" role="group" aria-label="Амплуа">
            <button type="button" className="k-chip" aria-pressed={position === ""} onClick={() => set({ position: "" })}>
              Все амплуа
            </button>
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="k-chip"
                aria-pressed={position === p.id}
                title={p.label}
                onClick={() => set({ position: position === p.id ? "" : p.id })}
              >
                {p.code}
              </button>
            ))}
          </div>
        </FilterBar>

        {filtered.length === 0 ? (
          <p className="k-empty">{players.length === 0 ? "Игроков пока нет" : "Никого не нашли — измените фильтры"}</p>
        ) : (
          <div className="k-pgrid">
            {filtered.map((p, i) => {
              const look = (p.kitTeam && looks.get(p.kitTeam)) || fallback;
              const label = p.own.map((id) => looks.get(id)?.name).filter(Boolean).join(", ") || "Без команды";
              return (
                <PlayerCard
                  key={p.slug}
                  href={paths.player(p.slug)}
                  name={p.name}
                  number={p.number}
                  initials={initialsOf(p.name)}
                  kit={look.colors.dark}
                  trim={look.colors.light.fill}
                  codes={positionCodes(p.positions)}
                  meta={[p.height ? `${p.height} см` : "", p.birthYear ? `${p.birthYear} г. р.` : ""].filter(Boolean).join(" · ")}
                  style={look.vars}
                  hidden={i >= limit}
                  gone={!p.isActive}
                  extra={
                    <span className="k-pteam">
                      <span className="k-dot" aria-hidden />
                      {label}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}

        {filtered.length > shownCount ? (
          <div className="k-loadmore">
            <button type="button" className="k-btn k-btn--outline" onClick={() => set({ limit: limit + STEP })}>
              Показать ещё {Math.min(STEP, filtered.length - shownCount)}
            </button>
            <span className="k-count">
              Показано <b>{shownCount}</b> из {filtered.length}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
