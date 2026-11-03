import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Границы server/client (см. README, «Архитектура»):
// - components/islands/*.client.tsx — браузерные островки: серверный код (data/*, next/cache,
//   server-only) сюда не попадает;
// - components/ui/* и lib/* — чистые компоненты и функции без доступа к данным: их используют и
//   серверные страницы, и островки. Данные читают только app/*, components/layout|seo и data/*.
const SERVER_CODE = {
  group: ["@/data/*", "**/*.server", "**/*.server.ts", "next/cache", "next/headers", "server-only"],
  message: "Клиентский код не импортирует серверные модули и данные.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/components/islands/**", "src/components/ui/**", "src/lib/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [SERVER_CODE] }] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
