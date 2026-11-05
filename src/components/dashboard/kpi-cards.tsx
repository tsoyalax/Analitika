import { fmtInt, fmtPct, type MacroResult } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "./status";

export function KpiCards({ macros }: { macros: MacroResult[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {macros.map((m) => {
        const st = STATUS_STYLES[m.status];
        return (
          <div key={m.id} className={cn("relative rounded-xl border bg-card p-4", st.card)}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", !m.value && "text-muted-foreground")}>
              {m.value ? fmtInt(m.value) : "—"}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {!m.value ? "нет данных" : m.cr === null ? m.hint : `CR ${fmtPct(m.cr, 2)}`}
              </span>
              {st.label && <span className={st.text}>{st.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
