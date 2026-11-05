import type { StageStatus } from "@/lib/funnel";

export const STATUS_STYLES: Record<StageStatus, { card: string; bar: string; text: string; label: string }> = {
  bad: { card: "bg-red-500/10 border-red-500", bar: "bg-red-500", text: "text-red-500", label: "Узкое место" },
  warn: { card: "bg-amber-500/5 border-amber-500/50", bar: "bg-amber-500", text: "text-amber-500", label: "Ниже нормы" },
  good: { card: "border-border", bar: "bg-indigo-400", text: "text-emerald-500", label: "В норме" },
  neutral: { card: "border-border", bar: "bg-indigo-400", text: "text-muted-foreground", label: "" },
};
