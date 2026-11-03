// Тестовые данные без сети — повторяют сид админки (apps/admin/bin/seed.dart): 3 зала,
// 6 тренеров, 5 взрослых команд и 4 U18, по 12 игроков, прошлый взрослый чемпионат целиком
// сыгран (две круга + плей-офф), первенство U18 идёт — две трети туров сыграны, остальные на
// ближайших выходных и дальше. Даты считаются от момента вызова (внутри «use cache»), поэтому
// блок «Ближайший матч» живой в любой день. Генератор с фиксированным зерном — состав и счета
// одинаковые при каждом запуске.
// Составы (memberships), сезон 2026-27 (settings/season): у каждого игрока запись в своей
// команде с номером; один игрок U18 одновременно во взрослой команде с другим номером; один
// переход внутри сезона (Калкан → Кок жал); у «Политеха» архив сезона 2025-26 (двое ушедших
// после сезона — «Без команды», один отчислен посреди сезона). Регионы: Бишкек → bishkek,
// Кант → chui («Эдельвейс» в моках — из Канта, чтобы был фильтр регионов); кубок Чуйской
// области — пример регионального турнира.
import "server-only";
import type {
  AboutInfo,
  Coach,
  Division,
  Game,
  Gym,
  Membership,
  Player,
  PlayerPosition,
  Post,
  Region,
  StandingRow,
  Team,
  Tournament,
} from "@/lib/types";
import { readingMinutes } from "@/lib/format";
import { bySeasonDesc } from "@/lib/season";
import type { KbfSource, PostIndexItem, PostSummary } from "./source";

// ── Утилиты ─────────────────────────────────────────────────

/** mulberry32 — детерминированный генератор. */
function rng(seed: number) {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(max: number): number {
      return Math.floor(this.next() * max);
    },
  };
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ң: "n", ө: "o", ү: "u",
};

