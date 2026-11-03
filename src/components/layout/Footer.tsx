import Link from "next/link";
import { getAbout, getNow } from "@/data/repo";
import { localParts } from "@/lib/format";
import { paths } from "@/lib/routes";
import { Logo } from "./Logo";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Соревнования",
    links: [
      { label: "Календарь", href: paths.games() },
      { label: "Турниры", href: paths.tournaments() },
      { label: "Команды", href: paths.teams() },
    ],
  },
  {
    title: "Люди",
    links: [
      { label: "Игроки", href: paths.players() },
      { label: "Тренеры", href: paths.coaches() },
      { label: "Площадки", href: paths.gyms() },
    ],
  },
  {
    title: "Федерация",
    links: [
      { label: "О федерации", href: paths.about() },
      { label: "Новости", href: paths.news() },
      { label: "Контакты", href: paths.contacts() },
    ],
  },
];

/** Подвал: название и контакт федерации, три колонки ссылок (и на мобилке). */
export async function Footer() {
  const [about, now] = await Promise.all([getAbout(), getNow()]);
  const year = localParts(now)?.year;
  return (
    <footer className="k-footer">
      <div className="k-wrap k-footer__in">
        <div className="k-footer__brand">
          {/* Название федерации — в подписи логотипа (Logo), без дубля */}
          <Logo />
          <span>
            {about.address ?? "Бишкек"}
            {about.email ? (
              <>
                {" · "}
                <a href={`mailto:${about.email}`}>{about.email}</a>
              </>
            ) : null}
          </span>
          {year ? <span>© {year}</span> : null}
        </div>
        <nav className="k-footer__cols" aria-label="Разделы сайта">
          {COLS.map((c) => (
            <div className="k-footer__col" key={c.title}>
              <span className="k-label">{c.title}</span>
              {c.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
