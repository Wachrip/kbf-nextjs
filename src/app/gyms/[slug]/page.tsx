import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import { notFound } from "next/navigation";
import { GymGallery } from "@/components/islands/GymGallery.client";
import { GameCard } from "@/components/ui/GameCard";
import { BackBlock, BackLink, Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { Icon, InstagramMark } from "@/components/ui/Icons";
import { Img } from "@/components/ui/Img";
import { PhotoBlock } from "@/components/ui/Photo";
import { TeamTile } from "@/components/ui/TeamTile";
import { getGames, getGyms, getNow, getTeams, getTournaments, getGymsStrict } from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { count, FORMS, formatPhone, formatTime, telUrl } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { divisionLabel, gymType, placeLine } from "@/lib/labels";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { mapSearchUrl, socialHandle, socialUrl } from "@/lib/social";
import { indexById, sortTeams, standingOf, teamForm, teamTournament, upcoming, withResults } from "@/lib/sport";
import type { Gym } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

type Params = { slug: string };

export const instant = false;

export async function generateStaticParams(): Promise<Params[]> {
  const gyms = await getGyms();
  return nonEmpty(
    gyms.map((g) => ({ slug: g.slug })),
    { slug: PLACEHOLDER },
  );
}

async function findGym(params: PageProps<Params>["params"]): Promise<Gym | null> {
  const { slug } = await params;
  // strict: ошибка базы — error.tsx, а не 404
  const gyms = await getGymsStrict();
  return gyms.find((g) => g.slug === safeDecode(slug)) ?? null;
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const gym = await findGym(params);
  if (!gym) return notFoundMeta;
  const addr = [placeLine(gym.city, gym.region), gym.address].filter(Boolean).join(", ");
  return pageMetadata({
    path: paths.gym(gym.slug),
    title: gym.name,
    description: `${gym.name}${addr ? ` — ${addr}` : ""}. Ближайшие матчи, команды, как добраться и контакты.`,
    images: [gym.photoUrls[0]],
  });
}

/**
 * Площадка (концепция А): фото-шапка с названием, адресом и кнопками 2ГИС / телефон, полоса
 * миниатюр; ближайшие матчи здесь (карточки), «Здесь играют» (плитки команд), фото мозаикой;
 * справа — характеристики, как добраться, контакты. Покрытия, табло и маршрутов транспорта
 * в модели нет.
 */
async function GymPageContent({ params }: PageProps<Params>) {
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getNow(), getGames(), getTeams(), getTournaments()]);
  const gym = await findGym(params);
  if (!gym) notFound();
  const [now, games, teams, tournaments] = await rest;
  const teamIndex = indexById(teams);
  const tById = indexById(tournaments);
  const next = upcoming(games.filter((g) => g.gymId === gym.id), now).slice(0, 3);
  const home = sortTeams(teams.filter((t) => t.gymId === gym.id));
  const kind = gymType(gym);
  // Адрес с регионом: «Кант, Чуйская обл., Улица Тагаева, 6»; Бишкек — без повтора
  const place = placeLine(gym.city, gym.region);
  const addr = [place, gym.address].filter(Boolean).join(", ");
  const mapUrl = gym.mapUrl || (gym.address ? mapSearchUrl(gym.address, gym.city, gym.region) : undefined);
  const phone = gym.phone ? formatPhone(gym.phone) : "";
  const eyebrow = [
    kind === "outdoor" ? "Уличная площадка" : "Зал",
    kind === "indoor" && gym.capacity ? count(gym.capacity, FORMS.place, DEFAULT_LOCALE) : "",
    place,
  ]
    .filter(Boolean)
    .join(" · ");
  const homeLine = home.length ? `домашний зал: ${home.map((t) => t.name).join(", ")}` : "";

  // Название и кнопки — на фото на обеих ширинах (один h1; правка 7 старого макета больше не
  // нужна: в артборде А название в шапке и на мобилке)
  const overlay = (
    <>
      <span className="k-eyebrow" style={{ color: "#fff" }}>
        {eyebrow}
      </span>
      <h1 className="k-d-xl">{gym.name}</h1>
      {addr || homeLine ? (
        <span className="k-toplead__meta" style={{ fontSize: 14 }}>
          {[gym.address ? addr : place, homeLine].filter(Boolean).join(" · ")}
        </span>
      ) : null}
      {mapUrl || gym.phone ? (
        <div className="k-gymhero__acts">
          {mapUrl ? (
            <a className="k-btn k-btn--accent" href={mapUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="map" className="" />
              Открыть в 2ГИС
            </a>
          ) : null}
          {gym.phone ? (
            <a className="k-btn k-btn--ghost" href={telUrl(gym.phone)}>
              <Icon name="phone" className="" />
              {phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const back = <BackLink href={paths.gyms()} label="Все площадки" overlay />;
  const specs: { label: string; value: string }[] = [
    { label: "Тип", value: kind === "indoor" ? "Крытый зал" : "Уличная" },
    ...(kind === "indoor" ? [{ label: "Вместимость", value: gym.capacity ? count(gym.capacity, FORMS.place, DEFAULT_LOCALE) : "—" }] : []),
    ...(place ? [{ label: "Где", value: place }] : []),
    { label: "Команд", value: home.length ? String(home.length) : "—" },
  ];
  const shots = gym.photoUrls.slice(0, 6);
  const shape = (i: number, n: number) => (n >= 5 ? ["is-wide", "is-tall", "", "", "is-wide", ""][i] : n === 1 || (n === 3 && i === 0) ? "is-wide" : "");

  return (
    <>
      {gym.photoUrls.length ? (
        <GymGallery photos={gym.photoUrls} name={gym.name} top={back}>
          {overlay}
        </GymGallery>
      ) : (
        <PhotoBlock as="header" className="k-gymhero" sizes="100vw" top={back}>
          {overlay}
        </PhotoBlock>
      )}

      <Section>
        <div className="k-split">
          <div className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <SecHead title="Ближайшие матчи здесь" link={{ href: paths.games(next[0]?.division), label: "Календарь →" }} />
              {next.length ? (
                <div className="k-cal k-cal--3">
                  {next.map((g) => {
                    const t = g.tournamentId ? tById.get(g.tournamentId) : undefined;
                    return (
                      <GameCard
                        key={g.id}
                        game={g}
                        teams={teamIndex}
                        tournament={t}
                        dark={g.status === "live"}
                        head={
                          g.status === "live" ? (
                            <>
                              <span className="k-live">Идёт</span>
                              <span className="k-eyebrow">{g.round ? `Тур ${g.round}` : (g.stage ?? "")}</span>
                            </>
                          ) : (
                            <>
                              <span className="k-eyebrow">
                                <DayText at={g.scheduledAt} now={now} />
                                {g.round ? ` · тур ${g.round}` : g.stage ? ` · ${g.stage}` : ""}
                              </span>
                              <span className="k-gc__time">{formatTime(g.scheduledAt, DEFAULT_LOCALE)}</span>
                            </>
                          )
                        }
                        footLeft={t?.name ?? divisionLabel(g.division)}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty>Матчей здесь пока не запланировано</Empty>
              )}
            </div>
            <div>
              <SecHead title="Здесь играют" />
              {home.length ? (
                <div className="k-tgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
                  {home.map((t) => {
                    const tt = teamTournament(tournaments, t, games);
                    return <TeamTile key={t.id} team={t} row={withResults(standingOf(tt, t.id))} form={tt ? teamForm(games, tt.id, t.id) : []} />;
                  })}
                </div>
              ) : (
                <Empty>{kind === "outdoor" ? "Открытая площадка — команд КБФ здесь нет" : "Домашних команд у зала пока нет"}</Empty>
              )}
            </div>
            {shots.length > 1 ? (
              <div>
                <div className="k-sechead">
                  <h2 className="k-d-md">Фото</h2>
                  <span className="k-meta">{gym.photoUrls.length} фото</span>
                </div>
                <div className="k-gal">
                  {shots.map((src, i) => (
                    <span key={`${i}-${src}`} className={shape(i, shots.length) || undefined}>
                      <Img src={src} alt="" sizes="(min-width: 1024px) 380px, 50vw" />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <aside className="k-stack" style={{ gap: "var(--space-6)" }}>
            <div>
              <LabelHead title="Площадка" />
              <div className="k-card k-specs">
                {specs.map((x) => (
                  <div key={x.label} className="k-spec">
                    <span className="k-eyebrow">{x.label}</span>
                    <b>{x.value}</b>
                  </div>
                ))}
              </div>
            </div>
            {addr ? (
              <div>
                <LabelHead title="Как добраться" />
                <div className="k-card k-contact">
                  <span className="k-socrow__ico">
                    <Icon name="pin" className="" />
                  </span>
                  <span className="k-contact__body">
                    <span className="k-eyebrow">Адрес</span>
                    <span className="k-contact__value">{addr}</span>
                    {mapUrl ? (
                      <a className="k-link" href={mapUrl} target="_blank" rel="noopener noreferrer">
                        Открыть в 2ГИС →
                      </a>
                    ) : null}
                  </span>
                </div>
              </div>
            ) : null}
            <div>
              <LabelHead title="Контакты" />
              {gym.phone || gym.instagram ? (
                <div className="k-list">
                  {gym.phone ? (
                    <a className="k-card k-card--dark k-contact" href={telUrl(gym.phone)}>
                      <span className="k-socrow__ico">
                        <Icon name="phone" className="" />
                      </span>
                      <span className="k-contact__body">
                        <span className="k-eyebrow">Телефон</span>
                        <span className="k-contact__value">{phone}</span>
                      </span>
                      <span className="k-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  ) : null}
                  {gym.instagram ? (
                    <a className="k-card k-contact" href={socialUrl("instagram", gym.instagram)} target="_blank" rel="noopener noreferrer">
                      <span className="k-socrow__ico is-ig">
                        <InstagramMark />
                      </span>
                      <span className="k-contact__body">
                        <span className="k-eyebrow">Instagram</span>
                        <span className="k-contact__value">{socialHandle(gym.instagram)}</span>
                      </span>
                      <span className="k-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : (
                <Empty>Контакты площадки не указаны</Empty>
              )}
            </div>
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.gyms()} label="Все площадки" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function GymPage(props: PageProps<Params>) {
  return (
    <PageShell>
      <GymPageContent {...props} />
    </PageShell>
  );
}
