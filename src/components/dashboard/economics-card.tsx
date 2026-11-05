import { fmtRub, type StageValues } from "@/lib/funnel";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Economics, Product } from "@/lib/products";

export function EconomicsCard({
  eco,
  values,
  product,
  onEditProduct,
}: {
  eco: Economics;
  values: StageValues;
  product: Product;
  onEditProduct: () => void;
}) {
  const rub = (n: number | null) => (eco.sales && n !== null ? `${eco.estimated ? "≈ " : ""}${fmtRub(n)}` : "—");
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
        <div className="flex min-w-0 items-center gap-1">
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-xs text-muted-foreground hover:underline"
            >
              цены: {product.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onEditProduct} aria-label="Продукт и тарифы">
            <Pencil />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-lg font-semibold tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>
      {eco.estimated ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Оценка: {values.paid} оплат × средний чек из «Тарифов». Для точного расчёта укажите продажи по тарифам у
          периода (✎).
        </p>
      ) : (
        !eco.sales && (
          <p className="mt-3 text-xs text-muted-foreground">
            Укажите «Полная оплата» или продажи по тарифам у периода (✎), чтобы посчитать выручку и средний чек.
          </p>
        )
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
