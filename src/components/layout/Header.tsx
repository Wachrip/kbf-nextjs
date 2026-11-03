import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav, HeaderNavFallback } from "../islands/HeaderNav.client";
import { Logo } from "./Logo";

/** Шапка сайта: логотип и меню. Меню — островок (активный пункт по адресу) в Suspense. */
export function Header() {
  return (
    <header className="k-header">
      <div className="k-wrap k-header__in">
        <Logo eager />
        <Suspense fallback={<HeaderNavFallback />}>
          <HeaderNav
            logo={<Logo />}
            foot={
              <Link className="k-btn k-btn--cta" href="/teams">
                Хочу заниматься
              </Link>
            }
          />
        </Suspense>
      </div>
    </header>
  );
}
