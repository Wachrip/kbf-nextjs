import type { Metadata } from "next";
import Link from "next/link";
import { Section, SecHead } from "@/components/ui/Heads";
import { Icon, type IconName } from "@/components/ui/Icons";
import { NewsRow, NewsTile, TopNews } from "@/components/ui/News";
import { SocialCards } from "@/components/ui/Social";
import { Ticker } from "@/components/ui/Ticker";
import { PageShell } from "@/components/ui/Vt";
import { getAbout, getCurrentSeason, getGames, getGyms, getLatestPosts, getNow, getTeams, getTournaments } from "@/data/repo";
import { dayDiff, FORMS, plural, weekRange } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { pageMetadata } from "@/lib/meta";
import { paths } from "@/lib/routes";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { indexById, tickerGroups } from "@/lib/sport";

export const metadata: Metadata = {
  ...pageMetadata({ path: "/", title: SITE_NAME, description: SITE_DESCRIPTION }),
  title: { absolute: `${SITE_NAME} — КБФ` },
};

interface Want {
  title: string;
  sub: string;
  href: string;
  icon: IconName;
  /** Цифра-факт из данных; 0 — карточка без цифры. */
  n: number;
  /** Подпись к цифре в две строки. */
  unit: [string, string];
}

/** «Я хочу»: четыре карточки, первая — navy (одна акцентная на блок). */
function WantCards({ items }: { items: Want[] }) {
  return (
    <div className="k-want">
      {items.map((w, i) => (
        <Link key={w.href} className={i === 0 ? "k-card k-want__card k-want__card--dark" : "k-card k-want__card"} href={w.href}>
          <span className="k-want__top">
            <span className="k-want__icon">
              <Icon name={w.icon} />
            </span>
            <span className="k-want__go" aria-hidden>
              →
            </span>
          </span>
          {w.n > 0 ? (
            <span className="k-want__fact">
              <b>{w.n}</b>
              <span>
                {w.unit[0]}
                <br />
                {w.unit[1]}
              </span>
            </span>
          ) : (
            <span className="k-want__fact" aria-hidden />
          )}
          <span className="k-want__title">{w.title}</span>
          <span className="k-want__sub">{w.sub}</span>
          <Icon name={w.icon} className="k-want__ghost" />
        </Link>
      ))}
    </div>
  );
}

/**
 * Главная (концепция А): лента матчей (вчера · сегодня · далее), главная новость и «Ещё
 * главное», «Я хочу» с цифрами из данных, новости, соцсети.
 */
async function HomePageContent() {
  const [now, games, teamsList, gyms, tournaments, posts, about, season] = await Promise.all([
    getNow(),
    getGames(),
    getTeams(),
    getGyms(),
    getTournaments(),
    getLatestPosts(7),
    getAbout(),
    getCurrentSeason(),
  ]);
  const teams = indexById(teamsList);
  const tById = indexById(tournaments);
  const groups = tickerGroups(games, now);

  // Цифры «Я хочу»: матчей на этой неделе (пн–вс по Бишкеку), площадок, детских команд,
  // турниров текущего сезона
  const week = weekRange(now);
  const weekGames = games.filter((g) => {
    const d = dayDiff(g.scheduledAt, now);
    return d != null && d >= week.from && d <= week.to && g.status !== "cancelled";
  }).length;
  const kidTeams = teamsList.filter((t) => t.division !== "adult").length;
  const seasonTournaments = tournaments.filter((t) => t.season === season).length;
  const L = DEFAULT_LOCALE;
  const wants: Want[] = [
    { title: "Сходить на матч", sub: "Расписание, залы, как добраться", href: paths.games(), icon: "ticket", n: weekGames, unit: [plural(weekGames, FORMS.game, L), "на этой неделе"] },
    { title: "Поиграть самому", sub: "Залы и уличные площадки", href: paths.gyms(), icon: "hoop", n: gyms.length, unit: [plural(gyms.length, FORMS.gym, L), plural(gyms.length, ["и зал", "и зала", "и залов"], L)] },
    { title: "Привести ребёнка", sub: "Группы по возрастам и тренеры", href: paths.teams(), icon: "kid", n: kidTeams, unit: [plural(kidTeams, FORMS.kidTeam, L), plural(kidTeams, FORMS.team, L)] },
    { title: "Турниры и таблицы", sub: "Чемпионат, первенства, кубки", href: paths.tournaments(), icon: "cup", n: seasonTournaments, unit: [plural(seasonTournaments, FORMS.tournament, L), "в сезоне"] },
  ];

  const [lead, ...rest] = posts;
  const side = rest.slice(0, 3);
  // Новости ниже: на десктопе — следующие после «Ещё главного», на мобилке «Ещё главного» нет
  const deskNews = rest.slice(3, 6);
  const mobNews = rest.slice(0, 3);

  return (
    <>
      <Ticker groups={groups} teams={teams} tournaments={tById} now={now} />

      {lead ? (
        <section className="k-section" style={{ paddingTop: 16 }}>
          <div className="k-wrap">
            {/* Единственный h1 главной — заголовок главной новости, как в артборде */}
            <TopNews lead={lead} side={side} now={now} heading="h1" />
          </div>
        </section>
      ) : (
        <h1 className="k-sr">{SITE_NAME}</h1>
      )}

      <Section>
        <SecHead title="Я хочу" />
        <WantCards items={wants} />
      </Section>

      {mobNews.length || deskNews.length ? (
        // На десктопе новостей ниже «Ещё главного» может не быть — тогда блок только на мобилке
        <Section className={deskNews.length ? undefined : "k-only-m"}>
          <SecHead title="Новости" link={{ href: paths.news(), label: "Все новости →" }} />
          {mobNews.length ? (
            <div className="k-only-m k-list">
              {mobNews.map((p) => (
                <NewsRow key={p.slug} post={p} now={now} />
              ))}
            </div>
          ) : null}
          {deskNews.length ? (
            <div className="k-only-d k-gridd k-grid k-grid--3">
              {deskNews.map((p) => (
                <NewsTile key={p.slug} post={p} now={now} />
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {about.instagram || about.youtube ? (
        <Section>
          <SecHead title="Соцсети" />
          <SocialCards instagram={about.instagram} youtube={about.youtube} />
        </Section>
      ) : null}
      {/* Блок «Партнёры» скрыт, пока нет логотипов (ТЗ, corrections.md). */}
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function HomePage() {
  return (
    <PageShell>
      <HomePageContent />
    </PageShell>
  );
}
