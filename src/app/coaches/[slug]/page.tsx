import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { NumList, RowCard } from "@/components/ui/Cards";
import { BackBlock, BackLink, Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { CourtArt, Icon } from "@/components/ui/Icons";
import { Img } from "@/components/ui/Img";
import { TeamLogo } from "@/components/ui/Media";
import { getCoach, getCoaches, getGames, getGyms, getTeams, getTournaments } from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { count, excerptOf, firstLetter, FORMS, formatPhone, initialsOf, nameLastFirst, plural, telUrl, whatsappUrl } from "@/lib/format";
import { DEFAULT_LOCALE, localized } from "@/lib/i18n";
import { coachTeamsLine, DIVISIONS, divisionLabel, placeLine } from "@/lib/labels";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { mapSearchUrl } from "@/lib/social";
import { standingOf, teamTournament, withResults } from "@/lib/sport";
import { teamColors, teamVars } from "@/lib/teamPalette";
import type { Division } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

type Params = { slug: string };

export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const coaches = await getCoaches();
  return nonEmpty(
    coaches.map((c) => ({ slug: c.slug })),
    { slug: PLACEHOLDER },
  );
}

/** Тренер с полями на языке страницы (bio, achievements — tr). */
async function findCoach(params: PageProps<Params>["params"]) {
  const { slug } = await params;
  const coach = await getCoach(safeDecode(slug));
  return coach ? localized(coach, ["bio", "achievements"], DEFAULT_LOCALE) : null;
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const coach = await findCoach(params);
  if (!coach) return notFoundMeta;
  return pageMetadata({
    path: paths.coach(coach.slug),
    title: `${nameLastFirst(coach)} — тренер`,
    description: coach.bio
      ? excerptOf(coach.bio)
      : `${nameLastFirst(coach)} — тренер Кыргызской баскетбольной федерации. ${coach.contactNote ?? ""}`.trim(),
    images: [coach.photoUrl],
  });
}

/**
 * Тренер (концепция А): шапка в цвете главной команды (портрет — фото или инициалы, бейджи,
 * плитки «команд / дивизионов / достижений»), о тренере, достижения; справа — карточка
 * «Написать тренеру» (WhatsApp, телефон), команды, зал главной команды. Стажа, титулов и
 * расписания групп в модели нет — этих блоков нет.
 */
