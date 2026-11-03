// generateStaticParams при cacheComponents обязан вернуть хотя бы один набор параметров —
// пустой массив валит сборку. Пустой список (моки без записей, недоступная база) — заглушка,
// по которой страница отдаёт 404: подчёркивания в slug не бывает (slugify оставляет [a-z0-9-]).
import "server-only";

export const PLACEHOLDER = "__placeholder__";

export function nonEmpty<T>(list: T[], placeholder: T): T[] {
  return list.length > 0 ? list : [placeholder];
}
