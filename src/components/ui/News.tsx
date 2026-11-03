import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatPostDate } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { paths } from "@/lib/routes";
import type { Post } from "@/lib/types";
import { Img } from "./Img";

type PostLike = Pick<Post, "slug" | "title" | "excerpt" | "coverUrl" | "publishedAt" | "tags"> & {
  /** Время чтения, посчитанное на сервере (PostSummary.minutes). */
  minutes?: number;
};

/** Надзаголовок новости: «10 августа · лига» (рубрика = tags[0]). */
export function postEyebrow(p: PostLike, now: number, extra?: string): string {
  return [formatPostDate(p.publishedAt, now, DEFAULT_LOCALE), extra ?? p.tags[0]].filter(Boolean).join(" · ");
}

/** Обложка 16:9 или пустая подложка того же размера (без серых «коробок»: фон surface-muted). */
function Cover({
  src,
  sizes,
  priority,
  only,
}: {
  src?: string;
  sizes: string;
  priority?: boolean;
  only?: "mobile" | "desktop";
}) {
  return (
    <span className="k-media">
      {src ? <Img src={src} alt="" sizes={sizes} priority={priority} only={only} /> : null}
    </span>
  );
}

/** Строка: миниатюра 96×76 (десктоп 112×84), надзаголовок, заголовок. */
export function NewsRow({ post, now, accent = false }: { post: PostLike; now: number; accent?: boolean }) {
  return (
    <Link className="k-card k-newsrow" href={paths.post(post.slug)}>
      <span className="k-media k-media--square">
        {post.coverUrl ? <Img src={post.coverUrl} alt="" sizes="112px" /> : null}
      </span>
      <span className="k-row__body">
        <span className={cx("k-eyebrow", accent && "k-eyebrow--accent")}>{postEyebrow(post, now)}</span>
        <span className="k-newsrow__title">{post.title}</span>
      </span>
    </Link>
  );
}

/** Плитка: обложка 16:9 сверху. feature — главная новость (title-xl, анонс). */
export function NewsTile({
  post,
  now,
  feature = false,
  excerpt = false,
  priority = false,
}: {
  post: PostLike;
  now: number;
  feature?: boolean;
  excerpt?: boolean;
  /** LCP десктопной ленты: плитка в блоке k-only-d — картинка грузится только на десктопе. */
  priority?: boolean;
}) {
  return (
    <Link className={cx("k-card k-newstile", feature && "k-newstile--feature")} href={paths.post(post.slug)}>
      <Cover
        src={post.coverUrl}
        sizes={feature ? "(min-width: 1024px) 800px, 100vw" : "(min-width: 1024px) 400px, 100vw"}
        priority={priority}
        only={priority ? "desktop" : undefined}
      />
      <span className="k-newstile__body">
        <span className={cx("k-eyebrow", feature && "k-eyebrow--accent")}>
          {postEyebrow(post, now, feature ? "главное" : undefined)}
        </span>
        {feature ? (
          <span className="k-title-xl" role="heading" aria-level={3}>
            {post.title}
          </span>
        ) : (
          <span className="k-newstile__title">{post.title}</span>
        )}
        {excerpt && post.excerpt ? (
          <span className="k-body" style={{ color: "var(--text-muted)" }}>
            {post.excerpt}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Главная новость (фото с затемнением, .k-toplead) и «Ещё главное» справа (десктоп) —
 * главная страница и первая страница ленты. heading — уровень заголовка главной новости:
 * на главной это единственный h1 страницы, в ленте — h2 под h1 шапки.
 */
export function TopNews({
  lead,
  side,
  now,
  heading = "h2",
  eyebrow,
  sideRubric = false,
}: {
  lead: PostLike;
  side: PostLike[];
  now: number;
  heading?: "h1" | "h2";
  /** Надзаголовок; по умолчанию «Главное · дата». */
  eyebrow?: string;
  /** В «Ещё главном» — дата и рубрика (лента), иначе только дата (главная). */
  sideRubric?: boolean;
}) {
  const date = formatPostDate(lead.publishedAt, now, DEFAULT_LOCALE);
  const H = heading;
  const meta = [lead.minutes ? `${lead.minutes} мин чтения` : "", lead.tags[0] ?? ""].filter(Boolean).join(" · ");
  return (
    <div className="k-top">
      <Link className="k-photo k-photo--card k-toplead" href={paths.post(lead.slug)}>
        {lead.coverUrl ? <Img src={lead.coverUrl} alt="" sizes="(min-width: 1024px) 800px, 100vw" priority /> : null}
        <span className="k-photo__veil">
          <span className="k-eyebrow k-eyebrow--accent" style={{ color: "var(--orange)" }}>
            {eyebrow ?? `Главное${date ? ` · ${date}` : ""}`}
          </span>
          <H className="k-toplead__title">{lead.title}</H>
          {meta ? <span className="k-toplead__meta">{meta}</span> : null}
        </span>
      </Link>
      {side.length ? (
        <div className="k-card k-top__side">
          <span className="k-label">Ещё главное</span>
          {side.map((p) => (
            <Link key={p.slug} className="k-newsrow" href={paths.post(p.slug)}>
              <span className="k-media">{p.coverUrl ? <Img src={p.coverUrl} alt="" sizes="96px" /> : null}</span>
              <span className="k-row__body">
                <span className="k-eyebrow">{sideRubric ? postEyebrow(p, now) : formatPostDate(p.publishedAt, now, DEFAULT_LOCALE)}</span>
                <span className="k-newsrow__title">{p.title}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
