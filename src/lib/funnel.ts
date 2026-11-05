// Модель Reels-воронки: этапы, конверсии и поиск узких мест сравнением с вашими же прошлыми периодами.

export type MacroId = "reach" | "entry" | "warmup" | "kep" | "payment" | "full";

export const MACRO_STAGES: { id: MacroId; label: string; hint: string }[] = [
  { id: "reach", label: "Охваты Reels", hint: "просмотры роликов" },
  { id: "entry", label: "Запуск бота / Директ", hint: "написали кодовое слово и пришли в бота" },
  { id: "warmup", label: "Статья и сайт", hint: "подарок, статья, переход на сайт продаж" },
  { id: "kep", label: "КЭП (диагностика)", hint: "провели диагностику" },
  { id: "payment", label: "Тариф и заявка", hint: "кнопка тарифа, форма оплаты или заявка" },
  { id: "full", label: "Полная оплата", hint: "оплатили полностью" },
];

export type StageId =
  | "reach"
  | "dm"
  | "bot"
  | "gift"
  | "opened"
  | "read"
  | "site"
  | "tariff"
  | "checkout"
  | "kep"
  | "paid";

export interface StageDef {
  id: StageId;
  label: string;
  hint: string;
  macro: MacroId;
  /**
   * Не все проходят этот шаг (например, КЭП): если он пуст, следующий шаг считаем от
   * предыдущего заполненного и сравниваем как обычно.
   */
  optional?: boolean;
}

export const STAGES: StageDef[] = [
  { id: "reach", label: "Охваты Reels", hint: "уникальные просмотры роликов за период", macro: "reach" },
  { id: "dm", label: "Написали в директ", hint: "контакты директ-автоматизации (кодовое слово)", macro: "entry" },
  { id: "bot", label: "Пришли в бота", hint: "впервые запустили бота", macro: "entry" },
  { id: "gift", label: "Получили статью или подарок", hint: "прошли проверку подписки, если она есть", macro: "warmup" },
  { id: "opened", label: "Открыли статью из бота", hint: "по личной ссылке бота", macro: "warmup" },
  { id: "read", label: "Дочитали до конца", hint: "увидели последний раздел", macro: "warmup" },
  { id: "site", label: "Перешли на сайт продаж", hint: "уникальные люди", macro: "warmup" },
  { id: "tariff", label: "Нажали кнопку тарифа", hint: "открылось окно перед оплатой", macro: "payment" },
  { id: "checkout", label: "Открыли оплату или оставили заявку", hint: "формы на сайте", macro: "payment" },
  { id: "kep", label: "КЭП (диагностика)", hint: "провели диагностику", macro: "kep", optional: true },
  { id: "paid", label: "Полная оплата", hint: "оплатили полностью, из пришедших в этом периоде", macro: "full" },
];

/** Отклонение хуже вашей обычной конверсии, после которого этап считается узким местом. */
export const BOTTLENECK_THRESHOLD = 0.25;
const WARNING_THRESHOLD = 0.1;

/**
 * Узкое место видно и без истории: шаг, на котором отваливается больше 80% людей,
 * «ниже нормы» — больше 50%. Первый шаг (охваты → директ) не оцениваем: охваты — это
 * просмотры, а не люди. Если есть другие периоды, шаг ещё и сравнивается с их медианой —
 * берётся худший из двух статусов.
 */
export const DROP_BAD = 0.8;
export const DROP_WARN = 0.5;

export type StageStatus = "good" | "warn" | "bad" | "neutral";

const STATUS_RANK: Record<StageStatus, number> = { neutral: 0, good: 1, warn: 2, bad: 3 };

export interface StageResult extends StageDef {
  value: number;
  prev: number | null;
  /** Конверсия из предыдущего этапа. null — если считать некорректно. */
  cr: number | null;
  /** Этап больше предыдущего: в него вливается трафик из других источников. */
  external: boolean;
  /** Для этапа нет данных (0) — его пропускаем при расчёте конверсий. */
  missing: boolean;
  /** Предыдущий этап пропущен — конверсия идёт через несколько шагов, ни с чем не сравниваем. */
  gap: boolean;
  /** Ваша обычная конверсия этого шага — медиана по другим периодам. null — сравнивать не с чем. */
  baseline: number | null;
  /** (cr - baseline) / baseline; отрицательное — хуже, чем обычно. */
  deviation: number | null;
  status: StageStatus;
  /** Доля от первого этапа воронки (для ширины полосы). */
  share: number;
}

export type StageValues = Record<StageId, number>;

