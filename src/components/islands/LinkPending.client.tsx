"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

/**
 * Подпись внутри <Link> с состоянием «нажато, идёт переход» (useLinkStatus — только в
 * потомке Link). Сам Link остаётся серверным; приглушение всего чипа или номера страницы —
 * CSS :has([aria-busy="true"]) в kbf-extra.css. pending не включается, если страница уже
 * в кэше роутера и переход мгновенный.
 */
export function LinkPending({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="k-pending" aria-busy={pending || undefined}>
      {children}
    </span>
  );
}
