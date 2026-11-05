import { Fragment, type ReactNode } from "react";

// Минимальный рендер ответа ассистента: **жирный**, _курсив_, списки, заголовки, абзацы.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|(?<!\w)_[^_\n]+(?:_\w+)*_(?!\w))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_"))
      return (
        <em key={i} className="text-muted-foreground">
          {part.slice(1, -1)}
        </em>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const LIST_ITEM = /^\s*(\d+\.|[-•*])\s+/;

type Segment = { kind: "list"; items: string[]; marks: string[] } | { kind: "text"; lines: string[] };

export function Markdown({ text }: { text: string }) {
  const segments: Segment[] = [];
  for (const line of text.split("\n")) {
    const last = segments[segments.length - 1];
    const m = line.match(LIST_ITEM);
    if (m) {
      const mark = m[1].startsWith("-") || m[1] === "*" ? "•" : m[1];
      if (last?.kind === "list") {
        last.items.push(line.replace(LIST_ITEM, ""));
        last.marks.push(mark);
      } else segments.push({ kind: "list", items: [line.replace(LIST_ITEM, "")], marks: [mark] });
    } else if (!line.trim()) {
      segments.push({ kind: "text", lines: [] });
    } else if (last?.kind === "text" && last.lines.length) {
      last.lines.push(line);
    } else {
      segments.push({ kind: "text", lines: [line] });
    }
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (seg.kind === "list") {
          return (
            <ul key={i} className="space-y-1.5">
              {seg.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 text-muted-foreground tabular-nums">{seg.marks[j]}</span>
                  <span>{inline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (!seg.lines.length) return null;
        const joined = seg.lines.join("\n");
        if (/^#{1,4}\s/.test(joined)) {
          return (
            <p key={i} className="font-semibold">
              {inline(joined.replace(/^#{1,4}\s/, ""))}
            </p>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(joined)}
          </p>
        );
      })}
    </div>
  );
}
