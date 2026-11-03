import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ChipLinks } from "@/components/ui/Chips";
import { Empty, ListHero, Rule, Section, type Fact } from "@/components/ui/Heads";
import { NewsRow, NewsTile, TopNews } from "@/components/ui/News";
import { Pager } from "@/components/ui/Pager";
import { getCurrentSeason, getNow, getPostIndex, getPostsPage, NEWS_PAGE_SIZE } from "@/data/repo";
import type { PostIndexItem, PostSummary } from "@/data/source";
import { formatMonthYear, formatPostDate, monthKey } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { pageMetadata } from "@/lib/meta";
import { seasonYear } from "@/lib/season";
import { paths, type PageProps, type SearchParams } from "@/lib/routes";
import { PageShell } from "@/components/ui/Vt";

const TITLE = "Новости";
const SUB = "Матчи, турниры, сборные и жизнь федерации";
const DESCRIPTION = "Новости Кыргызской баскетбольной федерации: матчи, турниры, сборная и жизнь федерации.";
/** Чипы тегов появляются, когда новостей больше двадцати (ТЗ). */
const TAGS_FROM = 21;

// Страница блокирующая: searchParams читаются до Suspense, чтобы мусорный ?tag/?page давал
// настоящий 404 или редирект, а не «мягкий» 404 со статусом 200 внутри потока.
export const instant = false;

interface FeedQuery {
  page: number;
  tag: string;
  /** Канонический адрес этих параметров. */
  path: string;
  /** Адрес из запроса уже канонический (иначе — редирект на path). */
  clean: boolean;
  /** Параметры допустимы (иначе — 404 или редирект на /news). */
  valid: boolean;
  total: number;
  pages: number;
}

/**
 * Разбор ?page и ?tag по индексу опубликованных новостей (один кэшированный запрос): тег
 * сверяется со списком существующих, страница — с числом страниц. Запросы к ленте делаются
 * только с проверенными значениями — мусор в адресе не создаёт записей кэша и чтений.
 */
function parseQuery(sp: SearchParams, index: PostIndexItem[]): FeedQuery {
  const rawPage = sp.page;
  const rawTag = sp.tag;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? undefined : v);
  const tagIn = one(rawTag)?.trim() ?? "";
  const known = new Set(index.flatMap((p) => p.tags));
  const tag = tagIn && known.has(tagIn) ? tagIn : "";
  const total = tag ? index.filter((p) => p.tags.includes(tag)).length : index.length;
  const pages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const pageStr = one(rawPage);
  const pageNum = pageStr != null && /^\d{1,4}$/.test(pageStr) ? Number(pageStr) : 1;
  const tagOk = rawTag === undefined || (tagIn !== "" && tag === tagIn);
  const pageOk = rawPage === undefined || (pageStr != null && /^\d{1,4}$/.test(pageStr) && pageNum >= 1);
  const page = Math.max(1, pageNum);
  const path = paths.news({ page, tag: tag || undefined });
  // Посторонние параметры (utm_*) не трогаем — их закрывает canonical
  const clean = tagOk && pageOk && (rawPage === undefined || page > 1);
  return { page, tag, path, clean, valid: tagOk && pageOk && page <= pages, total, pages };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [sp, index] = await Promise.all([searchParams, getPostIndex()]);
  const q = parseQuery(sp, index);
  // Недопустимые параметры — noindex и canonical на ленту (страница сама ответит 404/редиректом)
  if (!q.valid) return { ...pageMetadata({ path: paths.news(), title: TITLE, description: DESCRIPTION }), robots: { index: false, follow: true } };
  return pageMetadata({
    path: q.path,
    title: q.page > 1 ? `${TITLE} — страница ${q.page}` : q.tag ? `${TITLE}: ${q.tag}` : TITLE,
    description: DESCRIPTION,
  });
}

function byMonth(posts: PostSummary[]): { key: string; label: string; posts: PostSummary[] }[] {
  const groups: { key: string; label: string; posts: PostSummary[] }[] = [];
  for (const p of posts) {
    const key = monthKey(p.publishedAt) || "none";
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: formatMonthYear(p.publishedAt, DEFAULT_LOCALE) || "Без даты", posts: [] };
      groups.push(g);
    }
    g.posts.push(p);
  }
  return groups;
}

/**
 * Цифры шапки из индекса новостей (тот же кэшированный запрос, что проверка ?page/?tag):
 * за текущий месяц и сезон (по Бишкеку; сезон — с 1 августа года старта settings/season)
 * и всего. Нет новостей — цифр нет.
 */
