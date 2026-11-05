"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fmtInt, fmtPct, STAGES, type StageId } from "@/lib/funnel";
import { draftPeriod, type Period } from "@/lib/period";
import { TARIFFS, type TariffId } from "@/lib/products";

type ExtraKey = keyof Period["extra"];

const EXTRAS: { key: ExtraKey; label: string; pct?: boolean }[] = [
  { key: "automationCr", label: "Конверсия директ-автоматизации, %", pct: true },
  { key: "articleReaders", label: "Всего читателей статей" },
  { key: "articleViews", label: "Просмотров статей" },
  { key: "totalPayments", label: "Всего оплат за период (с пришедшими раньше)" },
];

const str = (n: number | undefined, pct = false) =>
  n === undefined || n === 0 ? "" : String(pct ? +(n * 100).toFixed(2) : n);

function num(s: string): number | undefined {
  const n = Number(s.replace(/[\s ]/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Этапы, которые вводятся сразу в процентах от предыдущего шага: клики по тарифу — от переходов на сайт. */
const PERCENT_STAGES: StageId[] = ["tariff"];

/** Значение этапа для поля формы: у процентных этапов — процент от предыдущего заполненного шага. */
function stageInputs(values: Period["values"] | undefined): Record<StageId, string> {
  const out = {} as Record<StageId, string>;
  let prev = 0;
  for (const s of STAGES) {
    const v = values?.[s.id] ?? 0;
    out[s.id] = PERCENT_STAGES.includes(s.id) && v && prev ? String(+((v / prev) * 100).toFixed(2)) : str(v);
    if (v) prev = v;
  }
  return out;
}

/**
 * Этапы воронки: число людей или процент от предыдущего заполненного шага («5%»;
 * у процентных этапов знак % не нужен). Процент сразу переводится в людей —
 * в базе хранятся только абсолютные числа.
 */
function resolveStages(raw: Record<StageId, string>) {
  const values = {} as Record<StageId, number>;
  const hints = {} as Record<StageId, string>;
  let prev = 0;
  for (const s of STAGES) {
    const text = raw[s.id].trim();
    const isPct = PERCENT_STAGES.includes(s.id) || text.endsWith("%");
    const n = num(text.replace(/%$/, ""));
    let value = 0;
    if (n !== undefined && isPct) {
      value = prev ? Math.round((n / 100) * prev) : 0;
      hints[s.id] = prev ? `= ${fmtInt(value)} чел.` : "нет пред. шага";
    } else if (n !== undefined) {
      value = Math.round(n);
      if (prev && value) hints[s.id] = fmtPct(value / prev);
    }
    values[s.id] = value;
    if (value) prev = value;
  }
  return { values, hints };
}

const input =
  "h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm tabular-nums outline-none focus-visible:border-ring";

/** Ввод цифр периода вручную; с period — правка существующего. */
export function PeriodForm({
  open,
  onOpenChange,
  period,
  isNew,
  notice,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Существующий период для правки или черновик (например, распознанный со скриншотов). */
  period: Period | null;
  isNew: boolean;
  /** Пояснение над формой — что распознано и что проверить. */
  notice?: string;
  onSubmit: (p: Period) => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Новый период" : "Изменить период"}</SheetTitle>
          <SheetDescription>
            Обязательны название и хотя бы 3 этапа воронки. Пустые этапы пропускаются в расчёте.
          </SheetDescription>
        </SheetHeader>
        {notice && (
          <div className="mx-4 rounded-lg border border-indigo-400/40 bg-indigo-400/5 px-3 py-2 text-xs">
            <div className="font-medium">Распознано со скриншотов — проверьте цифры перед сохранением.</div>
            <div className="mt-1 text-muted-foreground">{notice}</div>
          </div>
        )}
        {/* key сбрасывает поля при открытии другого периода */}
        {open && <FormBody key={period?.id ?? "new"} period={period} isNew={isNew} onSubmit={onSubmit} />}
      </SheetContent>
    </Sheet>
  );
}

function FormBody({
  period,
  isNew,
  onSubmit,
}: {
  period: Period | null;
  isNew: boolean;
  onSubmit: (p: Period) => Promise<void>;
}) {
  const [label, setLabel] = useState(period?.label ?? "");
  const [dates, setDates] = useState(period?.dates ?? "");
  const [values, setValues] = useState<Record<StageId, string>>(
    stageInputs(period?.values),
  );
  const [sales, setSales] = useState<Record<TariffId, string>>(
    Object.fromEntries(TARIFFS.map((t) => [t.id, str(period?.sales[t.id])])) as Record<TariffId, string>,
  );
  const [extra, setExtra] = useState<Record<ExtraKey, string>>(
    Object.fromEntries(EXTRAS.map((e) => [e.key, str(period?.extra[e.key], e.pct)])) as Record<ExtraKey, string>,
  );
  const [rnp, setRnp] = useState(period?.rnp ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stageHints = resolveStages(values).hints;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveStages(values);
    const stageValues = resolved.values;
    const noBase = STAGES.find((s) => resolved.hints[s.id] === "нет пред. шага");
    if (noBase) return setError(`«${noBase.label}» в процентах: заполните шаг перед ним, чтобы посчитать людей.`);
    if (!label.trim()) return setError("Укажите название периода, например «Неделя 45».");
    if (Object.values(stageValues).filter(Boolean).length < 3) return setError("Заполните хотя бы 3 этапа воронки.");

    const salesMix = Object.fromEntries(
      TARIFFS.map((t) => [t.id, num(sales[t.id])]).filter(([, v]) => v !== undefined),
    ) as Period["sales"];
    const extras = Object.fromEntries(
      EXTRAS.map((x) => {
        const v = num(extra[x.key]);
        return [x.key, v === undefined ? undefined : x.pct ? v / 100 : v];
      }).filter(([, v]) => v !== undefined),
    ) as Period["extra"];

    const base = period ?? draftPeriod();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...base,
        label: label.trim().slice(0, 60),
        dates: dates.trim().slice(0, 60),
        values: stageValues,
        sales: salesMix,
        extra: extras,
        rnp,
      });
    } catch (err) {
      setError((err as Error).message || "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-4 pb-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Название</span>
          <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Неделя 45" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Даты</span>
          <input className={input} value={dates} onChange={(e) => setDates(e.target.value)} placeholder="3–9 ноя" />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Воронка, человек</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Можно ввести процент от предыдущего шага, например «5%», — посчитаю людей сам. Справа — конверсия из
          предыдущего шага.
        </p>
        {STAGES.map((s, i) => (
          <label key={s.id} className="grid grid-cols-[1fr_6.5rem_4.5rem] items-center gap-2">
            <span className="text-sm">
              {s.label}
              {PERCENT_STAGES.includes(s.id) && (
                <span className="block text-xs text-muted-foreground">в % от «{STAGES[i - 1].label}»</span>
              )}
            </span>
            {PERCENT_STAGES.includes(s.id) ? (
              <div className="relative">
                <input
                  className={`${input} pr-6`}
                  inputMode="decimal"
                  placeholder="5"
                  value={values[s.id]}
                  onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value.replace(/%/g, "") }))}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            ) : (
              <input
                className={input}
                inputMode="decimal"
                placeholder={i === 0 ? "" : "или %"}
                value={values[s.id]}
                onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
              />
            )}
            <span className="text-right text-xs text-muted-foreground tabular-nums">{stageHints[s.id] ?? ""}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Продажи по тарифам, шт.</legend>
        {TARIFFS.map((t) => (
          <label key={t.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
            <span className="text-sm">
              {t.name} <span className="text-muted-foreground">· {t.price.toLocaleString("ru-RU")} ₽</span>
            </span>
            <input
              className={input}
              inputMode="numeric"
              value={sales[t.id]}
              onChange={(e) => setSales((v) => ({ ...v, [t.id]: e.target.value }))}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Дополнительно <span className="font-normal text-muted-foreground">· необязательно</span>
        </legend>
        {EXTRAS.map((x) => (
          <label key={x.key} className="grid grid-cols-[1fr_7rem] items-center gap-3">
            <span className="text-sm">{x.label}</span>
            <input
              className={input}
              inputMode="decimal"
              value={extra[x.key]}
              onChange={(e) => setExtra((v) => ({ ...v, [x.key]: e.target.value }))}
            />
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-medium">РНП</span>
        <Textarea
          value={rnp}
          onChange={(e) => setRnp(e.target.value)}
          placeholder="План, факт, что запускали, что сломалось…"
          className="min-h-28 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        {isNew ? "Добавить период" : "Сохранить изменения"}
      </Button>
    </form>
  );
}
