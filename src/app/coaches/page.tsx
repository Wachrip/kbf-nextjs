import type { Metadata } from "next";
import Link from "next/link";
import { Empty, FilterBar, ListHero, Section, type Fact } from "@/components/ui/Heads";
import { Img } from "@/components/ui/Img";
import { getCoaches, getCurrentSeason, getTeams } from "@/data/repo";
import { FORMS, initialsOf, nameLastFirst, plural } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { coachTeamsLine } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { paths } from "@/lib/routes";
import { seasonLabel } from "@/lib/season";
import { teamVars } from "@/lib/teamPalette";
import { PageShell } from "@/components/ui/Vt";

export const metadata: Metadata = pageMetadata({
  path: paths.coaches(),
  title: "Тренеры",
  description: "Тренеры клубов и детских групп Кыргызской баскетбольной федерации: команды, достижения, контакты для записи.",
});

/**
 * Тренеры (концепция А): тёмная шапка с цифрами, карточки с портретом в кольце цвета
 * команды, командами и первым достижением. Фильтров по дивизиону и «набирает детей» нет:
 * набора в модели нет, а фильтр по query потребовал бы Suspense и канонизации в proxy.
 */
async function CoachesPageContent() {
  const [coaches, teams, current] = await Promise.all([getCoaches(), getTeams(), getCurrentSeason()]);
  const list = [...coaches].sort((a, b) => nameLastFirst(a).localeCompare(nameLastFirst(b), "ru"));
  const teamsOf = (id: string) => teams.filter((t) => t.coachId === id);
  const withTeams = list.filter((c) => teamsOf(c.id).length > 0).length;
  const withPhone = list.filter((c) => c.phone).length;
  const facts: Fact[] = list.length
    ? [
        { label: "Тренеров", value: list.length },
        ...(withTeams ? [{ label: "С командой", value: withTeams }] : []),
        ...(withPhone ? [{ label: "Можно написать", value: withPhone, accent: true }] : []),
      ]
    : [];

  return (
    <>
      <ListHero
        title="Тренеры"
        sub={withPhone ? "Тренеры клубов и детских групп. С кем указан телефон — можно написать напрямую" : "Тренеры клубов и детских групп"}
        eyebrow={`Сезон ${seasonLabel(current)}`}
        facts={facts}
      />
      <Section>
        <FilterBar
          count={
            list.length ? (
              <>
                <b>{list.length}</b> {plural(list.length, FORMS.coach, DEFAULT_LOCALE)} · по алфавиту
              </>
            ) : null
          }
        />
        {list.length === 0 ? (
          <Empty>Тренеров пока нет</Empty>
        ) : (
          <div className="k-cgrid">
            {list.map((c) => {
              const name = nameLastFirst(c);
              const own = teamsOf(c.id);
              const line = coachTeamsLine(own);
              const note = c.achievements[0] ?? c.contactNote ?? "";
              return (
                <Link key={c.id} className="k-card k-ccard" href={paths.coach(c.slug)} style={own[0] ? teamVars(own[0]) : undefined}>
                  <span className="k-media">
                    {c.photoUrl ? (
                      <Img src={c.photoUrl} alt="" sizes="(min-width: 1024px) 88px, 60px" />
                    ) : (
                      <span className="k-initials" aria-hidden>
                        {initialsOf(name)}
                      </span>
                    )}
                  </span>
                  <span className="k-ccard__body">
                    <span className="k-ccard__name">{name}</span>
                    {line ? (
                      <span className="k-pteam">
                        <span className="k-dot" aria-hidden />
                        {line}
                      </span>
                    ) : (
                      <span className="k-ccard__note">Без команды в этом сезоне</span>
                    )}
                    {note ? <span className="k-ccard__note">{note}</span> : null}
                  </span>
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function CoachesPage() {
  return (
    <PageShell>
      <CoachesPageContent />
    </PageShell>
  );
}
