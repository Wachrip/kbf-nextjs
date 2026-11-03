import type { Metadata } from "next";
import { DayText } from "@/components/ui/DayText";
import Link from "next/link";
import { Suspense } from "react";
import { ChipLinks } from "@/components/ui/Chips";
import { Empty, FilterBar, ListHero, Section, type Fact } from "@/components/ui/Heads";
import { Img } from "@/components/ui/Img";
import { getGames, getGyms, getNow, getTeams } from "@/data/repo";
import { count, firstLetter, FORMS, formatTime } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { gymType, isGymType, placeLine, presentRegions, regionLabel } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { firstParam, paths, pickFilter, type PageProps, type SearchParams } from "@/lib/routes";
import { mapSearchUrl } from "@/lib/social";
import { sortTeams, upcoming } from "@/lib/sport";
import { teamVars } from "@/lib/teamPalette";
import type { Game, Gym, GymType, Region, Team } from "@/lib/types";
import { PageShell } from "@/components/ui/Vt";

const TITLE = "Площадки";

// Страница пререндерится без фильтров; ?type и ?region читаются внутри <Suspense>. Мусорные
// значения — 308 в proxy.ts; регион, которого нет у площадок, — список без фильтра.

// Метаданные статические: заголовок и canonical не зависят от ?type/?region (чистый /gyms)
export const metadata: Metadata = pageMetadata({
  path: paths.gyms(),
  title: TITLE,
  description: "Баскетбольные залы и уличные площадки Бишкека и Канта: адреса, вместимость, 2ГИС, матчи.",
});

interface GymsData {
  all: Gym[];
  teams: Team[];
  games: Game[];
  now: number;
}

/**
 * Площадки (концепция А): тёмная шапка с цифрами и чипами регионов (?region=), светлые чипы
 * типа (?type=) со счётчиком, карточки с фото, вместимостью, командами зала и ближайшим
 * матчем. Оба фильтра — внутри <Suspense> (оболочка — все площадки).
 */
async function GymsPageContent({ searchParams }: PageProps) {
  const [all, teams, games, now] = await Promise.all([getGyms(), getTeams(), getGames(), getNow()]);
  const data: GymsData = { all, teams, games, now };
  // Оболочка — все площадки (пререндер, CDN); с ?type/?region — отфильтрованные
  return (
    <Suspense fallback={<GymsView {...data} />}>
      <FilteredGyms {...data} searchParams={searchParams} />
    </Suspense>
  );
}

