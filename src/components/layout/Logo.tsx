import Image from "next/image";
import Link from "next/link";
import mark from "../../../public/images/logo-mark-white.png";

/**
 * Логотип: знак (мяч, вырезан из logo-white.png без текста — logo-mark-white.png) и подпись
 * HTML-текстом: «КБФ» (Oswald) и «Кыргызская баскетбольная федерация» (Manrope 600) в две
 * строки. Текст не растровый — читается на любой ширине и в читалках.
 */
export function Logo({ eager = false }: { eager?: boolean }) {
  return (
    <Link className="k-logo k-brand" href="/" aria-label="КБФ — на главную">
      <Image
        className="k-brand__mark"
        src={mark}
        alt=""
        sizes="(min-width: 1024px) 44px, 38px"
        loading={eager ? "eager" : undefined}
      />
      <span className="k-brand__text" aria-hidden>
        <span className="k-brand__short">КБФ</span>
        <span className="k-brand__full">
          Кыргызская баскетбольная
          <br />
          федерация
        </span>
      </span>
    </Link>
  );
}