function feedFacts(index: PostIndexItem[], now: number, season: string): Fact[] {
  if (index.length === 0) return [];
  const month = monthKey(new Date(now).toISOString());
  const y = seasonYear(season);
  // 1 августа 00:00 по Бишкеку (UTC+6)
  const from = y != null ? Date.UTC(y, 7, 1) - 6 * 3600_000 : null;
  const inMonth = index.filter((p) => monthKey(p.publishedAt) === month).length;
  const inSeason = from != null ? index.filter((p) => (Date.parse(p.publishedAt ?? "") || 0) >= from).length : 0;
  return [
    { label: "В этом месяце", value: inMonth },
    ...(from != null ? [{ label: "За сезон", value: inSeason }] : []),
    { label: "Всего", value: index.length, accent: true },
  ];
}

/**
 * Лента (концепция А): тёмная шапка с цифрами и рубриками, главная новость и «Ещё главное»
 * (первая страница), разделители по месяцам (мобилка — строками, десктоп — плитками),
 * пагинация номерами страниц.
 */
async function NewsPageContent({ searchParams }: PageProps) {
  const [sp, index] = await Promise.all([searchParams, getPostIndex()]);
  const q = parseQuery(sp, index);
  // Неизвестный тег или мусор в адресе — на ленту; страница за пределами — настоящий 404
  // Канонизация адреса — 308: поисковик переносит сигналы на канонический адрес
  if (sp.tag !== undefined && !q.tag) permanentRedirect(paths.news());
  if (q.page > q.pages) notFound();
  if (!q.clean) permanentRedirect(q.path);

  const { page, tag, total, pages } = q;
  const [now, posts, season] = await Promise.all([getNow(), getPostsPage(page, tag), getCurrentSeason()]);

  // Рубрики — теги по частоте, до пяти, когда новостей много (ТЗ: от 21)
  const tagCounts = new Map<string, number>();
  for (const p of index) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  const chips =
    index.length >= TAGS_FROM && topTags.length > 1 ? (
      <ChipLinks
        label="Рубрики"
        items={[
          { label: "Все", href: paths.news(), current: !tag },
          ...topTags.map((t) => ({
            label: t.slice(0, 1).toUpperCase() + t.slice(1),
            href: paths.news({ tag: t }),
            current: tag === t,
          })),
        ]}
      />
    ) : null;

  const showLead = page === 1 && posts.length > 0;
  const lead = showLead ? posts[0] : undefined;
  const side = showLead ? posts.slice(1, 4) : [];
  // Мобилка: «Ещё главного» нет — после главной все остальные строками; десктоп — после блока
  // «главная + 3» плитками
  const mobileRest = showLead ? posts.slice(1) : posts;
  const desktopRest = showLead ? posts.slice(1 + side.length) : posts;
  const leadDate = lead ? formatPostDate(lead.publishedAt, now, DEFAULT_LOCALE) : "";

  return (
    <>
      <ListHero
        title={TITLE}
        sub={SUB}
        eyebrow={tag ? `Рубрика · ${tag}` : "Пресс-служба КБФ"}
        facts={feedFacts(index, now, season)}
        chips={chips}
      />

      {posts.length === 0 ? (
        <Section>
          <Empty>Новостей пока нет</Empty>
        </Section>
      ) : null}

      {lead ? (
        <section className="k-section" style={{ paddingTop: 16 }}>
          <div className="k-wrap">
            <TopNews
              lead={lead}
              side={side}
              now={now}
              sideRubric
              eyebrow={["Главное", leadDate, lead.tags[0]].filter(Boolean).join(" · ")}
            />
          </div>
        </section>
      ) : null}

      {mobileRest.length || desktopRest.length ? (
        <Section>
          {mobileRest.length ? (
            <div className="k-only-m">
              {byMonth(mobileRest).map((g, i) => (
                <div key={g.key} style={i ? { marginTop: "var(--space-6)" } : undefined}>
                  <Rule label={g.label} accent={i === 0} />
                  <div className="k-list k-newsfeed">
                    {g.posts.map((p) => (
                      <NewsRow key={p.slug} post={p} now={now} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {desktopRest.length ? (
            <div className="k-only-d">
              {byMonth(desktopRest).map((g, i) => (
                <div key={g.key} style={i ? { marginTop: "var(--space-6)" } : undefined}>
                  <Rule label={g.label} accent={i === 0} />
                  <div className="k-newsgrid">
                    {g.posts.map((p) => (
                      <NewsTile key={p.slug} post={p} now={now} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {pages > 1 ? (
            <div style={{ paddingTop: 24 }}>
              <Pager page={page} pages={pages} total={total} href={(n) => paths.news({ page: n, tag: tag || undefined })} />
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function NewsPage(props: PageProps) {
  return (
    <PageShell>
      <NewsPageContent {...props} />
    </PageShell>
  );
}
