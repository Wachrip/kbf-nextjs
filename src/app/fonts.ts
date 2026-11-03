import { Manrope, Oswald } from "next/font/google";

// Самохостинг через next/font: файлы шрифтов отдаёт сам сайт, внешних запросов к Google Fonts
// нет; display: swap и preload — по умолчанию. Оба шрифта переменные (wght), поэтому без
// списка weight подключается один файл на подмножество — диапазон 400–800 / 500–700 внутри.
export const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  // Заголовочный шрифт не блокирует первый экран: без preload, до загрузки — Arial Narrow
  preload: false,
  fallback: ["Arial Narrow", "sans-serif"],
});
