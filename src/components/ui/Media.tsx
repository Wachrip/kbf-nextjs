import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { firstLetter, initialsOf } from "@/lib/format";
import type { Kit } from "@/lib/teamPalette";
import { Img } from "./Img";
import { JerseySvg } from "./Jersey";

const box = (size?: number): CSSProperties | undefined =>
  size ? { width: size, height: size } : undefined;

/**
 * Логотип команды: белый круг, object-fit: contain. Нет логотипа — первая буква названия
 * (пустых серых коробок на сайте нет). dark — на navy (табло, афиша, шапка команды).
 */
export function TeamLogo({
  name,
  logoUrl,
  size,
  dark = false,
  className,
}: {
  name: string;
  logoUrl?: string;
  size?: number;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("k-media k-media--logo", dark && "is-dark", className)} style={box(size)}>
      {logoUrl ? (
        <Img src={logoUrl} alt="" sizes={`${size ?? 104}px`} />
      ) : (
        <span className={cx("k-initials", (size ?? 0) >= 64 && "k-initials--lg")} aria-hidden>
          {firstLetter(name)}
        </span>
      )}
    </span>
  );
}

/**
 * Фото человека (игрок, тренер, руководство). Нет фото — у игрока с формой команды (jersey) —
 * майка с номером или инициалами, иначе инициалы на surface-sunken (тренеры, руководство).
 */
export function PersonPhoto({
  name,
  photoUrl,
  round = false,
  size,
  sizes,
  dark = false,
  className,
  initialsClass,
  jersey,
}: {
  name: string;
  photoUrl?: string;
  round?: boolean;
  size?: number;
  /** sizes для next/image; по умолчанию — size. */
  sizes?: string;
  dark?: boolean;
  className?: string;
  initialsClass?: string;
  /** Игрок: форма команды и номер — майка вместо инициалов, если нет фото. */
  jersey?: { kit: Kit; number?: string };
}) {
  const kit = !photoUrl && jersey;
  return (
    <span
      className={cx(
        "k-media",
        round ? "k-media--round" : "k-media--square",
        dark && "is-dark",
        kit && "k-media--kit",
        className,
      )}
      style={box(size)}
    >
      {photoUrl ? (
        <Img src={photoUrl} alt="" sizes={sizes ?? `${size ?? 96}px`} />
      ) : kit ? (
        <JerseySvg
          kit={kit.kit}
          label={kit.number ?? initialsOf(name)}
          on={dark ? "dark" : "light"}
        />
      ) : (
        <span className={cx("k-initials", initialsClass)} aria-hidden>
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
