"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CSV_TEMPLATE, parseFunnelCsv } from "@/lib/csv";
import type { Period } from "@/lib/mock-data";

export function DataInput({
  rnp,
  onRnpChange,
  current,
  onUpload,
}: {
  rnp: string;
  onRnpChange: (v: string) => void;
  current: Period;
  onUpload: (p: Period) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFile(file: File) {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".csv")) {
      const { period, errors } = parseFunnelCsv(text, current);
      setErrors(errors);
      if (period) onUpload({ ...period, rnp });
    } else {
      setErrors([]);
      onRnpChange(text);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "funnel-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">РНП и метрики</div>
          <div className="text-xs text-muted-foreground">Вставьте текст РНП или загрузите CSV с цифрами воронки.</div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={downloadTemplate} title="Скачать шаблон CSV">
            <Download />
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp /> CSV / TXT
          </Button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <Textarea
        value={rnp}
        onChange={(e) => onRnpChange(e.target.value)}
        placeholder="План, факт, что запускали, что сломалось…"
        className="mt-3 min-h-40 text-sm"
      />
      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-500">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
