import Image, { getImageProps } from "next/image";
import { canOptimize } from "@/lib/images";

/** Прозрачный GIF 1×1: вариант картинки для ширины, на которой блок скрыт. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Где блок с картинкой виден: мобильная и десктопная раскладки переключаются контейнерным
 * запросом .k-page (1024px ширины контейнера), а <source media> знает только ширину окна.
 * Контейнер = окно − полоса прокрутки (до ~20px), поэтому:
 * - десктопная раскладка видна только при окне ≥ 1024 → десктопный вариант пуст при < 1024;
 * - мобильная может быть видна при окне до 1024 + полоса → мобильный вариант пуст только
 *   с 1048px (запас 24px). В зазоре 1024–1047px грузятся обе версии, пустой нет ни одной.
 */
const HIDE_MEDIA = {
  mobile: "(min-width: 1048px)",
  desktop: "(max-width: 1023.98px)",
} as const;

/**
 * Фото через next/image (fill): родитель задаёт размер и position: relative (.k-media,
 * .k-photo, .k-portrait…). Фото бакета проекта и /images/* идут через оптимизатор (ресайз под
 * sizes, webp); прочие адреса — как есть. priority — главное фото (LCP): fetchPriority="high"
 * и без lazy.
 *
 * only — блок виден только на одной раскладке (k-only-m / k-only-d). Тогда картинка
 * оборачивается в <picture> с <source media> на прозрачный GIF для другой ширины: LCP-фото
 * обеих версий можно пометить priority, и браузер скачает только ту, что видна.
 */
export function Img({
  src,
  alt,
  sizes,
  priority = false,
  className,
  only,
}: {
  src: string;
  alt: string;
  /** Ширина на экране, например "(min-width: 1024px) 360px, 100vw". */
  sizes: string;
  priority?: boolean;
  className?: string;
  only?: "mobile" | "desktop";
}) {
  const common = {
    src,
    alt,
    fill: true,
    sizes,
    className,
    unoptimized: !canOptimize(src),
    fetchPriority: priority ? ("high" as const) : undefined,
    loading: priority ? ("eager" as const) : undefined,
  };
  if (!only) return <Image {...common} alt={alt} />;
  const { props } = getImageProps(common);
  return (
    <picture className="k-pic">
      <source media={HIDE_MEDIA[only]} srcSet={BLANK} />
      {/* <img> из getImageProps внутри <picture> — правило no-img-element это допускает */}
      <img {...props} alt={alt} />
    </picture>
  );
}
