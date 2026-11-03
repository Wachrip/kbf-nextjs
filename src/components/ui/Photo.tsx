import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Img } from "./Img";

/**
 * Фото с затемнением снизу (navy-deep → 95%): шапки статьи/игрока/тренера/«О федерации»,
 * главная новость, баннер «Хочу заниматься», соцсети. card — со скруглением (внутри сетки).
 * Без фото — сплошной navy-deep (текст остаётся читаемым).
 */
export function PhotoBlock({
  src,
  alt = "",
  sizes,
  priority = false,
  only,
  minHeight,
  card = false,
  className,
  top,
  children,
  as: Tag = "div",
}: {
  src?: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Блок виден только на мобилке/десктопе — см. Img(only). */
  only?: "mobile" | "desktop";
  minHeight?: string | number;
  card?: boolean;
  className?: string;
  top?: ReactNode;
  children: ReactNode;
  as?: "div" | "section" | "header";
}) {
  const style: CSSProperties | undefined = minHeight != null ? { minHeight } : undefined;
  return (
    <Tag className={cx("k-photo", card && "k-photo--card", className)} style={style}>
      {src ? <Img src={src} alt={alt} sizes={sizes} priority={priority} only={only} /> : null}
      {top ? <div className="k-photo__top">{top}</div> : null}
      <div className="k-photo__veil">{children}</div>
    </Tag>
  );
}
