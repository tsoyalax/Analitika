"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BOTTLENECK_THRESHOLD, fmtPct, type StageResult } from "@/lib/funnel";

const COLORS = {
  bad: "#ef4444",
  warn: "#f59e0b",
  good: "#818cf8",
  neutral: "#818cf8",
};

/** Конверсия каждого шага в процентах от вашей обычной (медиана других периодов): 100% — как обычно. */
export function BenchmarkChart({ stages }: { stages: StageResult[] }) {
  const data = stages
    .filter((s) => s.cr !== null && s.baseline)
    .map((s) => ({
      name: s.label,
      index: Math.round(((s.cr ?? 0) / (s.baseline ?? 1)) * 100),
      cr: s.cr ?? 0,
      baseline: s.baseline ?? 0,
      status: s.status,
    }));

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-medium">Конверсия к вашей обычной</div>
      <div className="text-xs text-muted-foreground">
        100% — шаг конвертирует как обычно у вас (медиана других периодов). Ниже{" "}
        {100 - BOTTLENECK_THRESHOLD * 100}% — узкое место.
      </div>
      {data.length === 0 ? (
        <p className="mt-6 mb-4 text-center text-sm text-muted-foreground">
          Появится, когда будет хотя бы два периода — сравнивать пока не с чем.
        </p>
      ) : (
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                domain={[0, 150]}
                ticks={[0, 25, 50, 75, 100, 125, 150]}
                allowDataOverflow
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={(v: string) =>
                  v.length > 22 ? `${v.slice(0, 21)}…` : v
                }
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(_v, _n, item) => {
                  const p = item.payload as (typeof data)[number];
                  return [
                    `${fmtPct(p.cr)}, обычно ${fmtPct(p.baseline)}`,
                    `${p.index}% от обычной`,
                  ];
                }}
              />
              <ReferenceLine
                x={100}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                x={100 - BOTTLENECK_THRESHOLD * 100}
                stroke="#ef4444"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
              />
              <Bar dataKey="index" radius={[0, 4, 4, 0]} barSize={14}>
                {data.map((d) => (
                  <Cell key={d.name} fill={COLORS[d.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
