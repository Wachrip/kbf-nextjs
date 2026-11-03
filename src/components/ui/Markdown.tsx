import type { ReactNode } from "react";
import { Img } from "./Img";

/**
 * Небольшой серверный рендер markdown статьи в разметку .k-prose — без зависимостей и без
 * dangerouslySetInnerHTML (текст пишет редактор в админке, HTML не пропускаем).
 * Поддержка: абзацы, ## и ### заголовки, > цитаты (последняя строка «— Автор» → подпись),
 * списки - и 1., ![подпись](url) фото с подписью, **жирный**, *курсив*, [ссылки](url).
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "h2" | "h3"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "img"; alt: string; src: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      flush();
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line);
    if (img) {
      flush();
      blocks.push({ kind: "img", alt: img[1] ?? "", src: img[2]! });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: h[1]!.length <= 2 ? "h2" : "h3", text: h[2]! });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        q.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "quote", lines: q.filter(Boolean) });
      continue;
    }
    const ul = /^[-*+]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      const re = ul ? /^[-*+]\s+(.*)$/ : /^\d+[.)]\s+(.*)$/;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]!.trim());
        if (!m) break;
        items.push(m[1]!);
        i++;
      }
      i--;
      blocks.push({ kind, items });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Разрешённые адреса: http(s), mailto, tel и локальные «/x» — но не «//host» (чужой домен). */
const SAFE_URL = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i;

/** Встроенная разметка: **жирный**, *курсив*, [текст](url). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[2] || m[3]) out.push(<strong key={key}>{m[2] ?? m[3]}</strong>);
    else if (m[4] || m[5]) out.push(<em key={key}>{m[4] ?? m[5]}</em>);
    else if (m[6] && m[7]) {
      const href = m[7];
      if (SAFE_URL.test(href)) {
        const external = /^https?:/i.test(href);
        out.push(
          <a key={key} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {m[6]}
          </a>,
        );
      } else out.push(m[6]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="k-prose">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h2":
            return <h2 key={key}>{inline(b.text, key)}</h2>;
          case "h3":
            return <h3 key={key}>{inline(b.text, key)}</h3>;
          case "quote": {
            const last = b.lines[b.lines.length - 1] ?? "";
            const hasCite = b.lines.length > 1 && /^[—–-]\s/.test(last);
            const body = hasCite ? b.lines.slice(0, -1) : b.lines;
            return (
              <blockquote key={key}>
                {body.map((l, j) => (
                  <p key={j}>{inline(l, `${key}-${j}`)}</p>
                ))}
                {hasCite ? <span className="k-caption">{last.replace(/^[—–-]\s/, "")}</span> : null}
              </blockquote>
            );
          }
          case "ul":
            return (
              <ul key={key}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case "img":
            return SAFE_URL.test(b.src) ? (
              <figure key={key}>
                <span className="k-media">
                  <Img src={b.src} alt={b.alt} sizes="(min-width: 1024px) 760px, 100vw" />
                </span>
                {b.alt ? <figcaption>{b.alt}</figcaption> : null}
              </figure>
            ) : null;
          default:
            return <p key={key}>{inline(b.text, key)}</p>;
        }
      })}
    </div>
  );
}
