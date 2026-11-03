import { cx } from "@/lib/cx";
import { count, FORMS } from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import type { FormResult } from "@/lib/sport";

/**
 * Форма В/П: кружки последних матчей регулярки, последний справа. В — orange-ink с белой
 * буквой, П — серый. Для скринридеров — подпись текстом («Форма: победа, поражение…»).
 * mobileLast — сколько последних кружков оставить на мобилке (остальные .is-old скрыты).
 */
export function FormDots({ results, mobileLast, dark = false }: { results: FormResult[]; mobileLast?: number; dark?: boolean }) {
  if (results.length === 0) return null;
  const label = `Форма, последние ${count(results.length, FORMS.game, DEFAULT_LOCALE)}, от ранних к последнему: ${results
    .map((r) => (r === "W" ? "победа" : "поражение"))
    .join(", ")}`;
  const from = mobileLast != null ? results.length - mobileLast : 0;
  return (
    <span className={cx("k-form", dark && "k-form--dark")}>
      <span className="k-sr">{label}</span>
      {results.map((r, i) => (
        <span key={i} className={cx("k-form__dot", r === "W" ? "is-w" : "is-l", i < from && "is-old")} aria-hidden>
          {r === "W" ? "В" : "П"}
        </span>
      ))}
    </span>
  );
}
