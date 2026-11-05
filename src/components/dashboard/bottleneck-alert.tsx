import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BOTTLENECK_THRESHOLD, extraPaymentsAtBenchmark, fmtPct, fmtRub, type StageResult } from "@/lib/funnel";

export function BottleneckAlert({
  stages,
  bottlenecks,
  avgCheck,
}: {
  stages: StageResult[];
  bottlenecks: StageResult[];
  avgCheck: number;
}) {
  if (bottlenecks.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        Узких мест нет: ни один этап не хуже эталона более чем на {fmtPct(BOTTLENECK_THRESHOLD, 0)}.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-500 bg-red-500/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-red-500">
        <AlertTriangle className="size-4 shrink-0" />
        {bottlenecks.length === 1 ? "Найдено узкое место" : `Найдено узких мест: ${bottlenecks.length}`}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {bottlenecks.map((s) => {
          const extra = extraPaymentsAtBenchmark(stages, s);
          return (
            <li key={s.id}>
              <span className="font-medium">{s.label}</span>: {fmtPct(s.cr ?? 0)} при эталоне {fmtPct(s.benchmark ?? 0)}{" "}
              <span className="text-red-500">({fmtPct(s.deviation ?? 0, 0)})</span>
              {extra !== null && extra > 0 && avgCheck > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · на эталоне ≈ +{extra.toFixed(1)} оплат, +{fmtRub(extra * avgCheck)}
                </span>
              )}
              {extra === null && (
                <span className="text-muted-foreground">
                  {" "}
                  · ниже по воронке есть обходной трафик, потери в деньгах не оцениваем
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