/** Обычная конверсия каждого шага: медиана по периодам. */
export type Baseline = Partial<Record<StageId, number>>;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Медиана конверсии каждого шага по другим периодам — с ней сравнивается текущий. */
export function computeBaseline(others: StageValues[]): Baseline {
  const runs = others.map((v) => analyzeFunnel(v));
  const out: Baseline = {};
  for (const def of STAGES) {
    const crs = runs.map((r) => r.find((s) => s.id === def.id)!).filter((s) => s.cr !== null && !s.gap).map((s) => s.cr!);
    if (crs.length) out[def.id] = median(crs);
  }
  return out;
}

export function analyzeFunnel(values: StageValues, baseline: Baseline = {}): StageResult[] {
  const top = values.reach || 1;
  let lastKnown: number | null = null;
  return STAGES.map((def, i) => {
    const value = values[def.id] ?? 0;
    const missing = i > 0 && value === 0;
    const prev = i === 0 ? null : lastKnown;
    // Предыдущий шаг пропущен: конверсию через несколько шагов с обычной конверсией одного шага не сравниваем.
    const gap = i > 1 && (values[STAGES[i - 1].id] ?? 0) === 0 && !STAGES[i - 1].optional;
    if (!missing) lastKnown = value;
    const external = !missing && prev !== null && value > prev;
    const cr = prev && !external && !missing ? value / prev : null;
    const base = baseline[def.id] ?? null;
    const deviation = cr !== null && !gap && base ? (cr - base) / base : null;
    const byDrop: StageStatus =
      cr === null || gap || i < 2 ? "neutral" : 1 - cr > DROP_BAD ? "bad" : 1 - cr > DROP_WARN ? "warn" : "good";
    const byHistory: StageStatus =
      deviation === null
        ? "neutral"
        : deviation < -BOTTLENECK_THRESHOLD
          ? "bad"
          : deviation < -WARNING_THRESHOLD
            ? "warn"
            : "good";
    const status = STATUS_RANK[byHistory] > STATUS_RANK[byDrop] ? byHistory : byDrop;
    return { ...def, value, prev, cr, external, missing, gap, baseline: base, deviation, status, share: value / top };
  });
}

export function bottlenecks(stages: StageResult[]): StageResult[] {
  return stages
    .filter((s) => s.status === "bad")
    .sort((a, b) => (a.cr ?? 0) - (b.cr ?? 0));
}

/** Самый слабый шаг: худший статус, при равном — с наименьшей конверсией. */
export function worstStage(stages: StageResult[]): StageResult | null {
  return stages
    .filter((s) => s.status !== "neutral" && s.cr !== null)
    .reduce<StageResult | null>(
      (worst, s) =>
        worst === null ||
        STATUS_RANK[s.status] > STATUS_RANK[worst.status] ||
        (s.status === worst.status && s.cr! < worst.cr!)
          ? s
          : worst,
      null,
    );
}

export interface MacroResult {
  id: MacroId;
  label: string;
  hint: string;
  /** Значение последнего этапа группы. */
  value: number;
  /** Конверсия из предыдущей группы. */
  cr: number | null;
  status: StageStatus;
}


export function macroSummary(stages: StageResult[]): MacroResult[] {
  let prevValue: number | null = null;
  return MACRO_STAGES.map((m) => {
    const group = stages.filter((s) => s.macro === m.id);
    // Последний заполненный этап группы; пустые шаги не обнуляют карточку.
    const value = [...group].reverse().find((s) => !s.missing)?.value ?? 0;
    const cr = prevValue && value ? value / prevValue : null;
    if (value) prevValue = value;
    const status = group.reduce<StageStatus>(
      (acc, s) => (STATUS_RANK[s.status] > STATUS_RANK[acc] ? s.status : acc),
      "neutral",
    );
    return { ...m, value, cr, status };
  });
}

/**
 * Сколько оплат добавилось бы, если бы этап конвертировал как обычно (медиана других периодов),
 * а дальше воронка шла так же, как сейчас. null — если ниже по воронке есть
 * приток из других источников и пропорция не работает.
 */
export function extraPaymentsAtBaseline(stages: StageResult[], stage: StageResult): number | null {
  if (stage.cr === null || !stage.baseline || stage.cr >= stage.baseline) return 0;
  const idx = stages.findIndex((s) => s.id === stage.id);
  const paidIdx = stages.findIndex((s) => s.id === "paid");
  if (idx > paidIdx || stages.slice(idx + 1, paidIdx + 1).some((s) => s.external)) return null;
  const paid = stages[paidIdx].value;
  return paid * (stage.baseline / stage.cr) - paid;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("ru-RU");
export const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    // Маленькие доли (1,2%) без дробной части теряют смысл.
    minimumFractionDigits: Math.min(digits, Math.abs(n) < 0.1 ? 1 : 0),
  })}%`;
export const fmtRub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
