import { ChevronRight } from "lucide-react";
import { fmtInt, fmtPct, type MacroResult } from "@/lib/funnel";
import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "./status";

export function KpiCards({ macros }: { macros: MacroResult[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {macros.map((m, i) => {
        const st = STATUS_STYLES[m.status];
        return (
          <div key={m.id} className={cn("relative rounded-xl border bg-card p-4", st.card)}>
            {i > 0 && (
              <ChevronRight className="absolute top-1/2 -left-3 hidden size-4 -translate-y-1/2 text-muted-foreground lg:block" />
            )}
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtInt(m.value)}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{m.cr === null ? m.hint : `CR ${fmtPct(m.cr, 2)}`}</span>
              {st.label && <span className={st.text}>{st.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
