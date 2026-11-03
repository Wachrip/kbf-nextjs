"use client";

import { useEffect, useState } from "react";

/** «Скопировать ссылку» в строке автора статьи. Без мессенджеров — только адрес страницы. */
export function CopyLink() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);

  async function copy() {
    const url = window.location.href.split("#")[0]!;
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      // Старые браузеры и запрет доступа к буферу: выделяем адрес через prompt
      window.prompt("Ссылка на новость", url);
    }
  }

  return (
    <button type="button" onClick={copy} aria-live="polite">
      {done ? "Ссылка скопирована" : "Скопировать ссылку"}
    </button>
  );
}
