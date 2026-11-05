import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  BOTTLENECK_THRESHOLD,
  DROP_BAD,
  extraPaymentsAtBaseline,
  fmtInt,
  fmtPct,
  fmtRub,
  type StageResult,
} from "@/lib/funnel";

export function BottleneckAlert({
  stages,
  bottlenecks,
  avgCheck,
  baselineCount,
}: {
  stages: StageResult[];
  bottlenecks: StageResult[];
  avgCheck: number;
  /** Сколько других периодов легло в «обычную» конверсию. */
  baselineCount: number;
}) {
  // Период один — узкое место там, где отваливается больше 80% людей; иначе — сравнение с медианой других периодов.
  const history =
    baselineCount > 0
      ? ` или хуже вашей обычной конверсии (медиана ${baselineCount} ${plural(baselineCount, "другого периода", "других периодов", "других периодов")}) на ${fmtPct(BOTTLENECK_THRESHOLD, 0)}+`
      : "";
  const rule = `на шаге отваливается больше ${fmtPct(DROP_BAD, 0)} людей${history}`;
  if (bottlenecks.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        Узких мест нет: ни на одном шаге не отваливается больше {fmtPct(DROP_BAD, 0)} людей
        {baselineCount > 0 && " и ни один шаг не просел относительно ваших прошлых периодов"}.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-500 bg-red-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-red-500">
        <AlertTriangle className="size-4 shrink-0" />
        {bottlenecks.length === 1 ? "Найдено узкое место" : `Найдено узких мест: ${bottlenecks.length}`}
        <span className="font-normal text-muted-foreground">· {rule}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {bottlenecks.map((s) => {
          const extra = extraPaymentsAtBaseline(stages, s);
          return (
            <li key={s.id}>
              <span className="font-medium">{s.label}</span>: дошли {fmtInt(s.value)} из {fmtInt(s.prev ?? 0)} (
              {fmtPct(s.cr ?? 0)}) —{" "}
              <span className="text-red-500">
                отвалилось {fmtPct(1 - (s.cr ?? 0))}, {fmtInt((s.prev ?? 0) - s.value)} чел.
              </span>
              {s.baseline !== null && s.deviation !== null && (
                <span className="text-muted-foreground"> · обычно у вас {fmtPct(s.baseline)}</span>
              )}
              {extra !== null && extra > 0 && avgCheck > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · как обычно ≈ +{extra.toFixed(1)} оплат, +{fmtRub(extra * avgCheck)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
