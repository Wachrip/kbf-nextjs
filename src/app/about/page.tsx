import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NumList } from "@/components/ui/Cards";
import { Empty, LabelHead, Section, SecHead } from "@/components/ui/Heads";
import { Icon, InstagramMark, TelegramMark, YoutubeMark } from "@/components/ui/Icons";
import { Img } from "@/components/ui/Img";
import { Markdown } from "@/components/ui/Markdown";
import { PhotoBlock } from "@/components/ui/Photo";
import { getAbout, getGyms, getTeams } from "@/data/repo";
import { DEFAULT_LOCALE, localized } from "@/lib/i18n";
import { count, FORMS, formatPhone, initialsOf, plural, telUrl } from "@/lib/format";
import { STATIC } from "@/lib/images";
import { presentRegions, regionFull } from "@/lib/labels";
import { pageMetadata } from "@/lib/meta";
import { paths } from "@/lib/routes";
import { FOUNDED_YEAR, SITE_NAME } from "@/lib/site";
import { mapSearchUrl, socialHandle, socialUrl } from "@/lib/social";
import { PageShell } from "@/components/ui/Vt";

export const metadata: Metadata = pageMetadata({
  path: paths.about(),
  title: "О федерации",
  description: `${SITE_NAME}: история и миссия, руководство, контакты и соцсети.`,
  images: [STATIC.hero],
});

/** «Чем мы занимаемся» — в модели нет, статичный текст (corrections.md). */
const ACTIVITIES = [
  "Чемпионат КБФ среди взрослых команд",
  "Юниорские первенства U18 и U16",
  "Подготовка и аттестация судей и тренеров",
  "Взаимодействие с FIBA и федерациями региона",
];

/**
 * О федерации (концепция А): фото-шапка, 4 плитки-факта, история и «Чем мы занимаемся»,
 * регионы (команды и площадки из данных), руководство, контакты и соцсети. Документов
 * (регламенты, устав) в модели нет — блока нет; реквизиты не показываем (решение ТЗ).
 */
