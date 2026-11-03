// Откуда сайт берёт данные. Реализации:
// - firestoreSource — боевая база kbf-site через REST (firestoreSource.ts);
// - mockSource — фикстуры по данным сида админки (mockSource.ts), работает без сети.
// Переключатель — KBF_DATA=firestore|mock (getSource.ts). Объёмы маленькие (команд — десятки,
// игроков и матчей — сотни), поэтому справочники читаются целиком и кэшируются в repo.ts.
import "server-only";
import type {
  AboutInfo,
  Coach,
  Division,
  Game,
  Gym,
  Membership,
  Player,
  Post,
  Team,
  Tournament,
} from "@/lib/types";

/**
 * Новость в списках: без тела статьи и галереи. minutes — время чтения, посчитанное по телу
 * на сервере при чтении страницы ленты (тело в кэш и в HTML не попадает).
 */
export type PostSummary = Omit<Post, "body" | "gallery"> & { minutes?: number };

/**
 * Выборка составов. season — «2026-27»; без season — все сезоны (только вместе с teamId:
 * индекс teamId ASC, season ASC). Хотя бы одно условие обязательно.
 */
export interface MembershipQuery {
  season?: string;
  teamId?: string;
  division?: Division;
}

/** Минимум для sitemap, тегов и generateStaticParams. */
export interface PostIndexItem {
  slug: string;
  tags: string[];
  publishedAt?: string;
  updatedAt?: string;
}

export interface KbfSource {
  /** Опубликованные новости, новые первыми; offset/limit — страница ленты. */
  posts(opts: { offset: number; limit: number; tag?: string }): Promise<PostSummary[]>;
  /** Сколько опубликованных новостей (count через runAggregationQuery). */
  postsCount(tag?: string): Promise<number>;
  /** Одна опубликованная новость целиком. */
  postBySlug(slug: string): Promise<Post | null>;
  postIndex(): Promise<PostIndexItem[]>;
  /** Все игроки без биографии (проекция). */
  players(): Promise<Player[]>;
  /** Игрок целиком, с биографией. */
  playerBySlug(slug: string): Promise<Player | null>;
  teams(): Promise<Team[]>;
  /** Тренеры для списков — без биографии (проекция). */
  coaches(): Promise<Coach[]>;
  /** Тренер целиком, с биографией. */
  coachBySlug(slug: string): Promise<Coach | null>;
  gyms(): Promise<Gym[]>;
  games(): Promise<Game[]>;
  tournaments(): Promise<Tournament[]>;
  about(): Promise<AboutInfo>;
  /** settings/season.current; нет документа или поле невалидно — null (repo выведет по дате). */
  getCurrentSeason(): Promise<string | null>;
  /** Записи составов по условиям (см. MembershipQuery). */
  getMemberships(q: MembershipQuery): Promise<Membership[]>;
  /** Все записи игрока, новые сезоны первыми (индекс playerId ASC, season DESC). */
  getPlayerMemberships(playerId: string): Promise<Membership[]>;
}
