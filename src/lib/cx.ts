/** Склейка классов: cx("k-card", dark && "k-card--dark") → "k-card k-card--dark". */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