/** slugify из packages/core/utils/slugify.dart. */
function slugify(s: string): string {
  return [...s.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Бишкек UTC+6: «19:00 по Бишкеку» = 13:00 UTC. */
const BISHKEK = 6 * HOUR;

/** Ближайшая суббота (или сегодня, если суббота), 00:00 по Бишкеку, в мс UTC. */
function nextSaturday(now: number): number {
  const local = new Date(now + BISHKEK);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BISHKEK;
  const daysUntil = (6 - local.getUTCDay() + 7) % 7;
  return midnight + daysUntil * DAY;
}

const iso = (ms: number) => new Date(ms).toISOString();

// ── Справочники ─────────────────────────────────────────────

interface Built {
  gyms: Gym[];
  coaches: Coach[];
  teams: Team[];
  players: Player[];
  games: Game[];
  tournaments: Tournament[];
  posts: Post[];
  about: AboutInfo;
  memberships: Membership[];
}

/** settings/season.current в моках. */
const MOCK_SEASON = "2026-27";
const MOCK_PREV_SEASON = "2025-26";
/** Как в сиде: регион по городу. */
const REGION_BY_CITY: Record<string, Region> = { Бишкек: "bishkek", Кант: "chui" };

function build(now: number): Built {
  const rnd = rng(20260814);
  const created = iso(now - 200 * DAY);

  const gymData = [
    { name: "Дворец спорта", city: "Бишкек", address: "Улица Тоголок Молдо, 40", capacity: 1000, phone: "+996500500500", mapUrl: "https://2gis.kg/bishkek/firm/70000001019360305", instagram: "dvorets.sporta" },
    { name: "Школа 29", city: "Бишкек", address: "Улица Максима Горького, 144", capacity: 500, phone: "+996555555055", mapUrl: "https://2gis.kg/bishkek/firm/70000001019336613" },
    { name: "Абдыш-Ата", city: "Кант", address: "Улица Тагаева, 6", capacity: 600, phone: "+996555500555", mapUrl: "https://2gis.kg/kant/firm/70000001025412221" },
  ];
  const gyms: Gym[] = gymData.map((g, i) => ({
    id: `gym-${i + 1}`,
    slug: slugify(g.name),
    name: g.name,
    city: g.city,
    address: g.address,
    mapUrl: g.mapUrl,
    capacity: g.capacity,
    phone: g.phone,
    instagram: g.instagram,
    photoUrls: [],
    type: "indoor" as const,
    region: REGION_BY_CITY[g.city],
    createdAt: created,
    updatedAt: created,
  }));
  const gymByName = new Map(gyms.map((g) => [g.name, g]));

  const coachData = [
    { first: "Егор", last: "Носков", phone: "+996500515253", note: "Тренер молодежной сборной", achievements: ["Мастер спорта КР", "Многократный победитель чемпионатов республики"] },
    { first: "Владимир", last: "Геллерт", phone: "+996555535120", note: "Помощник тренера сборной Кыргызстана", achievements: ["Мастер спорта КР", "Многократный победитель чемпионатов республики", "Тренер команды «Каспий» Атырау"] },
    { first: "Нияз", last: "Исаков", phone: "+996500321432", note: "Заслуженный член правления баскетбола КР", achievements: ["Мастер спорта СССР", "Многократный победитель чемпионатов республики", "Президент клуба «Каспий» Атырау"] },
    { first: "Жаныш", last: "Адиев", phone: "+996500321452", note: "Тренер", achievements: ["Мастер спорта КР", "Многократный победитель чемпионатов республики"] },
    { first: "Андрей", last: "Шахов", phone: "+996500321543", note: "Тренер", achievements: ["Мастер спорта КР", "Многократный победитель чемпионатов республики"] },
    { first: "Александр", last: "Краузе", phone: "+996500543543", note: "Тренер", achievements: ["Мастер спорта КР", "Многократный победитель чемпионатов республики"] },
  ];
  const coaches: Coach[] = coachData.map((c, i) => ({
    id: `coach-${i + 1}`,
    slug: slugify(`${c.first}-${c.last}`),
    firstName: c.first,
    lastName: c.last,
    phone: c.phone,
    contactNote: c.note,
    achievements: c.achievements,
    createdAt: created,
    updatedAt: created,
  }));
  const coachByName = new Map(coaches.map((c) => [`${c.firstName} ${c.lastName}`, c]));

  // Цвета (палитра lib/teamPalette.ts): 8 разных основных; у «Мозгами» и «Кок жал U18» нет
  // kitLight (фолбэк — кремовая), у «Калкан U18» цветов нет совсем (navy по умолчанию)
  type Colors = { color?: string; kitLight?: string; kitDark?: string };
  const teamData: ({ name: string; coach: string; gym: string; founded: number; division: Division } & Colors)[] = [
    { name: "Калкан", coach: "Жаныш Адиев", gym: "Школа 29", founded: 2025, division: "adult", color: "#B3261E", kitLight: "#FFFFFF" },
    { name: "Политех", coach: "Владимир Геллерт", gym: "Школа 29", founded: 1991, division: "adult", color: "#1D4ED8", kitLight: "#FFFFFF", kitDark: "#1E3A8A" },
    { name: "Кок жал", coach: "Нияз Исаков", gym: "Дворец спорта", founded: 2012, division: "adult", color: "#1F5E3A", kitLight: "#A7E3C9" },
    { name: "Эдельвейс", coach: "Егор Носков", gym: "Абдыш-Ата", founded: 2000, division: "adult", color: "#5B21B6", kitLight: "#D9DCE1" },
    { name: "Мозгами", coach: "Андрей Шахов", gym: "Дворец спорта", founded: 2024, division: "adult", color: "#C2410C", kitDark: "#111318" },
    { name: "Политех U18", coach: "Александр Краузе", gym: "Школа 29", founded: 2015, division: "u18", color: "#0F766E", kitLight: "#F5C518" },
    { name: "Эдельвейс U18", coach: "Егор Носков", gym: "Абдыш-Ата", founded: 2010, division: "u18", color: "#9D174D", kitLight: "#E8D3A8" },
    { name: "Кок жал U18", coach: "Нияз Исаков", gym: "Дворец спорта", founded: 2016, division: "u18", color: "#7A1F2B" },
    { name: "Калкан U18", coach: "Жаныш Адиев", gym: "Школа 29", founded: 2025, division: "u18" },
  ];
  const teams: Team[] = teamData.map((t, i) => {
    const coach = coachByName.get(t.coach)!;
    const gym = gymByName.get(t.gym)!;
    // «Эдельвейс» играет в Канте — в моках из Канта (Чуйская обл.), остальные из Бишкека
    const city = t.name.startsWith("Эдельвейс") ? "Кант" : "Бишкек";
    return {
      id: `team-${i + 1}`,
      slug: slugify(t.name),
      name: t.name,
      division: t.division,
      city,
      region: REGION_BY_CITY[city],
      ...(t.color ? { color: t.color } : {}),
      ...(t.kitLight ? { kitLight: t.kitLight } : {}),
      ...(t.kitDark ? { kitDark: t.kitDark } : {}),
      coachId: coach.id,
      coachName: `${coach.lastName} ${coach.firstName}`,
      gymId: gym.id,
      gymName: gym.name,
      foundedYear: t.founded,
      createdAt: created,
      updatedAt: created,
    };
  });
  teams.find((t) => t.slug === "politeh")!.description =
    "Один из старейших клубов страны, основан при Политехническом университете. Домашние матчи проводит в зале школы №29.";

  // ── Игроки: по два на позицию + двое запасных ──
  const firstNames = ["Айбек", "Данияр", "Эрлан", "Тимур", "Нурлан", "Азамат", "Бакыт", "Улан", "Мирлан", "Кутман", "Адилет", "Санжар", "Алмаз", "Бекзат", "Руслан", "Максат", "Темирлан", "Жоомарт", "Илья", "Артём", "Денис", "Виктор", "Марат", "Чынгыз", "Асхат", "Дастан", "Эмиль", "Нурбек", "Байэл", "Аскар"];
  const lastNames = ["Асанов", "Токтогулов", "Жээнбеков", "Кадыров", "Осмонов", "Бакиров", "Сыдыков", "Мамытов", "Исаков", "Абдыраманов", "Турсунов", "Эсенов", "Ковалёв", "Николаев", "Орозов", "Джумабаев", "Сартбаев", "Молдогазиев", "Шаршеев", "Алымкулов", "Беков", "Рыскулов", "Тыналиев", "Мураталиев", "Садыков", "Ибраев", "Карагулов", "Дуйшеев", "Сооронбаев", "Акматов"];
  const positions: { code: PlayerPosition; minH: number; maxH: number }[] = [
    { code: "pointGuard", minH: 178, maxH: 188 },
    { code: "shootingGuard", minH: 185, maxH: 195 },
    { code: "smallForward", minH: 190, maxH: 200 },
    { code: "powerForward", minH: 196, maxH: 206 },
    { code: "center", minH: 200, maxH: 212 },
  ];
  const roster = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 2, 0];
  const players: Player[] = [];
  const usedSlugs = new Set<string>();
  for (const team of teams) {
    const youth = team.division !== "adult";
    roster.forEach((posIdx, i) => {
      const pos = positions[posIdx]!;
      const first = firstNames[rnd.int(firstNames.length)]!;
      const last = lastNames[rnd.int(lastNames.length)]!;
      let slug = slugify(`${first}-${last}`);
      for (let n = 2; usedSlugs.has(slug); n++) slug = slugify(`${first}-${last}-${n}`);
      usedSlugs.add(slug);
      const height = pos.minH + rnd.int(pos.maxH - pos.minH + 1);
      const weight = height - 100 + rnd.int(17) - 8;
      const birthYear = youth ? 2008 + rnd.int(3) : 1995 + rnd.int(11);
      const birth = Date.UTC(birthYear, rnd.int(12), 1 + rnd.int(28));
      const pos2: PlayerPosition[] = [pos.code];
      if (rnd.int(4) === 0) {
        const second = positions[rnd.int(positions.length)]!.code;
        if (second !== pos.code) pos2.push(second);
      }
      players.push({
        id: `player-${players.length + 1}`,
        slug,
        firstName: first,
        lastName: last,
        birthDate: iso(birth),
        height,
        weight,
        positions: pos2,
        teamIds: [team.id],
        teamNames: [team.name],
        bio:
          i === 0
            ? `Воспитанник клуба «${team.name}». Играет в основной ротации, отвечает за темп и розыгрыш в позиционном нападении.`
            : undefined,
        isActive: i < roster.length - 1,
        createdAt: created,
        updatedAt: created,
      });
    });
  }

  // ── Сезоны ──
  type Pair = { home: Team; away: Team };
  const roundRobin = (list: Team[]): Pair[][] => {
    const arr: (Team | null)[] = [...list];
    if (arr.length % 2) arr.push(null);
    const n = arr.length;
    const rounds: Pair[][] = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs: Pair[] = [];
      for (let i = 0; i < n / 2; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        if (home && away) pairs.push({ home, away });
      }
      rounds.push(pairs);
      const last = arr.pop()!;
      arr.splice(1, 0, last);
    }
    return rounds;
  };
  const doubleRoundRobin = (list: Team[]) => {
    const first = roundRobin(list);
    return [...first, ...first.map((r) => r.map((p) => ({ home: p.away, away: p.home })))];
  };
  const score = (youth: boolean): [number, number] => {
    const base = youth ? 50 : 65;
    let h = base + rnd.int(31);
    let a = base + rnd.int(31);
    if (h === a) {
      h += 5 + rnd.int(6);
      a += 5 + rnd.int(6);
      if (h === a) h += 2;
    }
    return [h, a];
  };
  const standings = (list: Game[]): StandingRow[] => {
    const acc = new Map<string, StandingRow>();
    const row = (id: string) => {
      let r = acc.get(id);
      if (!r) {
        r = { teamId: id, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, points: 0 };
        acc.set(id, r);
      }
      return r;
    };
    for (const g of list) {
      const hs = g.homeScore!;
      const aw = g.awayScore!;
      const homeWin = hs > aw;
      const h = row(g.homeTeamId);
      const a = row(g.awayTeamId);
      h.played++; a.played++;
      h.won += homeWin ? 1 : 0; h.lost += homeWin ? 0 : 1;
      a.won += homeWin ? 0 : 1; a.lost += homeWin ? 1 : 0;
      h.pointsFor += hs; h.pointsAgainst += aw;
      a.pointsFor += aw; a.pointsAgainst += hs;
      h.points += homeWin ? 2 : 1; a.points += homeWin ? 1 : 2;
    }
    return [...acc.values()].sort(
      (x, y) => y.points - x.points || y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst),
    );
  };

  const games: Game[] = [];
  const addGame = (o: { pair: Pair; tournamentId: string; division: Division; at: number; home?: number; away?: number; round?: number; stage?: string }) => {
    const gym = gyms.find((g) => g.id === o.pair.home.gymId)!;
    const game: Game = {
      id: `game-${games.length + 1}`,
      homeTeamId: o.pair.home.id,
      homeTeamName: o.pair.home.name,
      awayTeamId: o.pair.away.id,
      awayTeamName: o.pair.away.name,
      gymId: gym.id,
      gymName: gym.name,
      division: o.division,
      tournamentId: o.tournamentId,
      scheduledAt: iso(o.at),
      status: o.home == null ? "scheduled" : "finished",
      homeScore: o.home,
      awayScore: o.away,
      round: o.round,
      stage: o.stage,
      createdAt: created,
      updatedAt: created,
    };
    games.push(game);
    return game;
  };

  const sat = nextSaturday(now);
  const lastSat = sat - 7 * DAY;

  // Взрослые: прошлый сезон целиком в прошлом
  const adultTeams = teams.filter((t) => t.division === "adult");
  const adultT: Tournament = {
    id: "tournament-1",
    slug: "chempionat-kbf-2025-26",
    name: "Чемпионат КБФ 2025/26",
    season: MOCK_PREV_SEASON,
    division: "adult",
    type: "league",
    status: "finished",
    standings: [],
    startDate: iso(lastSat - 300 * DAY),
    endDate: iso(lastSat - 120 * DAY),
    createdAt: created,
    updatedAt: created,
  };
  const adultRounds = doubleRoundRobin(adultTeams);
  const regularEnd = lastSat - 126 * DAY;
  const regular: Game[] = [];
  adultRounds.forEach((pairs, r) => {
    const day = regularEnd - (adultRounds.length - r) * 7 * DAY;
    pairs.forEach((pair, i) => {
      const [h, a] = score(false);
      regular.push(
        addGame({ pair, tournamentId: adultT.id, division: "adult", at: day + i * DAY + (17 + i * 2) * HOUR, home: h, away: a, round: r + 1 }),
      );
    });
  });
  adultT.standings = standings(regular);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const top = adultT.standings.slice(0, 4).map((s) => byId.get(s.teamId)!);
  const po = regularEnd + 7 * DAY;
  const s1 = score(false);
  addGame({ pair: { home: top[0]!, away: top[3]! }, tournamentId: adultT.id, division: "adult", at: po + 17 * HOUR, home: s1[0], away: s1[1], stage: "1/2 финала" });
  const s2 = score(false);
  addGame({ pair: { home: top[1]!, away: top[2]! }, tournamentId: adultT.id, division: "adult", at: po + DAY + 17 * HOUR, home: s2[0], away: s2[1], stage: "1/2 финала" });
  const w1 = s1[0] > s1[1] ? top[0]! : top[3]!;
  const l1 = s1[0] > s1[1] ? top[3]! : top[0]!;
  const w2 = s2[0] > s2[1] ? top[1]! : top[2]!;
  const l2 = s2[0] > s2[1] ? top[2]! : top[1]!;
  const s3 = score(false);
  addGame({ pair: { home: l1, away: l2 }, tournamentId: adultT.id, division: "adult", at: po + 7 * DAY + 15 * HOUR, home: s3[0], away: s3[1], stage: "Матч за 3-е место" });
  const sf = score(false);
  addGame({ pair: { home: w1, away: w2 }, tournamentId: adultT.id, division: "adult", at: po + 7 * DAY + 18 * HOUR, home: sf[0], away: sf[1], stage: "Финал" });
  const champion = sf[0] > sf[1] ? w1 : w2;
  const runnerUp = sf[0] > sf[1] ? w2 : w1;
  const bronze = s3[0] > s3[1] ? l1 : l2;

  // U18: текущий сезон, две трети сыграно
  const youthTeams = teams.filter((t) => t.division === "u18");
  const youthT: Tournament = {
    id: "tournament-2",
    slug: "pervenstvo-kbf-u18-2026-27",
    name: "Первенство КБФ U18 2026/27",
    season: MOCK_SEASON,
    division: "u18",
    type: "league",
    status: "ongoing",
    standings: [],
    startDate: iso(lastSat - 56 * DAY),
    endDate: iso(lastSat + 120 * DAY),
    createdAt: created,
    updatedAt: created,
  };
  const youthRounds = doubleRoundRobin(youthTeams);
  const playedRounds = Math.round((youthRounds.length * 2) / 3);
  const youthPlayed: Game[] = [];
  let nextYouth: Game | null = null;
  youthRounds.forEach((pairs, r) => {
    const isPlayed = r < playedRounds;
    const day = isPlayed ? lastSat - (playedRounds - r - 1) * 7 * DAY : sat + (r - playedRounds) * 7 * DAY;
    pairs.forEach((pair, i) => {
      const at = day + i * DAY + (12 + i * 2) * HOUR;
      if (isPlayed && at < now) {
        const [h, a] = score(true);
        youthPlayed.push(addGame({ pair, tournamentId: youthT.id, division: "u18", at, home: h, away: a, round: r + 1 }));
      } else {
        const g = addGame({ pair, tournamentId: youthT.id, division: "u18", at, round: r + 1 });
        nextYouth ??= g;
      }
    });
  });
  youthT.standings = standings(youthPlayed);
  const youthLeader = byId.get(youthT.standings[0]?.teamId ?? "")?.name ?? youthTeams[0]!.name;

  // Матчи сегодня (табло дня на главной): товарищеский утром (сыгран), перенесённый матч идёт,
  // ещё один вечером. stage задан — в таблицу и форму В/П не попадают. Только те, что
  // укладываются в сегодняшний день по Бишкеку.
  {
    const local = new Date(now + BISHKEK);
    const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BISHKEK;
    const dayEnd = dayStart + DAY;
    const [a, b, c, d] = youthTeams;
    const today: { pair: Pair; at: number; home?: number; away?: number; stage: string; live?: boolean }[] = [
      // вчера — для ленты матчей главной («Вчера · Финал»)
      { pair: { home: d!, away: a! }, at: dayStart - DAY + 13 * HOUR, home: 58, away: 66, stage: "Товарищеский матч" },
      { pair: { home: c!, away: b! }, at: dayStart - DAY + 15 * HOUR, home: 72, away: 69, stage: "Товарищеский матч" },
      { pair: { home: a!, away: c! }, at: now - 3 * HOUR, home: 71, away: 64, stage: "Товарищеский матч" },
      { pair: { home: b!, away: d! }, at: now - 40 * 60 * 1000, home: 38, away: 41, stage: "Перенесённый матч", live: true },
      { pair: { home: c!, away: b! }, at: Math.min(now + 2 * HOUR, dayEnd - HOUR), stage: "Перенесённый матч" },
    ];
    for (const g of today) {
      if (g.at < dayStart - DAY || g.at >= dayEnd || (g.home == null && g.at <= now)) continue;
      const game = addGame({ pair: g.pair, tournamentId: youthT.id, division: "u18", at: g.at, home: g.home, away: g.away, stage: g.stage });
      if (g.live) game.status = "live";
    }
  }

  // Предстоящие турниры — для группы «Предстоят» и календаря U16
  const u16T: Tournament = {
    id: "tournament-3",
    slug: "pervenstvo-kbf-u16-2026-27",
    name: "Первенство КБФ U16 2026/27",
    season: MOCK_SEASON,
    division: "u16",
    type: "league",
    status: "upcoming",
    standings: [],
    startDate: iso(sat + 42 * DAY),
    endDate: iso(sat + 200 * DAY),
    createdAt: created,
    updatedAt: created,
  };
  // Региональный турнир (region: chui) — для фильтра регионов на /tournaments
  const chuiCup: Tournament = {
    id: "tournament-4",
    slug: "kubok-chuyskoy-oblasti-2026-27",
    name: "Кубок Чуйской области 2026/27",
    season: MOCK_SEASON,
    division: "adult",
    region: "chui",
    type: "cup",
    status: "upcoming",
    standings: [],
    startDate: iso(sat + 63 * DAY),
    endDate: iso(sat + 77 * DAY),
    createdAt: created,
    updatedAt: created,
  };
  // Кубок КБФ (type cup, без таблицы): матчи только по стадиям, один отменён — проверка
  // страницы турнира без standings и cancelled-матча
  const cupT: Tournament = {
    id: "tournament-5",
    slug: "kubok-kbf-2025-26",
    name: "Кубок КБФ 2025/26",
    season: MOCK_PREV_SEASON,
    division: "adult",
    type: "cup",
    status: "finished",
    standings: [],
    startDate: iso(lastSat - 112 * DAY),
    endDate: iso(lastSat - 104 * DAY),
    createdAt: created,
    updatedAt: created,
  };
  {
    const [a, b, c, d] = adultTeams;
    const cupAt = lastSat - 112 * DAY;
    const q1 = score(false);
    const q2 = score(false);
    addGame({ pair: { home: a!, away: d! }, tournamentId: cupT.id, division: "adult", at: cupAt + 17 * HOUR, home: q1[0], away: q1[1], stage: "1/2 финала" });
    addGame({ pair: { home: b!, away: c! }, tournamentId: cupT.id, division: "adult", at: cupAt + DAY + 17 * HOUR, home: q2[0], away: q2[1], stage: "1/2 финала" });
    const wa = q1[0] > q1[1] ? a! : d!;
    const la = q1[0] > q1[1] ? d! : a!;
    const wb = q2[0] > q2[1] ? b! : c!;
    const lb = q2[0] > q2[1] ? c! : b!;
    const third = addGame({ pair: { home: la, away: lb }, tournamentId: cupT.id, division: "adult", at: cupAt + 8 * DAY + 15 * HOUR, stage: "Матч за 3-е место" });
    third.status = "cancelled";
    const f = score(false);
    addGame({ pair: { home: wa, away: wb }, tournamentId: cupT.id, division: "adult", at: cupAt + 8 * DAY + 18 * HOUR, home: f[0], away: f[1], stage: "Финал" });
  }
  const tournaments = [adultT, youthT, u16T, chuiCup, cupT];

  // ── Новости ──
  const ng = nextYouth as Game | null;
  const nextHome = ng ? byId.get(ng.homeTeamId)! : null;
  const nextAway = ng ? byId.get(ng.awayTeamId)! : null;
  const postsData: { title: string; excerpt: string; body: string; tags: string[]; daysAgo: number }[] = [
    {
      title: `${champion.name} — чемпион Кыргызстана сезона 2025/26`,
      excerpt: `В решающем матче сезона «${champion.name}» обыграл «${runnerUp.name}» со счётом ${sf[0]}:${sf[1]} и во второй раз подряд поднял над головой главный трофей чемпионата.`,
      body: `Финал получился именно таким, каким его ждали: две сильнейшие команды регулярного чемпионата сошлись в матче, где до последней четверти никто не имел преимущества больше пяти очков.\n\n«${champion.name}» вырвал победу на отрезке в середине четвёртой четверти, когда соперник провёл почти четыре минуты без результативных атак.\n\n> «Мы понимали, что финал решится в защите, и сыграли в неё лучше, чем весь сезон»\n\n## Как складывался сезон\n\nЧемпион прошёл регулярную часть уверенно, но плей-офф дался тяжело: в полуфинале команде пришлось отыгрываться в концовке.\n\nБронзовые медали достались клубу «${bronze.name}».`,
      tags: ["лига"],
      daysAgo: 118,
    },
    {
      title: `Первенство U18: «${youthLeader}» возглавляет таблицу после первого круга`,
      excerpt: `Юношеский турнир прошёл экватор. «${youthLeader}» идёт без серьёзных осечек, а борьба за попадание в тройку осталась открытой.`,
      body: "Первенство КБФ среди юношей до 18 лет добралось до середины дистанции. Лидер определился рано, но отрыв в таблице не выглядит непреодолимым.\n\nТренеры отмечают выросший уровень юношеского баскетбола: в этом сезоне заметно меньше разгромов и больше матчей, решающихся в концовке.",
      tags: ["турниры"],
      daysAgo: 21,
    },
    ...(nextHome && nextAway
      ? [
          {
            title: `Афиша выходных: «${nextHome.name}» принимает «${nextAway.name}»`,
            excerpt: `В ближайшие выходные продолжится первенство U18. Центральный матч тура — встреча «${nextHome.name}» и «${nextAway.name}».`,
            body: `Матч пройдёт в зале «${nextHome.gymName}». Вход свободный.\n\nКомандам есть за что бороться: позиции в верхней части таблицы решатся именно в этих турах.`,
            tags: ["расписание"],
            daysAgo: 2,
          },
        ]
      : []),
    {
      title: "Открыт набор в детские и юношеские группы",
      excerpt: "Клубы федерации объявляют набор мальчиков и девочек 2010–2015 годов рождения. Тренировки идут в трёх залах Бишкека и Канта.",
      body: "Федерация начинает новый цикл набора в секции. Заниматься приглашают детей без опыта — первые месяцы посвящены общей физической подготовке и основам техники.\n\n## Что нужно для начала\n\nСпортивная форма, кроссовки с нескользящей подошвой и справка от врача.\n\nЗаписаться можно напрямую у тренера: контакты есть на странице каждого специалиста в разделе «Тренеры».",
      tags: ["федерация"],
      daysAgo: 9,
    },
    {
      title: "Судейский семинар пройдёт перед стартом плей-офф",
      excerpt: "Федерация проведёт аттестацию арбитров: теория, разбор спорных эпизодов сезона и практические тесты на площадке.",
      body: "К участию приглашаются действующие арбитры и все, кто хочет получить категорию. Программа рассчитана на два дня.\n\nРазбирать будут в том числе эпизоды из матчей текущего сезона — по видеозаписям.",
      tags: ["федерация"],
      daysAgo: 14,
    },
    {
      title: `«${runnerUp.name}» усилил состав перед новым сезоном`,
      excerpt: "Финалист прошлого чемпионата объявил о переходах: в команду пришли два игрока задней линии и центровой.",
      body: "Клуб объявил о завершении трансферной кампании. Основной костяк сохранён, точечные усиления закрывают проблемные позиции прошлого сезона.\n\nПервую проверку новый состав пройдёт уже на предсезонном турнире.",
      tags: ["лига"],
      daysAgo: 45,
    },
    {
      title: "Сборная Кыргызстана готовится к отборочному циклу",
      excerpt: "Тренерский штаб назвал расширенный список кандидатов. В него вошли игроки клубов чемпионата и легионеры из зарубежных лиг.",
      body: "Сбор пройдёт в Бишкеке. В расширенный список включены как опытные игроки, так и несколько воспитанников юношеских команд.\n\nОкончательный состав объявят за неделю до первого матча.",
      tags: ["сборная"],
      daysAgo: 30,
    },
    {
      title: "Итоги регулярного чемпионата: цифры сезона",
      excerpt: "Самая результативная команда, лучшая разница мячей и матчи, решённые в последние тридцать секунд — статистика завершившегося сезона.",
      body: "Регулярный чемпионат подошёл к концу, и статистика показывает, насколько выросла плотность результатов: почти треть матчей завершилась разницей менее пяти очков.\n\n## Что изменилось\n\nКоманды стали чаще бросать из-за дуги и заметно реже допускать потери.",
      tags: ["лига"],
      daysAgo: 130,
    },
    {
      title: "Зал «Абдыш-Ата» в Канте принял первый тур первенства",
      excerpt: "Матчи юношеского первенства впервые прошли за пределами Бишкека — площадка в Канте приняла два матча тура.",
      body: "Расширение географии турниров — одна из задач федерации на ближайшие сезоны. Зал в Канте рассчитан на 600 зрителей.\n\nВ планах — провести здесь и часть матчей взрослого чемпионата.",
      tags: ["турниры"],
      daysAgo: 38,
    },
    {
      title: "Расписание чемпионата на новый сезон появится в сентябре",
      excerpt: "Календарь взрослого чемпионата опубликуют после жеребьёвки. Формат сохранится: два круга и плей-офф от четырёх команд.",
      body: "Заявочная кампания завершится в конце августа, после чего пройдёт жеребьёвка.\n\nФормат турнира остаётся прежним: двухкруговой регулярный чемпионат, затем полуфиналы, матч за третье место и финал.",
      tags: ["лига"],
      daysAgo: 5,
    },
  ];
  const posts: Post[] = postsData
    .map((p, i) => ({
      id: `post-${i + 1}`,
      slug: slugify(p.title),
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      source: "internal" as const,
      publishedAt: iso(now - p.daysAgo * DAY),
      isPublished: true,
      tags: p.tags,
      createdAt: iso(now - p.daysAgo * DAY),
      updatedAt: iso(now - p.daysAgo * DAY),
    }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  // Обложки у свежей и четвёртой новости (остальные — без фото: проверка пустого состояния)
  if (posts[0]) posts[0].coverUrl = "/images/hero-basketball.jpg";
  if (posts[3]) posts[3].coverUrl = "/images/kids-training.jpg";

  // Галерея из кадров разных пропорций (горизонтальные и вертикальные) — проверка сетки и просмотра
  const galleryPost = posts.find((p) => p.title.startsWith("Зал «Абдыш-Ата»"));
  if (galleryPost) {
    galleryPost.gallery = [
      "/images/hero-basketball.jpg",
      "/images/gallery-portrait-1.jpg",
      "/images/kids-training.jpg",
      "/images/gallery-portrait-2.jpg",
      "/images/instagram.jpeg",
    ];
  }

  const about: AboutInfo = {
    history:
      "Кыргызская баскетбольная федерация — некоммерческая организация, объединяющая клубы, тренеров и игроков Кыргызстана. Основана в 2019 году, является членом FIBA Asia.\n\nМиссия — развитие баскетбола на всех уровнях: от детско-юношеских школ до профессиональных команд. Федерация организует чемпионаты страны, проводит турниры и содействует подготовке национальных сборных.",
    phone: "+996312661234",
    email: "info@kbf.kg",
    address: "Бишкек, Тоголок Молдо 40, Дворец спорта им. Кожомкула",
    staff: [
      { role: "Президент", name: "Артем Новиков" },
      { role: "Главный судья", name: "Хусанжан Джаров" },
      { role: "Старший тренер", name: "Владимир Геллерт" },
    ],
    instagram: "kbf.kg",
    youtube: "kbf_kg",
    telegram: "kbf_kg",
    updatedAt: created,
  };

  const memberships = buildMemberships(now, teams, players, created);

  return { gyms, coaches, teams, players, games, tournaments, posts, about, memberships };
}

/** Номера по порядку игроков в составе (12 человек). */
// Строки 1–2 цифры: «0», «00», «07» — разные номера (у разных игроков одного состава)
const NUMBERS = ["0", "00", "07", "4", "5", "8", "9", "10", "11", "12", "13", "23"];

/**
 * Составы. Без генератора случайных чисел — иначе сдвинулись бы счета и составы выше.
 * Меняет players (teamIds/teamNames = активные записи текущего сезона, как пересчитывает
 * админка) и добавляет двух игроков прошлого сезона без команды.
 */
function buildMemberships(now: number, teams: Team[], players: Player[], created: string): Membership[] {
  const out: Membership[] = [];
  const add = (p: Player, t: Team, season: string, number: string | undefined, from?: number, to?: number) => {
    out.push({
      id: `membership-${out.length + 1}`,
      playerId: p.id,
      playerName: `${p.firstName} ${p.lastName}`,
      teamId: t.id,
      teamName: t.name,
      division: t.division,
      season,
      ...(number != null ? { number } : {}),
      ...(from != null ? { from: iso(from) } : {}),
      ...(to != null ? { to: iso(to) } : {}),
      createdAt: created,
      updatedAt: created,
    });
  };
  const byTeam = (slug: string) => teams.find((t) => t.slug === slug)!;
  const rosterOf = (t: Team) => players.filter((p) => p.teamIds[0] === t.id);

  // Текущий сезон: каждый в своей команде, номер по порядку
  for (const t of teams) rosterOf(t).forEach((p, i) => add(p, t, MOCK_SEASON, NUMBERS[i]));

  // Игрок U18 одновременно во взрослой команде (с 30 дней назад) под другим номером
  const politeh = byTeam("politeh");
  const politehU18 = byTeam("politeh-u18");
  const dual = rosterOf(politehU18)[1]!;
  add(dual, politeh, MOCK_SEASON, "33", now - 30 * DAY);

  // Переход внутри сезона: третий игрок «Калкана» в «Кок жал» 20 дней назад
  const kalkan = byTeam("kalkan");
  const kokzhal = byTeam("kok-zhal");
  const moved = rosterOf(kalkan)[2]!;
  const at = now - 20 * DAY;
  const old = out.find((m) => m.playerId === moved.id && m.teamId === kalkan.id)!;
  old.to = iso(at);
  add(moved, kokzhal, MOCK_SEASON, "31", at);

  // Архив «Политеха» 2025-26: первые десять — те же игроки с теми же номерами; двое
  // ушедших после сезона (в текущем сезоне без команды), один отчислен в феврале 2026
  rosterOf(politeh).slice(0, 10).forEach((p, i) => add(p, politeh, MOCK_PREV_SEASON, NUMBERS[i]));
  const formers: Player[] = [
    { first: "Эрмек", last: "Байтиков", birth: Date.UTC(1997, 3, 12), height: 191, positions: ["shootingGuard"] as PlayerPosition[] },
    { first: "Кирилл", last: "Соколов", birth: Date.UTC(1999, 8, 3), height: 203, positions: ["center"] as PlayerPosition[] },
  ].map((f, i) => ({
    id: `player-former-${i + 1}`,
    slug: slugify(`${f.first}-${f.last}`),
    firstName: f.first,
    lastName: f.last,
    birthDate: iso(f.birth),
    height: f.height,
    positions: f.positions,
    teamIds: [],
    teamNames: [],
    isActive: false,
    createdAt: created,
    updatedAt: created,
  }));
  players.push(...formers);
  add(formers[0]!, politeh, MOCK_PREV_SEASON, "21");
  add(formers[1]!, politeh, MOCK_PREV_SEASON, "24", undefined, Date.UTC(2026, 1, 15) - BISHKEK);

  // Денормализация игрока — команды активных записей текущего сезона (взрослые первыми)
  const rank = (t: Team) => ["adult", "u18", "u16"].indexOf(t.division);
  for (const p of players) {
    const active = out
      .filter((m) => m.playerId === p.id && m.season === MOCK_SEASON && !m.to)
      .map((m) => teams.find((t) => t.id === m.teamId)!)
      .sort((a, b) => rank(a) - rank(b));
    p.teamIds = active.map((t) => t.id);
    p.teamNames = active.map((t) => t.name);
  }
  return out;
}

/** Данные строятся один раз на вызов функции кэша; «сейчас» — момент вызова. */
function data(): Built {
  return build(Date.now());
}

function summary(p: Post): PostSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body, gallery, ...rest } = p;
  const minutes = readingMinutes(body);
  return minutes ? { ...rest, minutes } : rest;
}

