import { ListHero, Section } from "./Heads";

/**
 * Скелет списка для Suspense-оболочки: настоящая тёмная шапка (k-lhero, концепция А) (заголовок известен заранее),
 * подзаголовок и контент — серые блоки k-skel. Только там, где оболочка статическая, а данные
 * зависят от searchParams (/players, /games): страницам с instant=false loading не нужен —
 * см. README, «Скорость».
 */
export function ListSkeleton({
  title,
  variant,
}: {
  title: string;
  /** cards — сетка карточек игроков; rounds — туры календаря. */
  variant: "cards" | "rounds";
}) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <ListHero title={title} sub={<span className="k-skel k-skel--sub" />} />
      <Section>
        {variant === "cards" ? (
          <div className="k-stack" style={{ gap: 16 }}>
            <span className="k-skel k-skel--field" />
            <div className="k-pgrid">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="k-skel k-skel--card" />
              ))}
            </div>
          </div>
        ) : (
          <div className="k-stack" style={{ gap: 12 }}>
            <span className="k-skel k-skel--line" style={{ width: 120 }} />
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="k-skel k-skel--round" />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
