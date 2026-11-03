// Канонизация фильтров в адресе до рендера (Next 16: proxy, бывший middleware). Страницы со
// списками пререндерятся целиком, а ?region / ?type / ?season читаются внутри <Suspense> —
// там статус ответа уже не поменять. Поэтому мусорные значения отсекаются здесь, по
// статическим спискам: регионы (REGION_IDS, у турниров ещё republic), типы площадок, формат
// сезона. Значение, которое проверяется только по данным (регион, которого нет у команд
// дивизиона; сезон, которого нет у команды), страница обрабатывает сама: показывает список
// без фильтра, noindex и canonical на чистый адрес (README, «Маршруты»).
// /news сюда не входит: 404 для страницы вне диапазона и проверка ?tag требуют данных.
import { NextResponse, type NextRequest } from "next/server";
import { isGymType, isRegion } from "@/lib/labels";
import { REPUBLIC } from "@/lib/routes";
import { isSeason } from "@/lib/season";

type Check = (v: string) => boolean;

const tournamentScope: Check = (v) => v === REPUBLIC || isRegion(v);

/** Какие параметры и как проверять на каком адресе. */
function rulesFor(pathname: string): Record<string, Check> | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "teams" && parts.length === 2) return { region: isRegion };
  if (parts[0] === "teams" && parts.length === 3) return { season: isSeason };
  if (parts[0] === "gyms" && parts.length === 1) return { type: isGymType, region: isRegion };
  if (parts[0] === "tournaments" && parts.length === 1) return { region: tournamentScope };
  return null;
}

export function proxy(request: NextRequest) {
  const rules = rulesFor(request.nextUrl.pathname);
  if (!rules) return NextResponse.next();
  const url = request.nextUrl.clone();
  let changed = false;
  for (const [name, ok] of Object.entries(rules)) {
    const values = url.searchParams.getAll(name);
    // Повтор параметра, пустое или неизвестное значение — убрать (посторонние utm_* не трогаем)
    if (values.length > 1 || (values.length === 1 && !ok(values[0]!))) {
      url.searchParams.delete(name);
      changed = true;
    }
  }
  return changed ? NextResponse.redirect(url, 308) : NextResponse.next();
}

export const config = {
  matcher: ["/teams/:division", "/teams/:division/:slug", "/gyms", "/tournaments"],
};
