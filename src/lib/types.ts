// Сущности сайта — один в один с packages/core (Dart) и мапперами админки
// (apps/admin/lib/features/*/data/*mapper*.dart). Имена полей = имена в Firestore.
// Даты — ISO-строки: Timestamp из REST приходит строкой, и так значения сериализуются в кэш
// «use cache» и в пропсы клиентских островков. Перечисления — enum.name из Dart.

export type IsoDate = string;

export type Division = "adult" | "u18" | "u16";
export type GameStatus = "scheduled" | "live" | "finished" | "cancelled";
export type TournamentStatus = "upcoming" | "ongoing" | "finished";
export type TournamentType = "league" | "cup" | "playoff";
export type PostSource = "internal" | "telegram" | "instagram";
export type PlayerPosition =
  | "pointGuard"
  | "shootingGuard"
  | "smallForward"
  | "powerForward"
  | "center";
/** gyms.type (GymType в core). Нет поля — тип выводится из capacity (labels.ts, gymType). */
export type GymType = "indoor" | "outdoor";
/** Region в core; в Firestore — enum.name. Подписи — labels.ts (REGIONS). */
export type Region =
  | "bishkek"
  | "osh"
  | "chui"
  | "issykKul"
  | "naryn"
  | "talas"
  | "jalalAbad"
  | "oshRegion"
  | "batken";

/**
 * Переводы `tr: { <lang>: { <field>: value } }` (например tr.ky.title). Русский — основные поля
 * документа, в tr его нет. Читать через pickTr (lib/i18n.ts).
 */
export type Translations = Record<string, Record<string, unknown>>;

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  /** markdown */
  body?: string;
  coverUrl?: string;
  source: PostSource;
  sourceUrl?: string;
  publishedAt?: IsoDate;
  isPublished: boolean;
  tags: string[];
  /** posts.gallery — фото галереи новости (в core — List<String>, по умолчанию пустой). */
  gallery?: string[];
  /** title, excerpt, body */
  tr?: Translations;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface Player {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  birthDate?: IsoDate;
  height?: number;
  weight?: number;
  positions: PlayerPosition[];
  teamIds: string[];
  /**
   * Денормализация: команды активных записей memberships текущего сезона (пересчитывает
   * админка). Сайт берёт состав из memberships, teamIds — запасной вариант без них.
   */
  teamNames: string[];
  bio?: string;
  isActive: boolean;
  /** bio */
  tr?: Translations;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  city?: string;
  logoUrl?: string;
  coachId?: string;
  coachName?: string;
  gymId?: string;
  gymName?: string;
  division: Division;
  foundedYear?: number;
  description?: string;
  /** В форме админки обязателен; у старых документов может не быть. */
  region?: Region;
  /** «#RRGGBB»: основной цвет клуба, светлая и тёмная форма (lib/teamPalette.ts, фолбэки там). */
  color?: string;
  kitLight?: string;
  kitDark?: string;
  /** description */
  tr?: Translations;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface Coach {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  bio?: string;
  achievements: string[];
  /** E.164; из него же ссылка WhatsApp. */
  phone?: string;
  contactNote?: string;
  /** bio, achievements (список) */
  tr?: Translations;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface Gym {
  id: string;
  slug: string;
  name: string;
  city?: string;
  address?: string;
  /** Ссылка на 2ГИС. */
  mapUrl?: string;
  capacity?: number;
  phone?: string;
  instagram?: string;
  photoUrls: string[];
  type?: GymType;
  region?: Region;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface Game {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  gymId: string;
  gymName: string;
  division: Division;
  scheduledAt: IsoDate;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  tournamentId?: string;
  round?: number;
  stage?: string;
  statsPdfUrl?: string;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

/** Строка турнирной таблицы. Хранится в документе турнира, считает админка. */
export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  /** «2026-27» (lib/season.ts); старые записи «2026/27» приводятся к нему при чтении. */
  season: string;
  division: Division;
  /** Нет — республиканский турнир. */
  region?: Region;
  /** name */
  tr?: Translations;
  type: TournamentType;
  status: TournamentStatus;
  standings: StandingRow[];
  startDate?: IsoDate;
  endDate?: IsoDate;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface StaffMember {
  role: string;
  name: string;
  photoUrl?: string;
}

/** settings/about */
export interface AboutInfo {
  /** markdown: история и миссия одним полем */
  history?: string;
  phone?: string;
  email?: string;
  address?: string;
  staff: StaffMember[];
  /** markdown; на сайте пока не показываем */
  requisites?: string;
  instagram?: string;
  youtube?: string;
  telegram?: string;
  /** history */
  tr?: Translations;
  updatedAt?: IsoDate;
}

/**
 * memberships/{autoId} — запись игрока в составе команды за сезон. Активная — сезон текущий и
 * to нет. У игрока не больше одной активной записи в дивизионе; номер уникален среди
 * активных записей teamId + season. Пишет только админка.
 */
export interface Membership {
  id: string;
  playerId: string;
  /** «Имя Фамилия», денормализация */
  playerName: string;
  teamId: string;
  teamName: string;
  /** Копия дивизиона команды на момент записи. */
  division: Division;
  /** «2026-27» */
  season: string;
  /**
   * Игровой номер в этой команде в этом сезоне — строка из 1–2 цифр: «0» и «00» разные,
   * допустимы «0»…«9» и «00»…«99». В Firestore — string | null; нет поля — без номера.
   */
  number?: string;
  /** Нет — с начала сезона. */
  from?: IsoDate;
  /** Нет — до конца сезона / играет сейчас. */
  to?: IsoDate;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

/** settings/season */
export interface SeasonSettings {
  current?: string;
  updatedAt?: IsoDate;
}

/** Игрок в составе команды (строка состава): лёгкие поля для карточек и поиска. */
export interface RosterItem {
  /** Уникальный ключ строки (id записи состава или slug игрока). */
  key: string;
  /** Нет — игрок удалён из базы, строка без ссылки. */
  slug?: string;
  name: string;
  photoUrl?: string;
  /** Игровой номер строкой («0», «00», «07») — выводится как есть. */
  number?: string;
  /** «PF/C» */
  codes: string;
  /** «Тяжёлый форвард, Центровой» */
  positionsFull: string;
  height?: number;
  birthYear?: number;
  isActive: boolean;
}