export const mockSource: KbfSource = {
  posts: async ({ offset, limit, tag }) =>
    data()
      .posts.filter((p) => !tag || p.tags.includes(tag))
      .slice(offset, offset + limit)
      .map(summary),
  postsCount: async (tag) => data().posts.filter((p) => !tag || p.tags.includes(tag)).length,
  postBySlug: async (slug) => data().posts.find((p) => p.slug === slug) ?? null,
  postIndex: async () =>
    data().posts.map(
      (p): PostIndexItem => ({ slug: p.slug, tags: p.tags, publishedAt: p.publishedAt, updatedAt: p.updatedAt }),
    ),
  players: async () => data().players.map((p) => ({ ...p, bio: undefined })),
  playerBySlug: async (slug) => data().players.find((p) => p.slug === slug) ?? null,
  teams: async () => data().teams,
  coaches: async () => data().coaches.map((c) => ({ ...c, bio: undefined })),
  coachBySlug: async (slug) => data().coaches.find((c) => c.slug === slug) ?? null,
  gyms: async () => data().gyms,
  games: async () => data().games,
  tournaments: async () => data().tournaments,
  about: async () => data().about,
  getCurrentSeason: async () => MOCK_SEASON,
  getMemberships: async ({ season, teamId, division }) =>
    data().memberships.filter(
      (m) => (!season || m.season === season) && (!teamId || m.teamId === teamId) && (!division || m.division === division),
    ),
  getPlayerMemberships: async (playerId) =>
    data()
      .memberships.filter((m) => m.playerId === playerId)
      .sort((a, b) => bySeasonDesc(a.season, b.season)),
};