async function AboutPageContent() {
  const [raw, teams, gyms] = await Promise.all([getAbout(), getTeams(), getGyms()]);
  const about = localized(raw, ["history"], DEFAULT_LOCALE);
  const socials: { key: string; title: string; meta: string; href: string; icon: ReactNode }[] = [];
  if (about.instagram) {
    socials.push({
      key: "ig",
      title: "Instagram",
      meta: `${socialHandle(about.instagram)} · анонсы и фото с матчей`,
      href: socialUrl("instagram", about.instagram),
      icon: <InstagramMark />,
    });
  }
  if (about.youtube) socials.push({ key: "yt", title: "YouTube", meta: "Трансляции и обзоры туров", href: socialUrl("youtube", about.youtube), icon: <YoutubeMark /> });
  if (about.telegram) socials.push({ key: "tg", title: "Telegram", meta: "Анонсы матчей", href: socialUrl("telegram", about.telegram), icon: <TelegramMark /> });
  const divisions = new Set(teams.map((t) => t.division)).size;
  // Регионы: из команд и площадок; полоса — доля команд региона
  const regions = presentRegions([...teams, ...gyms]).map((r) => ({
    id: r,
    teams: teams.filter((t) => t.region === r).length,
    gyms: gyms.filter((g) => g.region === r).length,
  }));
  const contacts = Boolean(about.phone || about.email || about.address);

  return (
    <>
      {/* about-hero.jpg — 150×150, на всю ширину превращается в мыло. До исходника (README, TODO)
          шапка — hero-basketball.jpg (1600×1000). */}
      <PhotoBlock as="header" className="k-abouthero" src={STATIC.hero} sizes="100vw" priority>
        <span className="k-eyebrow" style={{ color: "#fff" }}>
          {SITE_NAME}
        </span>
        <h1 className="k-d-xl">О федерации</h1>
        <p className="k-lhero__sub">Развиваем баскетбол в Кыргызстане: от детских команд до чемпионата и национальных сборных.</p>
      </PhotoBlock>

      <Section>
        <div className="k-afacts">
          <div className="k-card k-afact is-dark">
            <b>{FOUNDED_YEAR}</b>
            <span>год основания</span>
          </div>
          <div className="k-card k-afact">
            <b>{teams.length}</b>
            <span>
              {plural(teams.length, FORMS.team, DEFAULT_LOCALE)}
              {divisions ? ` в ${divisions === 1 ? "одном дивизионе" : `${divisions === 2 ? "двух" : "трёх"} дивизионах`}` : ""}
            </span>
          </div>
          <div className="k-card k-afact">
            <b>{gyms.length}</b>
            <span>
              {plural(gyms.length, FORMS.gym, DEFAULT_LOCALE)}
              {regions.length ? ` в ${count(regions.length, ["регионе", "регионах", "регионах"], DEFAULT_LOCALE)}` : ""}
            </span>
          </div>
          <div className="k-card k-afact">
            <b>FIBA</b>
            <span>член FIBA Asia</span>
          </div>
        </div>
      </Section>

      <Section>
        <div className="k-cols">
          <div>
            <SecHead title="История и миссия" />
            {about.history ? <Markdown source={about.history} /> : <Empty>История федерации появится позже</Empty>}
          </div>
          <div>
            <LabelHead title="Чем мы занимаемся" />
            <NumList items={ACTIVITIES} />
          </div>
        </div>
      </Section>

      {regions.length ? (
        <Section>
          <SecHead title="Регионы" link={{ href: paths.gyms(), label: "Площадки →" }} />
          <div className="k-regions">
            {regions.map((r) => {
              const body = (
                <>
                  <span className="k-region__name">{regionFull(r.id)}</span>
                  <span className="k-region__nums">
                    <span>
                      <b>{r.teams}</b>
                      {plural(r.teams, FORMS.team, DEFAULT_LOCALE)}
                    </span>
                    <span>
                      <b>{r.gyms}</b>
                      {plural(r.gyms, FORMS.gym, DEFAULT_LOCALE)}
                    </span>
                  </span>
                  {teams.length ? (
                    <span className="k-progress" role="img" aria-label={`${r.teams} из ${count(teams.length, FORMS.team, DEFAULT_LOCALE)}`}>
                      <span style={{ width: `${Math.round((r.teams / teams.length) * 100)}%` }} />
                    </span>
                  ) : null}
                </>
              );
              // Ссылка — площадки региона (фильтр ?region у /gyms), если они есть
              return r.gyms ? (
                <Link key={r.id} className="k-card k-region" href={paths.gyms(undefined, r.id)}>
                  {body}
                </Link>
              ) : (
                <div key={r.id} className="k-card k-region">
                  {body}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section>
        <SecHead title="Руководство" />
        {about.staff.length ? (
          <div className="k-people">
            {about.staff.map((p) => (
              <div key={`${p.role}-${p.name}`} className="k-card k-ccard">
                <span className="k-media">
                  {p.photoUrl ? (
                    <Img src={p.photoUrl} alt="" sizes="(min-width: 1024px) 88px, 60px" />
                  ) : (
                    <span className="k-initials" aria-hidden>
                      {initialsOf(p.name)}
                    </span>
                  )}
                </span>
                <span className="k-ccard__body">
                  <span className="k-ccard__name">{p.name}</span>
                  <span className="k-ccard__note">{p.role}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Состав руководства появится позже</Empty>
        )}
      </Section>

      <Section id="contacts">
        <SecHead title="Контакты" />
        {contacts ? (
          <div className="k-contacts">
            {about.phone ? (
              <a className="k-card k-card--dark k-contact" href={telUrl(about.phone)}>
                <span className="k-socrow__ico">
                  <Icon name="phone" className="" />
                </span>
                <span className="k-contact__body">
                  <span className="k-eyebrow">Телефон</span>
                  <span className="k-contact__value">{formatPhone(about.phone)}</span>
                </span>
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </a>
            ) : null}
            {about.email ? (
              <a className="k-card k-contact" href={`mailto:${about.email}`}>
                <span className="k-socrow__ico">
                  <Icon name="mail" className="" />
                </span>
                <span className="k-contact__body">
                  <span className="k-eyebrow">Email</span>
                  <span className="k-contact__value">{about.email}</span>
                </span>
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </a>
            ) : null}
            {about.address ? (
              <a className="k-card k-contact" href={mapSearchUrl(about.address)} target="_blank" rel="noopener noreferrer">
                <span className="k-socrow__ico">
                  <Icon name="pin" className="" />
                </span>
                <span className="k-contact__body">
                  <span className="k-eyebrow">Адрес</span>
                  <span className="k-contact__value">{about.address}</span>
                  <span className="k-meta">Открыть в 2ГИС</span>
                </span>
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </a>
            ) : null}
          </div>
        ) : (
          <Empty>Контакты появятся позже</Empty>
        )}
        {socials.length ? (
          <div className="k-card k-soclist" style={{ marginTop: "var(--space-5)" }}>
            {socials.map((x) => (
              <a key={x.key} className="k-socrow" href={x.href} target="_blank" rel="noopener noreferrer">
                <span className={`k-socrow__ico is-${x.key}`}>{x.icon}</span>
                <span className="k-row__body">
                  <span className="k-row__title">{x.title}</span>
                  <span className="k-meta">{x.meta}</span>
                </span>
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </Section>
      {/* Реквизиты (settings/about.requisites) пока не показываем — решение ТЗ. */}
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function AboutPage() {
  return (
    <PageShell>
      <AboutPageContent />
    </PageShell>
  );
}