async function CoachPageContent({ params }: PageProps<Params>) {
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getTeams(), getTournaments(), getGames(), getGyms()]);
  const coach = await findCoach(params);
  if (!coach) notFound();
  const [teams, tournaments, games, gyms] = await rest;
  const order = (d: Division) => DIVISIONS.findIndex((x) => x.id === d);
  const own = teams.filter((t) => t.coachId === coach.id).sort((a, b) => order(a.division) - order(b.division));
  const main = own[0];
  const name = nameLastFirst(coach);
  const divisions = [...new Set(own.map((t) => t.division))].sort((a, b) => order(a) - order(b));
  const line = coachTeamsLine(own);
  const gym = main?.gymId ? gyms.find((g) => g.id === main.gymId) : undefined;
  const gymAddr = gym ? [placeLine(gym.city, gym.region), gym.address].filter(Boolean).join(", ") : "";
  const mapUrl = gym?.mapUrl || (gym?.address ? mapSearchUrl(gym.address, gym.city, gym.region) : undefined);
  const where = [main ? placeLine(main.city, main.region) : "", gym?.name ?? main?.gymName ?? ""].filter(Boolean).join(", ");

  return (
    <>
      <section className="k-teamhero k-playerhero" style={teamVars(main)}>
        <CourtArt className="k-teamhero__art" />
        <div className="k-wrap">
          <div className="k-teamhero__top">
            <BackLink href={paths.coaches()} label="Все тренеры" />
          </div>
          <div className="k-teamhero__grid">
            <div className="k-pportrait">
              {coach.photoUrl ? (
                <Img src={coach.photoUrl} alt={name} sizes="(min-width: 1024px) 380px, 100vw" priority />
              ) : (
                <span className="k-pportrait__ini" aria-hidden>
                  {initialsOf(name)}
                </span>
              )}
              {line ? (
                <span className="k-pportrait__tag">
                  <span className="k-dot" aria-hidden />
                  {line}
                </span>
              ) : null}
            </div>
            <div className="k-teamhero__main">
              <div className="k-playerhero__badges">
                <span className="k-badge k-badge--team">Тренер</span>
                {divisions.map((d) => (
                  <span key={d} className="k-badge k-badge--team-ghost">
                    {divisionLabel(d)}
                  </span>
                ))}
              </div>
              <h1 className="k-teamhero__name k-playerhero__name">
                {coach.lastName}
                <br />
                {coach.firstName}
              </h1>
              {main ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                  <Link className="k-teamlink" href={paths.team(main.division, main.slug)}>
                    <span className="k-dot" aria-hidden />
                    {main.name}
                  </Link>
                  {where ? <span className="k-teamhero__meta">{where}</span> : null}
                </div>
              ) : (
                <span className="k-teamhero__meta">Тренер федерации</span>
              )}
              <div className="k-tstats" style={{ "--n": 3 } as CSSProperties}>
                <div className="k-tstat">
                  <span>{plural(own.length, ["Команда", "Команды", "Команд"], DEFAULT_LOCALE)}</span>
                  <b>{own.length || "—"}</b>
                </div>
                <div className="k-tstat">
                  <span>{plural(divisions.length, ["Дивизион", "Дивизиона", "Дивизионов"], DEFAULT_LOCALE)}</span>
                  <b>{divisions.length || "—"}</b>
                </div>
                <div className="k-tstat">
                  <span>Достижений</span>
                  <b>{coach.achievements.length || "—"}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="k-split">
          <div className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <SecHead title="О тренере" />
              <div className="k-card k-card--pad">
                {coach.bio ? (
                  <p className="k-body-lg">{coach.bio}</p>
                ) : (
                  <p className="k-body" style={{ color: "var(--text-muted)" }}>
                    Рассказ о тренере появится позже
                  </p>
                )}
              </div>
            </div>
            <div>
              <SecHead title="Достижения" />
              {coach.achievements.length ? <NumList items={coach.achievements} /> : <Empty>Достижения пока не добавлены</Empty>}
            </div>
          </div>
          <aside className="k-stack" style={{ gap: "var(--space-6)" }}>
            {coach.phone || coach.contactNote ? (
              <div className="k-card k-card--dark k-contactcard">
                <span className="k-eyebrow">{divisions.some((d) => d !== "adult") ? "Детские команды" : "Связаться"}</span>
                <span className="k-contactcard__title">Написать тренеру</span>
                {coach.contactNote ? <p>{coach.contactNote}</p> : null}
                {coach.phone ? (
                  <div className="k-contactcard__acts">
                    <a className="k-btn k-btn--accent k-btn--block" href={whatsappUrl(coach.phone)} target="_blank" rel="noopener noreferrer">
                      <Icon name="chat" className="" />
                      Написать в WhatsApp
                    </a>
                    <a className="k-btn k-btn--ghost k-btn--block" href={telUrl(coach.phone)}>
                      <Icon name="phone" className="" />
                      {formatPhone(coach.phone)}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <LabelHead title="Команды" />
              {own.length ? (
                <div className="k-list">
                  {own.map((t) => {
                    const row = withResults(standingOf(teamTournament(tournaments, t, games), t.id));
                    return (
                      <RowCard
                        key={t.id}
                        href={paths.team(t.division, t.slug)}
                        media={
                          t.logoUrl ? (
                            <TeamLogo name={t.name} logoUrl={t.logoUrl} size={48} />
                          ) : (
                            <span className="k-crest" style={{ ...teamVars(t), width: 48, height: 48, fontSize: 24, boxShadow: "none" }} aria-hidden>
                              {firstLetter(t.name)}
                            </span>
                          )
                        }
                        teamColor={teamColors(t).color}
                        title={t.name}
                        meta={[divisionLabel(t.division), row ? `${row.place} место` : ""].filter(Boolean).join(" · ")}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty>Команд пока нет</Empty>
              )}
            </div>
            {gym ? (
              <div>
                <LabelHead title="Где тренирует" />
                <div className="k-card k-venue">
                  <span className="k-media">
                    {gym.photoUrls[0] ? (
                      <Img src={gym.photoUrls[0]} alt="" sizes="(min-width: 1024px) 400px, 100vw" />
                    ) : (
                      <span className="k-initials" aria-hidden style={{ fontSize: 40 }}>
                        {firstLetter(gym.name)}
                      </span>
                    )}
                  </span>
                  <span className="k-venue__body">
                    <Link className="k-title" href={paths.gym(gym.slug)}>
                      {gym.name}
                    </Link>
                    {gymAddr ? <span className="k-meta">{gymAddr}</span> : null}
                    <span className="k-venue__foot">
                      <span className="k-meta">{gym.capacity ? count(gym.capacity, FORMS.place, DEFAULT_LOCALE) : "Площадка"}</span>
                      {mapUrl ? (
                        <a className="k-link" href={mapUrl} target="_blank" rel="noopener noreferrer">
                          2ГИС →
                        </a>
                      ) : null}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.coaches()} label="Все тренеры" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function CoachPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <CoachPageContent {...props} />
    </PageShell>
  );
}
