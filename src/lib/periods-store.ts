import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGES, type StageValues } from "./funnel";
import type { Period } from "./mock-data";

// Таблица public.funnel_periods (миграция в репозитории kaizenhub).
interface Row {
  id: string;
  label: string;
  dates: string;
  stage_values: Partial<StageValues>;
  sales: Period["sales"];
  extra: Period["extra"];
  rnp: string;
}

const COLUMNS = "id,label,dates,stage_values,sales,extra,rnp";

function toPeriod(row: Row): Period {
  const values = Object.fromEntries(STAGES.map((s) => [s.id, Number(row.stage_values?.[s.id] ?? 0)])) as StageValues;
  return {
    id: row.id,
    label: row.label,
    dates: row.dates,
    values,
    sales: row.sales ?? {},
    extra: row.extra ?? {},
    rnp: row.rnp ?? "",
    uploaded: true,
    saved: true,
  };
}

export async function loadPeriods(sb: SupabaseClient): Promise<Period[]> {
  const { data, error } = await sb.from("funnel_periods").select(COLUMNS).order("created_at");
  if (error) throw error;
  return (data as Row[]).map(toPeriod);
}

export async function insertPeriod(sb: SupabaseClient, p: Period): Promise<Period> {
  const { data, error } = await sb
    .from("funnel_periods")
    .insert({ label: p.label, dates: p.dates, stage_values: p.values, sales: p.sales, extra: p.extra, rnp: p.rnp })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toPeriod(data as Row);
}

export async function updateRnp(sb: SupabaseClient, id: string, rnp: string): Promise<void> {
  const { error } = await sb.from("funnel_periods").update({ rnp }).eq("id", id);
  if (error) throw error;
}

export async function deletePeriod(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("funnel_periods").delete().eq("id", id);
  if (error) throw error;
}
