import { fmtInt, fmtPct, fmtRub, type StageResult, type StageStatus } from "@/lib/funnel";
import type { Period } from "@/lib/period";
import type { Economics } from "@/lib/products";
import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "./status";

const FILL: Record<StageStatus, string> = {
  bad: "bg-red-500/80",
  warn: "bg-amber-500/75",
  good: "bg-indigo-400/80",
  neutral: "bg-indigo-400/80",
};

const MIN_WIDTH = 12;

/**
 * Ширина сегмента. Охваты на порядки больше оплат (185 000 против 14), поэтому шкала
 * логарифмическая — иначе нижняя половина воронки превратилась бы в нитку.
 */
function widths(stages: StageResult[]): number[] {
  const max = Math.max(...stages.map((s) => s.value), 10);
  let prev = 100;
  return stages.map((s) => {
    if (s.missing || s.value <= 0) return prev;
    prev = MIN_WIDTH + (100 - MIN_WIDTH) * (Math.log10(s.value) / Math.log10(max));
    return prev;
  });
}

/** Воронка «Путь людей»: сегмент на каждый шаг, рядом — люди, конверсия из прошлого шага и эталон. */
export function FunnelSteps({
  stages,
  extra,
  eco,
}: {
  stages: StageResult[];
  extra: Period["extra"];
  eco: Economics;
}) {
  const w = widths(stages);
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium">Путь людей: от Reels до оплаты</div>
        <div className="text-xs text-muted-foreground">
          Процент — сколько дошло с прошлого шага; в скобках эталон. Ширина воронки — в логарифмическом масштабе.
        </div>
      </div>
      <ul className="px-2 py-3 sm:px-4">
        {stages.map((s, i) => {
          const st = STATUS_STYLES[s.status];
          const top = w[i];
          const bottom = i < stages.length - 1 ? w[i + 1] : top * 0.85;
          const note = noteFor(s, extra);
          return (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_5.5rem] items-stretch gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-col justify-center py-2 text-right">
                <span className={cn("text-sm leading-tight", s.status === "bad" && "font-medium text-red-500")}>
                  {s.label}
                </span>
                {note && <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{note}</span>}
              </div>

              <div className="relative min-h-11">
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 bottom-0.5 transition-[clip-path] duration-300",
                    s.missing ? "bg-muted" : FILL[s.status],
                  )}
                  style={{
                    clipPath: `polygon(${(100 - top) / 2}% 0, ${(100 + top) / 2}% 0, ${(100 + bottom) / 2}% 100%, ${(100 - bottom) / 2}% 100%)`,
                  }}
                />
                <div className="relative flex h-full items-center justify-center">
                  <span
                    className={cn(
                      "rounded px-1.5 text-sm font-semibold whitespace-nowrap tabular-nums",
                      s.missing ? "text-muted-foreground" : "bg-card/70 backdrop-blur-[2px]",
                    )}
                  >
                    {s.missing ? "—" : i === 0 ? fmtInt(s.value) : `${fmtInt(s.value)} чел.`}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center text-sm tabular-nums">
                {s.cr !== null ? (
                  <>
                    <span className={cn("font-medium", st.text)}>{fmtPct(s.cr)}</span>
                    {s.benchmark !== null && !s.gap && (
                      <span className="text-xs text-muted-foreground">эталон {fmtPct(s.benchmark)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{i === 0 ? "старт" : "—"}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <FunnelResult eco={eco} />
      {extra.articleReaders !== undefined && (
        <div className="flex justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>Всего читателей статей (бот, соцсети, ссылки)</span>
          <span className="shrink-0 tabular-nums">
            {fmtInt(extra.articleReaders)}
            {extra.articleViews !== undefined && ` · ${fmtInt(extra.articleViews)} просмотров`}
          </span>
        </div>
      )}
    </div>
  );
}

function noteFor(s: StageResult, extra: Period["extra"]): string | null {
  if (s.missing) return "нет данных — шаг пропущен";
  if (s.external) return "больше прошлого шага: есть люди из других источников";
  if (s.gap && s.cr !== null) return "через пропущенные шаги — без сравнения с эталоном";
  if (s.id === "tariff" && s.cr !== null) return `${fmtPct(s.cr)} от перешедших на сайт = ${fmtInt(s.value)} чел.`;
  if (s.id === "dm" && extra.automationCr !== undefined) return `конверсия автоматизации ${fmtPct(extra.automationCr, 2)}`;
  if (s.id === "paid" && extra.totalPayments !== undefined) return `всего оплат за период: ${fmtInt(extra.totalPayments)}`;
  return null;
}

/** Итог воронки: сколько купили × средний чек = выручка. */
function FunnelResult({ eco }: { eco: Economics }) {
  const approx = eco.estimated ? "≈ " : "";
  const items = [
    { label: "Купили", value: eco.sales ? fmtInt(eco.sales) : "—" },
    { label: "Средний чек", value: eco.sales ? `${approx}${fmtRub(eco.avgCheck)}` : "—" },
    { label: "Выручка", value: eco.sales ? `${approx}${fmtRub(eco.revenue)}` : "—" },
  ];
  return (
    <div className="mx-2 mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 sm:mx-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {items.map((it, i) => (
          <div key={it.label} className="relative">
            {i > 0 && (
              <span className="absolute top-1/2 -left-2.5 -translate-y-1/2 text-muted-foreground">{i === 1 ? "×" : "="}</span>
            )}
            <div className="text-xs text-muted-foreground">{it.label}</div>
            <div className="text-base font-semibold tabular-nums sm:text-lg">{it.value}</div>
          </div>
        ))}
      </div>
      {eco.estimated && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Оценка по среднему чеку из «Тарифов» — продажи по каждому тарифу не указаны.
        </p>
      )}
    </div>
  );
}
