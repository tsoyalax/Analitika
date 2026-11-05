"use client";

import { useRef, useState } from "react";
import { Download, FileUp, ImagePlus, Loader2, Plus } from "lucide-react";
import { MAX_SCREENSHOTS } from "@/lib/screenshots";
import { Button } from "@/components/ui/button";
import { csvTemplate, parseFunnelCsv } from "@/lib/csv";
import type { Period } from "@/lib/period";
import type { Tariff } from "@/lib/products";

export function downloadTemplate(tariffs: Tariff[]) {
  const url = URL.createObjectURL(new Blob([csvTemplate(tariffs)], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "funnel-template.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** Кнопки «Со скриншотов» / «Ввести вручную» / «Загрузить CSV» / шаблон. */
export function AddData({
  onManual,
  onCsv,
  onScreenshots,
  tariffs,
  size = "sm",
}: {
  onManual: () => void;
  onCsv: (p: Period) => void;
  /** Распознать цифры со снимков; ошибка показывается под кнопками. */
  onScreenshots: (files: File[]) => Promise<void>;
  tariffs: Tariff[];
  size?: "sm" | "default";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);

  async function handleFile(file: File) {
    const label = file.name.replace(/\.csv$/i, "").slice(0, 60) || "Период из CSV";
    const { period, errors } = parseFunnelCsv(await file.text(), label, tariffs);
    setErrors(errors);
    if (period) onCsv(period);
  }

  async function handleImages(files: File[]) {
    if (files.length > MAX_SCREENSHOTS) return setErrors([`Не больше ${MAX_SCREENSHOTS} скриншотов за раз.`]);
    setErrors([]);
    setReading(true);
    try {
      await onScreenshots(files);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setReading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size={size} onClick={() => imageRef.current?.click()} disabled={reading}>
          {reading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {reading ? "Распознаю цифры…" : "Со скриншотов"}
        </Button>
        <Button size={size} variant="outline" onClick={onManual}>
          <Plus /> Ввести вручную
        </Button>
        <Button size={size} variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp /> Загрузить CSV
        </Button>
        <Button size={size} variant="ghost" onClick={() => downloadTemplate(tariffs)}>
          <Download /> Шаблон CSV
        </Button>
      </div>
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleImages(files);
          e.target.value = "";
        }}
      />
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
