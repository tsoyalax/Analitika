import { STAGES, type StageValues } from "./funnel";
import type { SalesMix } from "./products";

export interface Period {
  id: string;
  label: string;
  dates: string;
  values: StageValues;
  sales: SalesMix;
  /** Дополнительные метрики, которые не ложатся в цепочку воронки. */
  extra: {
    automationCr?: number;
    articleReaders?: number;
    articleViews?: number;
    totalPayments?: number;
  };
  rnp: string;
  /** Период хранится в Supabase (id — uuid строки). */
  saved?: boolean;
}

export const emptyValues = (): StageValues =>
  Object.fromEntries(STAGES.map((s) => [s.id, 0])) as StageValues;

/** Новый период, ещё не сохранённый: id временный. */
export function draftPeriod(patch: Partial<Period> = {}): Period {
  return {
    id: `local-${crypto.randomUUID()}`,
    label: "",
    dates: "",
    values: emptyValues(),
    sales: {},
    extra: {},
    rnp: "",
    ...patch,
  };
}
