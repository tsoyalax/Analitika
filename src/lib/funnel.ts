// Модель Reels-воронки: этапы, эталонные конверсии и поиск узких мест.

export type MacroId = "reach" | "entry" | "warmup" | "payment";

export const MACRO_STAGES: { id: MacroId; label: string; hint: string }[] = [
  { id: "reach", label: "Охваты Reels", hint: "просмотры роликов" },
  { id: "entry", label: "Запуск бота / Директ", hint: "написали кодовое слово и пришли в бота" },
  { id: "warmup", label: "КЭП / Вебинар / Диалог", hint: "статья-подарок, прогрев, переход на сайт" },
  { id: "payment", label: "Оплаты", hint: "тариф, форма оплаты, покупка" },
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
  | "paid";

export interface StageDef {
  id: StageId;
  label: string;
  hint: string;
  macro: MacroId;
  /** Эталонная конверсия из предыдущего этапа (0..1). null — для первого этапа. */
  benchmark: number | null;
}

export const STAGES: StageDef[] = [
  { id: "reach", label: "Охваты Reels", hint: "уникальные просмотры роликов за период", macro: "reach", benchmark: null },
  { id: "dm", label: "Написали в директ", hint: "контакты директ-автоматизации (кодовое слово)", macro: "entry", benchmark: 0.015 },
  { id: "bot", label: "Пришли в бота", hint: "впервые запустили бота", macro: "entry", benchmark: 0.6 },
  { id: "gift", label: "Получили статью или подарок", hint: "прошли проверку подписки, если она есть", macro: "warmup", benchmark: 0.85 },
  { id: "opened", label: "Открыли статью из бота", hint: "по личной ссылке бота", macro: "warmup", benchmark: 0.75 },
  { id: "read", label: "Дочитали до конца", hint: "увидели последний раздел", macro: "warmup", benchmark: 0.6 },
  { id: "site", label: "Перешли на сайт продаж", hint: "уникальные люди", macro: "warmup", benchmark: 0.5 },
  { id: "tariff", label: "Нажали кнопку тарифа", hint: "открылось окно перед оплатой", macro: "payment", benchmark: 0.15 },
  { id: "checkout", label: "Открыли оплату или оставили заявку", hint: "формы на сайте", macro: "payment", benchmark: 0.6 },
  { id: "paid", label: "Купили", hint: "из пришедших в этом периоде", macro: "payment", benchmark: 0.2 },
];

/** Отклонение хуже эталона, после которого этап считается узким местом. */
export const BOTTLENECK_THRESHOLD = 0.25;
const WARNING_THRESHOLD = 0.1;

export type StageStatus = "good" | "warn" | "bad" | "neutral";

export interface StageResult extends StageDef {
  value: number;
  prev: number | null;
  /** Конверсия из предыдущего этапа. null — если считать некорректно. */
  cr: number | null;
  /** Этап больше предыдущего: в него вливается трафик из других источников. */
  external: boolean;
  /** Для этапа нет данных (0) — его пропускаем при расчёте конверсий. */
  missing: boolean;
  /** Предыдущий этап пропущен — конверсия идёт через несколько шагов, с эталоном не сравниваем. */
  gap: boolean;
  /** (cr - benchmark) / benchmark; отрицательное — хуже эталона. */
  deviation: number | null;
  status: StageStatus;
  /** Доля от первого этапа воронки (для ширины полосы). */
  share: number;
}

export type StageValues = Record<StageId, number>;

export function analyzeFunnel(values: StageValues): StageResult[] {
  const top = values.reach || 1;
  let lastKnown: number | null = null;
  return STAGES.map((def, i) => {
    const value = values[def.id] ?? 0;
    const missing = i > 0 && value === 0;
    const prev = i === 0 ? null : lastKnown;
    // Предыдущий шаг пропущен: конверсию через несколько шагов с эталоном одного шага не сравниваем.
    const gap = i > 1 && (values[STAGES[i - 1].id] ?? 0) === 0;
    if (!missing) lastKnown = value;
    const external = !missing && prev !== null && value > prev;
    const cr = prev && !external && !missing ? value / prev : null;
    const deviation = cr !== null && !gap && def.benchmark ? (cr - def.benchmark) / def.benchmark : null;
    let status: StageStatus = "neutral";
    if (deviation !== null) {
      status = deviation < -BOTTLENECK_THRESHOLD ? "bad" : deviation < -WARNING_THRESHOLD ? "warn" : "good";
    }
    return { ...def, value, prev, cr, external, missing, gap, deviation, status, share: value / top };
  });
}

export function bottlenecks(stages: StageResult[]): StageResult[] {
  return stages
    .filter((s) => s.status === "bad")
    .sort((a, b) => (a.deviation ?? 0) - (b.deviation ?? 0));
}

/** Этап с самым сильным отклонением от эталона (даже если он не красный). */
export function worstStage(stages: StageResult[]): StageResult | null {
  return stages.reduce<StageResult | null>(
    (worst, s) => (s.deviation !== null && (worst === null || s.deviation < (worst.deviation ?? 0)) ? s : worst),
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

const STATUS_RANK: Record<StageStatus, number> = { neutral: 0, good: 1, warn: 2, bad: 3 };

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
 * Сколько оплат добавилось бы, если бы этап вышел на эталон, а дальше
 * воронка конвертировала так же, как сейчас. null — если ниже по воронке есть
 * приток из других источников и пропорция не работает.
 */
export function extraPaymentsAtBenchmark(stages: StageResult[], stage: StageResult): number | null {
  if (stage.cr === null || !stage.benchmark || stage.cr >= stage.benchmark) return 0;
  const idx = stages.findIndex((s) => s.id === stage.id);
  if (stages.slice(idx + 1).some((s) => s.external)) return null;
  const paid = stages[stages.length - 1].value;
  return paid * (stage.benchmark / stage.cr) - paid;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("ru-RU");
export const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    // Маленькие доли (1,2%) без дробной части теряют смысл.
    minimumFractionDigits: Math.min(digits, Math.abs(n) < 0.1 ? 1 : 0),
  })}%`;
export const fmtRub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
