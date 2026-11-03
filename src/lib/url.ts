// Разбор адресов без исключений: битый адрес от бота не должен давать 500 (из piromag-market,
// src/core/utils/url.ts).

/** decodeURIComponent, но при битой %-последовательности («/%E0%A4%A») — строка как есть. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
