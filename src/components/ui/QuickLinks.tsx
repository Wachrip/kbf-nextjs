import Link from "next/link";
import { Icon, type IconName } from "./Icons";

/** Куда перейти со страницы ошибки: разделы карточками «Я хочу» (концепция А). */
const QUICK: { title: string; sub: string; href: string; icon: IconName }[] = [
  { title: "Календарь", sub: "Ближайшие матчи и результаты", href: "/games", icon: "ticket" },
  { title: "Турниры", sub: "Таблицы и сетки", href: "/tournaments", icon: "cup" },
  { title: "Площадки", sub: "Залы и уличные площадки", href: "/gyms", icon: "hoop" },
  { title: "На главную", sub: "Новости и матчи дня", href: "/", icon: "home" },
];

/**
 * Быстрые ссылки 404 и ошибки (.k-want): четыре карточки, первая — navy. Без цифр — у
 * страниц ошибок нет данных (и error.tsx — клиентский).
 */
export function QuickLinks({ title = "Куда дальше" }: { title?: string }) {
  return (
    <section className="k-section">
      <div className="k-wrap">
        <div className="k-sechead">
          <h2 className="k-d-md">{title}</h2>
        </div>
        <div className="k-want">
          {QUICK.map((w, i) => (
            <Link key={w.href} className={i === 0 ? "k-card k-want__card k-want__card--dark" : "k-card k-want__card"} href={w.href}>
              <span className="k-want__top">
                <span className="k-want__icon">
                  <Icon name={w.icon} />
                </span>
                <span className="k-want__go" aria-hidden>
                  →
                </span>
              </span>
              <span className="k-want__fact" aria-hidden />
              <span className="k-want__title">{w.title}</span>
              <span className="k-want__sub">{w.sub}</span>
              <Icon name={w.icon} className="k-want__ghost" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
