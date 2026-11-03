import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/components/islands/CopyLink.client";
import { NewsGallery } from "@/components/islands/NewsGallery.client";
import { BackBlock, BackLink, Empty, LabelHead, Section } from "@/components/ui/Heads";
import { Markdown } from "@/components/ui/Markdown";
import { NewsRow } from "@/components/ui/News";
import { PhotoBlock } from "@/components/ui/Photo";
import { JsonLd } from "@/components/seo/JsonLd";
import { getLatestPosts, getNow, getPost, getPostIndexOrEmpty } from "@/data/repo";
import { nonEmpty, PLACEHOLDER } from "@/data/staticParams";
import { excerptOf, formatLongDate, readingTime } from "@/lib/format";
import { DEFAULT_LOCALE, localized } from "@/lib/i18n";
import { STATIC } from "@/lib/images";
import { notFoundMeta, pageMetadata } from "@/lib/meta";
import { paths, type PageProps } from "@/lib/routes";
import { safeDecode } from "@/lib/url";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";
import { PageShell } from "@/components/ui/Vt";

type Params = { slug: string };

// Страница блокирующая: slug читается до Suspense, чтобы несуществующая новость отдавала
// настоящий 404. Страницы собираются заранее (generateStaticParams) и обновляются кэшем.
export const instant = false;

/** Переводимые поля новости (tr.<lang>.title и т. д.). */
const POST_TR = ["title", "excerpt", "body"] as const;

export async function generateStaticParams(): Promise<Params[]> {
  const index = await getPostIndexOrEmpty();
  return nonEmpty(
    index.map((p) => ({ slug: p.slug })),
    { slug: PLACEHOLDER },
  );
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getPost(safeDecode(slug));
  if (!raw) return notFoundMeta;
  const post = localized(raw, POST_TR, DEFAULT_LOCALE);
  return pageMetadata({
    path: paths.post(post.slug),
    title: post.title,
    description: post.excerpt || excerptOf(post.body),
    images: [post.coverUrl],
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

/** Статья (концепция А): фото-шапка, текст 740px слева, галерея мозаикой, рубрики; «Читайте также» справа. */
async function ArticlePageContent({ params }: PageProps<Params>) {
  const { slug } = await params;
  // Справочники читаются параллельно с поиском записи (не водопад); safe() не отклоняется,
  // поэтому при notFound() брошенный промис не даёт unhandled rejection.
  const rest = Promise.all([getNow(), getLatestPosts(4)]);
  const raw = await getPost(safeDecode(slug));
  if (!raw) notFound();
  const post = localized(raw, POST_TR, DEFAULT_LOCALE);
  const [now, latest] = await rest;
  const related = latest.filter((p) => p.slug !== post.slug).slice(0, 3);
  const minutes = readingTime(post.body);
  const isMain = latest[0]?.slug === post.slug;
  const rubric = post.tags[0];
  const description = post.excerpt || excerptOf(post.body);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: post.title,
          description,
          image: [post.coverUrl ?? absoluteUrl(STATIC.og)],
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          mainEntityOfPage: absoluteUrl(paths.post(post.slug)),
          inLanguage: "ru",
          ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
          author: { "@type": "Organization", name: "Пресс-служба КБФ", url: SITE_URL },
          publisher: { "@id": `${SITE_URL}/#organization`, "@type": "SportsOrganization", name: SITE_NAME, logo: absoluteUrl(STATIC.logoColor) },
        }}
      />
      {/* Шапка статьи (.k-arthero): фото на всю ширину, «← Все новости» поверх, рубрика и дата, h1 */}
      <PhotoBlock
        as="header"
        className="k-arthero"
        src={post.coverUrl}
        alt=""
        sizes="100vw"
        priority
        top={<BackLink href={paths.news()} label="Все новости" overlay />}
      >
        <div className="k-stack" style={{ gap: 12 }}>
          <div className="k-arthero__meta">
            {isMain ? <span className="k-badge">Главное</span> : rubric ? <span className="k-badge">{rubric}</span> : null}
            <span>
              <time dateTime={post.publishedAt}>{formatLongDate(post.publishedAt, DEFAULT_LOCALE)}</time>
              {isMain && rubric ? ` · ${rubric}` : ""}
            </span>
          </div>
          <h1 className="k-headline">{post.title}</h1>
        </div>
      </PhotoBlock>

      <Section>
        <div className="k-split">
          <article className="k-article">
            {post.excerpt ? <p className="k-lead">{post.excerpt}</p> : null}
            <div className="k-byline">
              <span className="k-byline__who">
                <span className="k-media" aria-hidden>
                  <span className="k-initials">ПС</span>
                </span>
                Пресс-служба КБФ
              </span>
              {minutes ? (
                <>
                  <span className="k-byline__dot" aria-hidden />
                  <span>{minutes}</span>
                </>
              ) : null}
              <CopyLink />
            </div>
            {post.body ? <Markdown source={post.body} /> : <Empty>Текст новости появится позже</Empty>}
            {post.source !== "internal" && post.sourceUrl ? (
              <p className="k-caption">
                Источник:{" "}
                <a className="k-link" href={post.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {post.source === "telegram" ? "Telegram" : "Instagram"} →
                </a>
              </p>
            ) : null}
            {post.gallery?.length ? (
              <div>
                <div className="k-sechead">
                  <h2 className="k-d-md">Галерея</h2>
                  <span className="k-meta">{post.gallery.length} фото</span>
                </div>
                <NewsGallery photos={post.gallery} title={post.title} />
              </div>
            ) : null}
            {/* «В материале»: в модели у новости только теги (команд и турниров нет) — ссылки на ленту рубрики */}
            {post.tags.length ? (
              <div className="k-tagline">
                <span className="k-label">Рубрики</span>
                {post.tags.map((t) => (
                  <Link key={t} className="k-tag" href={paths.news({ tag: t })}>
                    {t}
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
          <aside className="k-stack k-sticky" style={{ gap: "var(--space-6)" }}>
            <div>
              <LabelHead title="Читайте также" link={{ href: paths.news(), label: "Все →" }} />
              {related.length ? (
                <div className="k-list">
                  {related.map((p) => (
                    <NewsRow key={p.slug} post={p} now={now} />
                  ))}
                </div>
              ) : (
                <Empty>Других новостей пока нет</Empty>
              )}
            </div>
          </aside>
        </div>
      </Section>
      <BackBlock href={paths.news()} label="Все новости" />
    </>
  );
}

/** Корень страницы — PageShell (crossfade навигации, View Transitions за флагом). */
export default function ArticlePage(props: PageProps<Params>) {
  return (
    <PageShell>
      <ArticlePageContent {...props} />
    </PageShell>
  );
}
