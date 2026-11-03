import "server-only";
import { firestoreSource } from "./firestoreSource";
import { mockSource } from "./mockSource";
import type { KbfSource } from "./source";

/** Ошибка настройки окружения: не подменяется пустой страницей (repo.ts, safe). */
export class ConfigError extends Error {
  override name = "ConfigError";
}

type DataMode = "firestore" | "mock";

let warned = false;

/**
 * Источник данных по KBF_DATA: firestore — боевая база, mock — фикстуры. Оба режима только
 * явно (pnpm dev:mock, KBF_DATA=… в .env.local или apphosting.yaml). Без переменной или с
 * неверным значением — ошибка в лог и падение: фикстуры не должны молча оказаться на сайте.
 */
export function dataMode(): DataMode {
  const v = process.env.KBF_DATA?.trim();
  if (v === "firestore" || v === "mock") return v;
  if (v) {
    console.error(`[data] KBF_DATA=${v}: ожидается firestore или mock`);
    throw new ConfigError(`KBF_DATA=${v}: ожидается firestore или mock`);
  }
  if (!warned) {
    warned = true;
    console.error("[data] KBF_DATA не задан: укажите firestore или mock (pnpm dev:mock)");
  }
  throw new ConfigError("KBF_DATA не задан: укажите firestore или mock");
}

export function isLiveData(): boolean {
  return dataMode() === "firestore";
}

export function getSource(): KbfSource {
  return dataMode() === "firestore" ? firestoreSource : mockSource;
}