async function FilteredGyms({ searchParams, ...data }: GymsData & { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const raw = firstParam(sp.type);
  const type: GymType | undefined = isGymType(raw) ? raw : undefined;
  const { value: region } = pickFilter<Region>(sp.region, presentRegions(data.all));
  return <GymsView {...data} type={type} region={region} />;
}

function GymsView({ all, teams, games, now, type, region }: GymsData & { type?: GymType; region?: Region }) {
  // Регионы — из всех площадок (не только выбранного типа): чипы не прыгают при смене типа
  const regions = presentRegions(all);
  const list = all
    .filter((g) => (!type || gymType(g) === type) && (!region || g.region === region))
    .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0) || a.name.localeCompare(b.name, "ru"));
  const indoor = all.filter((g) => gymType(g) === "indoor").length;
  const outdoor = all.length - indoor;
  const facts: Fact[] = all.length
    ? [
        { label: "Площадок", value: all.length },
        ...(indoor ? [{ label: "Залов", value: indoor }] : []),
        ...(outdoor ? [{ label: "Уличных", value: outdoor, accent: true }] : []),
      ]
    : [];
  const eyebrow = [count(all.length, FORMS.gym, DEFAULT_LOCALE), regions.length ? count(regions.length, FORMS.region, DEFAULT_LOCALE) : ""]
    .filter(Boolean)
    .join(" · ");
  const regionChips =
    regions.length > 1 ? (
      <ChipLinks
        label="Регион"
        items={[
          { label: `Все регионы · ${all.length}`, href: paths.gyms(type, undefined), current: !region },
          ...regions.map((r) => ({
            label: `${regionLabel(r)} · ${all.filter((g) => g.region === r).length}`,
            href: paths.gyms(type, r),
            current: r === region,
          })),
        ]}
      />
    ) : null;

  return (
    <>
      <ListHero
        title={TITLE}
        sub={all.length ? "Залы, где проходят матчи КБФ, и открытые площадки, где можно поиграть самому" : "Скоро добавим площадки"}
        eyebrow={all.length ? eyebrow : undefined}
        facts={facts}
        chips={regionChips}
      />
      <Section>
        <FilterBar
          count={
            all.length ? (
              <>
                Найдено <b>{list.length}</b>
              </>
            ) : null
          }
        >
          {indoor && outdoor ? (
            <ChipLinks
              light
              label="Тип площадки"
              items={[
                { label: "Все", href: paths.gyms(undefined, region), current: !type },
                { label: "Залы", href: paths.gyms("indoor", region), current: type === "indoor" },
                { label: "Уличные", href: paths.gyms("outdoor", region), current: type === "outdoor" },
              ]}
            />
          ) : null}
        </FilterBar>
        {list.length === 0 ? (
          <Empty>{type === "outdoor" ? "Уличных площадок пока нет" : "Площадок пока нет"}</Empty>
        ) : (
          <div className="k-vgrid">
            {list.map((g) => (
              <GymCard key={g.id} gym={g} teams={teams.filter((t) => t.gymId === g.id)} next={upcoming(games.filter((x) => x.gymId === g.id), now)[0]} now={now} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

/**
 * Карточка площадки (.k-vcard): фото с меткой (места или «Уличная»), адрес, команды зала,
 * ближайший матч и 2ГИС. Вся карточка — ссылка через k-stretch, 2ГИС — отдельная ссылка над ней.
 */
function GymCard({ gym: g, teams, next, now }: { gym: Gym; teams: Team[]; next?: Game; now: number }) {
  const kind = gymType(g);
  const addr = [placeLine(g.city, g.region), g.address].filter(Boolean).join(", ");
  const map = g.mapUrl || (g.address ? mapSearchUrl(g.address, g.city, g.region) : undefined);
  const tag = kind === "outdoor" ? "Уличная" : g.capacity ? count(g.capacity, FORMS.place, DEFAULT_LOCALE) : "Зал";
  return (
    <article className="k-card k-venue k-vcard has-stretch">
      <span className="k-media">
        {g.photoUrls[0] ? (
          <Img src={g.photoUrls[0]} alt="" sizes="(min-width: 1024px) 400px, 100vw" />
        ) : (
          <span className="k-initials" style={{ fontSize: 40 }} aria-hidden>
            {firstLetter(g.name)}
          </span>
        )}
        <span className={kind === "outdoor" ? "k-vcard__tag is-open" : "k-vcard__tag"}>{tag}</span>
      </span>
      <span className="k-venue__body">
        <Link className="k-title k-stretch" href={paths.gym(g.slug)}>
          {g.name}
        </Link>
        {addr ? <span className="k-meta">{addr}</span> : null}
        {teams.length ? (
          <span className="k-vcard__teams">
            {sortTeams(teams).map((t) => (
              <span key={t.id} style={{ ...teamVars(t), display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="k-dot" aria-hidden />
                {t.name}
              </span>
            ))}
          </span>
        ) : kind === "outdoor" ? (
          <span className="k-meta">Открытая площадка</span>
        ) : null}
        <span className="k-venue__foot">
          {next ? (
            <span className="k-vcard__next">
              <b>
                {next.status === "live" ? (
                  "Идёт"
                ) : (
                  <>
                    <DayText at={next.scheduledAt} now={now} /> · {formatTime(next.scheduledAt, DEFAULT_LOCALE)}
                  </>
                )}
              </b>
              {next.homeTeamName} — {next.awayTeamName}
            </span>
          ) : (
            <span className="k-meta">{kind === "outdoor" ? "Матчей КБФ здесь нет" : "Матчей пока не запланировано"}</span>
          )}
          {map ? (
            <a className="k-link k-above" href={map} target="_blank" rel="noopener noreferrer">
              2ГИС →
            </a>
          ) : null}
        </span>
      </span>
    </article>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function GymsPage(props: PageProps) {
  return (
    <PageShell>
      <GymsPageContent {...props} />
    </PageShell>
  );
}
