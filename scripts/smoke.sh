#!/usr/bin/env bash
# Дымовой прогон собранного сайта: коды ответов, редиректы, базовые проверки HTML.
# Запуск: pnpm build && pnpm start -p 3123   (в другом окне)  затем  bash scripts/smoke.sh
# Работает и на моках, и на Firestore: реальные адреса берёт со страниц-списков.
BASE="${BASE:-http://localhost:3123}"
fail=0
code() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }
loc()  { curl -s -o /dev/null -w '%{redirect_url}' "$BASE$1" | sed "s#^$BASE##"; }
first() { curl -s "$BASE$1" | grep -oE "href=\"$2/[^\"?#]+\"" | head -1 | sed 's/href="//;s/"$//'; }
check() { # path expected [location-substring]
  local c; c=$(code "$1")
  local mark="ok"
  if [ "$c" != "$2" ]; then mark="FAIL"; fail=1; fi
  if [ -n "$3" ] && [ "$mark" = ok ]; then
    local l; l=$(loc "$1"); case "$l" in *"$3"*) ;; *) mark="FAIL(loc=$l)"; fail=1;; esac
  fi
  printf '%-5s %s  ждали %s, получили %s\n' "$mark" "$1" "$2" "$c"
}
html() { # path : проверки разметки
  local h; h=$(curl -s "$BASE$1")
  local p=""
  echo "$h" | grep -q '<title>' || p="$p нет-title"
  echo "$h" | grep -q 'rel="canonical"' || p="$p нет-canonical"
  echo "$h" | grep -q 'og:image' || p="$p нет-og:image"
  echo "$h" | grep -q '<h1' || p="$p нет-h1"
  echo "$h" | sed 's/<script[^>]*>.*<\/script>//g' | grep -qE '>[^<]*(undefined|NaN|\[object Object\])' && p="$p мусор-в-тексте"
  if [ -n "$p" ]; then echo "HTML  $1:$p"; fail=1; fi
}

NEWS=$(first /news /news); PLAYER=$(first /players /players); COACH=$(first /coaches /coaches)
GYM=$(first /gyms /gyms); GAME=$(first /games /games); TOUR=$(first /tournaments /tournaments)
TEAM=$(first /teams/adult /teams/adult)
echo "Нашёл: $NEWS $PLAYER $COACH $GYM $GAME $TOUR $TEAM"; echo

check / 200
check /news 200; check "/news?page=999" 404; check "/news?page=abc" 308 /news; check "/news?tag=%D0%BC%D1%83%D1%81%D0%BE%D1%80" 308 /news
[ -n "$NEWS" ] && check "$NEWS" 200; check /news/net-takoy-novosti 404
check /players 200; [ -n "$PLAYER" ] && check "$PLAYER" 200; check /players/%E0%A4%A 404
check /teams 200; check /teams/adult 200; check /teams/xyz 404
if [ -n "$TEAM" ]; then
  check "$TEAM" 200
  check "${TEAM/\/adult\//\/u18\/}" 308 "$TEAM"
  check "$TEAM?season=2025-26" 200
  check "$TEAM?season=musor" 308 "$TEAM"
fi
check /coaches 200; [ -n "$COACH" ] && check "$COACH" 200
check /gyms 200; check "/gyms?type=outdoor" 200; check "/gyms?type=xx" 308 /gyms
check "/gyms?region=chui" 200; check "/gyms?region=xx" 308 /gyms; [ -n "$GYM" ] && check "$GYM" 200
check /games 200; [ -n "$GAME" ] && check "$GAME" 200; check /games/net 404
check /tournaments 200; check "/tournaments?region=republic" 200; [ -n "$TOUR" ] && check "$TOUR" 200
check /about 200; check /calendar 308 /games
check /sitemap.xml 200; check /robots.txt 200; check /net-takoy-stranitsy 404
echo
for p in / /news /players /teams /teams/adult /coaches /gyms /games /tournaments /about $NEWS $PLAYER $COACH $GYM $GAME $TOUR $TEAM; do html "$p"; done
# JSON-LD парсится
for p in / $NEWS $GAME; do
  curl -s "$BASE$p" | grep -oE '<script type="application/ld\+json">[^<]+' | sed 's/<script type="application\/ld+json">//' | \
    while read -r j; do echo "$j" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s)}catch(e){console.log("JSONLD FAIL '"$p"'");process.exit(1)}})' || fail=1; done
done
echo; [ $fail = 0 ] && echo "ВСЁ ОК" || echo "ЕСТЬ ОШИБКИ — пришли этот вывод"
