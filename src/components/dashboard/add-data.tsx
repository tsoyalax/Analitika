"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CSV_TEMPLATE, parseFunnelCsv } from "@/lib/csv";
import type { Period } from "@/lib/period";

export function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "funnel-template.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** Кнопки «Ввести вручную» / «Загрузить CSV» / шаблон. */
export function AddData({
  onManual,
  onCsv,
  size = "sm",
}: {
  onManual: () => void;
  onCsv: (p: Period) => void;
  size?: "sm" | "default";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFile(file: File) {
    const label = file.name.replace(/\.csv$/i, "").slice(0, 60) || "Период из CSV";
    const { period, errors } = parseFunnelCsv(await file.text(), label);
    setErrors(errors);
    if (period) onCsv(period);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size={size} onClick={onManual}>
          <Plus /> Ввести вручную
        </Button>
        <Button size={size} variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp /> Загрузить CSV
        </Button>
        <Button size={size} variant="ghost" onClick={downloadTemplate}>
          <Download /> Шаблон CSV
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
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
