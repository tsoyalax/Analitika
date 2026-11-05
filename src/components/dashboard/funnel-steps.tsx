import { fmtInt, fmtPct, type StageResult } from "@/lib/funnel";
import type { Period } from "@/lib/period";
import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "./status";

/** Пошаговая воронка: абсолют, конверсия из прошлого шага и эталон. */
export function FunnelSteps({ stages, extra }: { stages: StageResult[]; extra: Period["extra"] }) {
  // Охваты на порядки больше остальных этапов — полосы считаем от «Написали в директ».
  const scaleBase = Math.max(...stages.slice(1).map((s) => s.value), 1);
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium">Путь людей: от Reels до оплаты</div>
        <div className="text-xs text-muted-foreground">Процент — сколько дошло с прошлого шага; в скобках эталон.</div>
      </div>
      <ul>
        {stages.map((s, i) => {
          const st = STATUS_STYLES[s.status];
          const width = i === 0 ? 100 : Math.max((s.value / scaleBase) * 100, 1.5);
          return (
            <li
              key={s.id}
              className={cn(
                "border-b border-l-2 border-l-transparent px-4 py-3 last:border-b-0",
                s.status === "bad" && "border-l-red-500 bg-red-500/10",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="hidden text-muted-foreground sm:inline"> · {s.hint}</span>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <span className="font-semibold">{fmtInt(s.value)}</span>
                  {s.cr !== null && <span className={cn("ml-2", st.text)}>{fmtPct(s.cr)}</span>}
                  {s.benchmark !== null && s.cr !== null && !s.gap && (
                    <span className="ml-1 text-xs text-muted-foreground">({fmtPct(s.benchmark)})</span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", st.bar)} style={{ width: `${width}%` }} />
              </div>
              {s.missing && <div className="mt-1 text-xs text-muted-foreground">Нет данных — шаг пропущен в расчёте конверсий.</div>}
              {s.gap && s.cr !== null && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Конверсия через пропущенные шаги — с эталоном не сравниваем.
                </div>
              )}
              {s.external && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Больше прошлого шага — сюда приходят люди из других источников, конверсию не считаем.
                </div>
              )}
              {s.id === "dm" && extra.automationCr !== undefined && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Конверсия директ-автоматизации: {fmtPct(extra.automationCr, 2)}
                </div>
              )}
              {s.id === "paid" && extra.totalPayments !== undefined && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Всего за период {fmtInt(extra.totalPayments)} оплат, включая пришедших раньше
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {extra.articleReaders !== undefined && (
        <div className="flex justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>Всего читателей статей (бот, соцсети, ссылки)</span>
          <span className="tabular-nums">
            {fmtInt(extra.articleReaders)}
            {extra.articleViews !== undefined && ` · ${fmtInt(extra.articleViews)} просмотров`}
          </span>
        </div>
      )}
    </div>
  );
}
