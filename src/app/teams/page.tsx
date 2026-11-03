import type { Metadata } from "next";
import Link from "next/link";
import { CourtArt } from "@/components/ui/Icons";
import { Empty, ListHero, Section, SecHead, type Fact } from "@/components/ui/Heads";
import { Shirt } from "@/components/ui/Shirt";
import { getCoaches, getCurrentSeason, getGames, getGyms, getNow, getTeams, getTournaments } from "@/data/repo";
import { count, firstLetter, FORMS, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { DIVISIONS, divisionAges, gymType, presentRegions, seasonStartYear, tournamentKind } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { paths } from "@/lib/routes";
import { seasonLabel } from "@/lib/season";
import { currentTournament, lastPlayedRound, sortTeams } from "@/lib/sport";
import { teamColors } from "@/lib/teamPalette";
import { PageShell } from "@/components/ui/Vt";

export const metadata: Metadata = pageMetadata({
  path: paths.teams(),
  title: "Команды",
  description: "Команды Кыргызской баскетбольной федерации по дивизионам: взрослые, U18, U16.",
});

const NUM_WORDS = ["", "одном", "двух", "трёх", "четырёх", "пяти"];
/** Предложный падеж городов для «в Бишкеке и Канте»; неизвестные — как есть. */
const CITY_PREP: Record<string, string> = { Бишкек: "Бишкеке", Кант: "Канте", Ош: "Оше", Каракол: "Караколе", Токмок: "Токмоке" };

function citiesIn(cities: string[]): string {
  const names = cities.map((c) => CITY_PREP[c] ?? c);
  if (names.length === 0) return "";
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}` : names[0]!;
}

/**
 * Команды (концепция А): тёмная шапка с цифрами, плитки дивизионов (число команд, турнир
 * или годы рождения, майки команд), баннер «Хочу заниматься». Блока детских групп с набором
 * и расписанием нет: групп в модели нет (только команды и тренеры).
 */
async function TeamsPageContent() {
  const [teams, tournaments, games, now, current, coaches, gyms] = await Promise.all([
    getTeams(),
    getTournaments(),
    getGames(),
    getNow(),
    getCurrentSeason(),
    getCoaches(),
    getGyms(),
  ]);
  // Годы рождения — от текущего сезона (settings/season), а не от сезона турнира
  const startYear = seasonStartYear(current, now);
  const divisions = DIVISIONS.map((d) => {
    const own = sortTeams(teams.filter((t) => t.division === d.id));
    const t = currentTournament(tournaments, d.id, games);
    const round = t && t.status === "ongoing" ? lastPlayedRound(games.filter((g) => g.tournamentId === t.id)) : 0;
    const regions = presentRegions(own).length;
    const ages = divisionAges(d.id, startYear);
    const line =
      d.id === "adult"
        ? [t ? `${tournamentKind(t)} КБФ ${seasonLabel(t.season)}` : "", round ? `сыгран тур ${round}` : ""].filter(Boolean).join(" · ")
        : [ages, regions > 1 ? count(regions, FORMS.region, DEFAULT_LOCALE) : ""].filter(Boolean).join(" · ");
    return { ...d, own, line };
  });
  const withTeams = divisions.filter((d) => d.own.length > 0).length;
  const kids = teams.filter((t) => t.division !== "adult");
  const regions = presentRegions(teams).length;
  const sub = teams.length
    ? `${count(teams.length, FORMS.team, DEFAULT_LOCALE)} в ${NUM_WORDS[withTeams] ?? withTeams} ${withTeams === 1 ? "дивизионе" : "дивизионах"}, сезон ${seasonLabel(current)}`
    : "Скоро новый сезон";
  const facts: Fact[] = teams.length
    ? [
        { label: "Команд", value: teams.length },
        ...(regions ? [{ label: plural(regions, ["Регион", "Региона", "Регионов"], DEFAULT_LOCALE), value: regions }] : []),
        { label: "Детских", value: kids.length, accent: true },
      ]
    : [];

  // «Хочу заниматься»: города детских команд, тренеры и крытые залы — из данных
  const kidCities = [...new Set(kids.map((t) => t.city?.trim()).filter((c): c is string => Boolean(c)))];
  const halls = gyms.filter((g) => gymType(g) === "indoor").length;
  const joinFacts: Fact[] = [
    { label: "Детских команд", value: kids.length, accent: true },
    { label: "Тренеров", value: coaches.length },
    { label: "Залов", value: halls },
    { label: plural(kidCities.length, ["Город", "Города", "Городов"], DEFAULT_LOCALE), value: kidCities.length },
  ].filter((f) => Number(f.value) > 0);

  return (
    <>
      <ListHero title="Команды" sub={sub} eyebrow={DIVISIONS.map((d) => d.label).join(" · ")} facts={facts} />

      <Section>
        <SecHead title="Дивизионы" />
        <div className="k-divs">
          {divisions.map((d, i) => {
            const dark = i === 0;
            return (
              <Link key={d.id} className={dark ? "k-card k-divtile k-divtile--dark" : "k-card k-divtile"} href={paths.division(d.id)}>
                <CourtArt className="k-divtile__art" />
                <span className="k-divtile__top">
                  <span className="k-divtile__count">
                    <b>{d.own.length}</b>
                    <span>{plural(d.own.length, FORMS.team, DEFAULT_LOCALE)}</span>
                  </span>
                  <span className="k-want__go" aria-hidden>
                    →
                  </span>
                </span>
                <span className="k-divtile__title">{d.label}</span>
                {d.line ? <span className="k-divtile__sub">{d.line}</span> : null}
                {d.own.length ? (
                  <span className="k-kits" aria-hidden>
                    {d.own.map((t) => {
                      const c = teamColors(t);
                      return <Shirt key={t.id} kit={c.dark} label={firstLetter(t.name)} trim={c.light.fill} on={dark ? "dark" : "light"} />;
                    })}
                  </span>
                ) : (
                  <span className="k-divtile__sub">Команд пока нет</span>
                )}
              </Link>
            );
          })}
        </div>
      </Section>

      <Section id="join">
        <div className="k-join">
          <CourtArt className="k-join__art" />
          <div className="k-join__copy">
            <span className="k-eyebrow k-eyebrow--on-dark">Детский баскетбол</span>
            <h2 className="k-join__title">
              Хочу <span>заниматься</span>
            </h2>
            <p>
              {kidCities.length
                ? `Детские команды U18 и U16 в ${citiesIn(kidCities)}. Выберите команду по возрасту или напишите тренеру напрямую.`
                : "Выберите команду по возрасту или напишите тренеру напрямую."}
            </p>
            <div className="k-join__acts">
              <Link className="k-btn k-btn--cta" href={paths.coaches()}>
                Тренеры →
              </Link>
              <Link className="k-btn k-btn--cta-ghost" href={paths.gyms("indoor")}>
                Залы
              </Link>
            </div>
          </div>
          {joinFacts.length ? (
            <div className="k-join__facts">
              {joinFacts.map((f) => (
                <div key={f.label} className="k-lfact">
                  <span>{f.label}</span>
                  <b className={f.accent ? "is-accent" : undefined}>{f.value}</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {teams.length === 0 ? <Empty>Команд пока нет — скоро новый сезон</Empty> : null}
      </Section>
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function TeamsPage() {
  return (
    <PageShell>
      <TeamsPageContent />
    </PageShell>
  );
}
