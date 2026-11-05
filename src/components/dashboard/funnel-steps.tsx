import { fmtInt, fmtPct, type StageResult, type StageStatus } from "@/lib/funnel";
import type { Period } from "@/lib/period";
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
export function FunnelSteps({ stages, extra }: { stages: StageResult[]; extra: Period["extra"] }) {
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
                      "rounded px-1.5 text-sm font-semibold tabular-nums",
                      s.missing ? "text-muted-foreground" : "bg-card/70 backdrop-blur-[2px]",
                    )}
                  >
                    {s.missing ? "—" : fmtInt(s.value)}
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
  if (s.id === "dm" && extra.automationCr !== undefined) return `конверсия автоматизации ${fmtPct(extra.automationCr, 2)}`;
  if (s.id === "paid" && extra.totalPayments !== undefined) return `всего оплат за период: ${fmtInt(extra.totalPayments)}`;
  return null;
}
