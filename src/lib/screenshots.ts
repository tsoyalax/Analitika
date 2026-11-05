import type { ExtractResult } from "@/app/api/extract/route";
import { BASE_PATH } from "./config";
import { STAGES } from "./funnel";
import { draftPeriod, type Period } from "./period";
import type { Tariff } from "./products";
import { accessToken } from "./supabase";

export const MAX_SCREENSHOTS = 6;
const MAX_SIDE = 1800;

/** Уменьшаем снимок до 1800 px по большей стороне и пережимаем в JPEG — запрос остаётся лёгким. */
async function shrink(file: File): Promise<{ mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

/** Скриншоты → Claude распознаёт цифры → черновик периода для проверки в форме. */
export async function periodFromScreenshots(
  files: File[],
  tariffs: Tariff[],
): Promise<{ period: Period; notes: string }> {
  if (files.length > MAX_SCREENSHOTS) throw new Error(`Не больше ${MAX_SCREENSHOTS} скриншотов за раз.`);
  const images = await Promise.all(files.map(shrink));
  const token = await accessToken();
  const res = await fetch(`${BASE_PATH}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ images, tariffs: tariffs.map(({ name, price }) => ({ name, price })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Войдите в KaizenHub, чтобы распознавать скриншоты.");
  if (!res.ok) throw new Error(data.message ?? `Ошибка ${res.status}`);

  const r = data as ExtractResult;
  // -1 — «нет на скриншотах».
  const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v >= 0));
  const values = Object.fromEntries(
    STAGES.map((s) => [s.id, Math.max(0, Math.round(r.values[s.id] ?? 0))]),
  ) as Period["values"];

  return {
    period: draftPeriod({
      label: r.label.trim(),
      dates: r.dates.trim(),
      values,
      sales: Object.fromEntries(
        r.sales.flatMap((s) => {
          const t = tariffs.find((x) => x.name.trim().toLowerCase() === s.tariff.trim().toLowerCase());
          return t && s.count >= 0 ? [[t.id, Math.round(s.count)]] : [];
        }),
      ),
      extra: defined(r.extra),
    }),
    notes: r.notes,
  };
}
