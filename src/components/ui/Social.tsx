import type { ReactNode } from "react";
import { socialHandle, socialUrl } from "@/lib/social";
import { InstagramMark, YoutubeMark } from "./Icons";

/**
 * Превью постов и видео в карточках соцсетей. Интеграции с Instagram/YouTube пока нет —
 * флаг выключен, карточки выводятся без превью (бренд-полоса, логотип, ник, кнопка). Когда
 * появятся данные — включить и передать previews.
 */
export const SOCIAL_PREVIEWS = false;

export interface SocialPreview {
  href: string;
  /** Готовая картинка (next/image) или иллюстрация. */
  media: ReactNode;
  title?: string;
}

function Previews({ items, kind }: { items: SocialPreview[]; kind: "ig" | "yt" }) {
  if (!SOCIAL_PREVIEWS || items.length === 0) return null;
  return kind === "ig" ? (
    <div className="k-soc__body">
      <div className="k-soc__posts">
        {items.slice(0, 8).map((p) => (
          <a key={p.href} className="k-soc__post" href={p.href} target="_blank" rel="noopener noreferrer">
            {p.media}
          </a>
        ))}
      </div>
    </div>
  ) : (
    <div className="k-soc__body">
      <a className="k-soc__video" href={items[0]!.href} target="_blank" rel="noopener noreferrer">
        {items[0]!.media}
        <span className="k-soc__play" aria-hidden />
      </a>
      {items[0]!.title ? <b className="k-soc__vtitle">{items[0]!.title}</b> : null}
    </div>
  );
}

/** Соцсети федерации (settings/about): Instagram и YouTube; нет ни одной — блока нет. */
export function SocialCards({
  instagram,
  youtube,
  igPreviews = [],
  ytPreviews = [],
}: {
  instagram?: string;
  youtube?: string;
  igPreviews?: SocialPreview[];
  ytPreviews?: SocialPreview[];
}) {
  if (!instagram && !youtube) return null;
  return (
    <div className="k-soc">
      {instagram ? (
        <div className="k-card k-soc__card k-soc__card--ig">
          <div className="k-soc__head">
            <span className="k-soc__logo">
              <InstagramMark />
            </span>
            <span className="k-soc__id">
              <span className="k-soc__name">Instagram</span>
              <span className="k-meta">{socialHandle(instagram)} · анонсы, фото с матчей</span>
            </span>
          </div>
          <Previews items={igPreviews} kind="ig" />
          <div className="k-soc__foot">
            <span className="k-meta">Фото и анонсы матчей</span>
            <a className="k-btn k-btn--brand" href={socialUrl("instagram", instagram)} target="_blank" rel="noopener noreferrer">
              <InstagramMark />
              Подписаться
            </a>
          </div>
        </div>
      ) : null}
      {youtube ? (
        <div className="k-card k-soc__card k-soc__card--yt">
          <div className="k-soc__head">
            <span className="k-soc__logo">
              <YoutubeMark />
            </span>
            <span className="k-soc__id">
              <span className="k-soc__name">YouTube</span>
              <span className="k-meta">Трансляции матчей и обзоры туров</span>
            </span>
          </div>
          <Previews items={ytPreviews} kind="yt" />
          <div className="k-soc__foot">
            <span className="k-meta">{socialHandle(youtube)}</span>
            <a className="k-btn k-btn--brand" href={socialUrl("youtube", youtube)} target="_blank" rel="noopener noreferrer">
              <YoutubeMark />
              Смотреть
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
