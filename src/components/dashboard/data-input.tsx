"use client";

import { useRef } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Текст РНП выбранного периода: вставить или загрузить .txt. */
export function DataInput({
  rnp,
  onRnpChange,
  hint,
}: {
  rnp: string;
  onRnpChange: (v: string) => void;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">РНП</div>
          <div className="text-xs text-muted-foreground">Рабочий недельный план/отчёт — его учитывает AI-ассистент.</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FileUp /> TXT
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,text/plain"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onRnpChange(await f.text());
          e.target.value = "";
        }}
      />
      <Textarea
        value={rnp}
        onChange={(e) => onRnpChange(e.target.value)}
        placeholder="План, факт, что запускали, что сломалось…"
        className="mt-3 min-h-40 text-sm"
      />
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
