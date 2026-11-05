import { STAGES, type StageId, type StageValues } from "./funnel";
import { draftPeriod, type Period } from "./period";
import type { SalesMix, Tariff } from "./products";

// Формат: по строке на метрику, «ключ,значение» (разделитель , ; или таб).
// Ключ — id этапа (reach, dm, bot…) или его название, название тарифа (продажи, шт.),
// либо automation_cr / article_readers / article_views / total_payments.
export const csvTemplate = (tariffs: Tariff[]) =>
  [
    "metric;value",
    ...STAGES.map((s) => `${s.id};`),
    ...tariffs.map((t) => `${t.name.replace(/;/g, ",")};`),
    "automation_cr;",
    "article_readers;",
    "article_views;",
    "total_payments;",
  ].join("\n");

const norm = (s: string) => s.trim().toLowerCase().replace(/^["']|["']$/g, "").replace(/ё/g, "е");

function parseNumber(raw: string): number | null {
  const s = raw.replace(/["'\s ]/g, "");
  if (!s) return null;
  const pct = s.endsWith("%");
  const n = Number(s.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

export interface CsvResult {
  period: Period | null;
  errors: string[];
}

export function parseFunnelCsv(text: string, label: string, tariffs: Tariff[]): CsvResult {
  const values: Partial<StageValues> = {};
  const sales: SalesMix = {};
  const extra: Period["extra"] = {};
  const errors: string[] = [];

  // «;» или таб — если они есть в файле, иначе запятая (тогда «48,26%» не прочитается).
  const delim = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const cut = line.lastIndexOf(delim);
    if (cut < 0) continue;
    const parts = [line.slice(0, cut), line.slice(cut + 1)];
    const key = norm(parts[0]);
    const num = parseNumber(parts[1]);
    if (num === null) {
      if (i > 0 && parts[1].trim()) errors.push(`Строка ${i + 1}: «${parts[1].trim()}» — не число`);
      continue;
    }

    const stage = STAGES.find((s) => s.id === key || norm(s.label) === key || norm(s.label).startsWith(key));
    if (stage) {
      values[stage.id as StageId] = num;
      continue;
    }
    const tariff = tariffs.find((t) => t.id === key || norm(t.name) === key || norm(t.name).startsWith(key));
    if (tariff) {
      sales[tariff.id] = num;
      continue;
    }
    if (key === "automation_cr") extra.automationCr = num > 1 ? num / 100 : num;
    else if (key === "article_readers") extra.articleReaders = num;
    else if (key === "article_views") extra.articleViews = num;
    else if (key === "total_payments") extra.totalPayments = num;
    else errors.push(`Строка ${i + 1}: неизвестная метрика «${parts[0].trim()}»`);
  }

  const found = Object.keys(values).length;
  if (found < 3) {
    errors.unshift("Нужно минимум 3 этапа воронки — проверьте формат по шаблону.");
    return { period: null, errors };
  }

  const merged = Object.fromEntries(STAGES.map((s) => [s.id, values[s.id] ?? 0])) as StageValues;
  return { period: draftPeriod({ label, dates: "", values: merged, sales, extra }), errors };
}
