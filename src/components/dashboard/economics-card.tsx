import { fmtRub, type StageValues } from "@/lib/funnel";
import { PRODUCT, type Economics } from "@/lib/products";

export function EconomicsCard({ eco, values }: { eco: Economics; values: StageValues }) {
  const rub = (n: number | null) => (eco.sales && n !== null ? fmtRub(n) : "—");
  const metrics = [
    { label: "Выручка", value: rub(eco.revenue) },
    { label: "Средний чек", value: rub(eco.avgCheck) },
    { label: "На 1 человека в боте", value: rub(values.bot ? eco.revenue / values.bot : null) },
    { label: "На 1000 охватов", value: rub(values.reach ? (eco.revenue / values.reach) * 1000 : null) },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">Деньги</div>
        <a href={PRODUCT.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
          цены: {PRODUCT.url.replace("https://", "")}
        </a>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-lg font-semibold tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>
      {!eco.sales && (
        <p className="mt-3 text-xs text-muted-foreground">
          Укажите продажи по тарифам (кнопка ✎ у периода), чтобы посчитать выручку и средний чек.
        </p>
      )}
      <div className="mt-4 space-y-2">
        {eco.mix.map((t) => (
          <div key={t.id} className="text-xs">
            <div className="flex justify-between gap-2">
              <span>
                {t.name} <span className="text-muted-foreground">· {fmtRub(t.price)}</span>
              </span>
              <span className="tabular-nums">
                {t.count} шт · {fmtRub(t.revenue)}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-indigo-400"
                style={{ width: `${eco.revenue ? (t.revenue / eco.revenue) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
