import {
  analyzeFunnel,
  BOTTLENECK_THRESHOLD,
  DROP_BAD,
  DROP_WARN,
  extraPaymentsAtBaseline,
  fmtInt,
  fmtPct,
  fmtRub,
  worstStage,
  type Baseline,
  type StageResult,
} from "./funnel";
import type { Period } from "./period";
import { economics, type Product } from "./products";

/** Текстовый срез воронки — контекст для AI-ассистента. */
export function funnelContext(
  period: Period,
  rnp: string,
  product: Product,
  baseline: Baseline = {},
  baselineCount = 0,
): string {
  const stages = analyzeFunnel(period.values, baseline);
  const eco = economics(period.sales, product, period.values.paid);
  const lines = stages.map((s) => {
    const cr = s.missing
      ? "нет данных"
      : s.external
        ? "больше предыдущего этапа — есть трафик из других источников, конверсия не считается"
        : s.cr === null
          ? "—"
          : s.gap
            ? `CR ${fmtPct(s.cr)} от последнего заполненного этапа (предыдущий шаг не заполнен, не сравниваем)`
            : s.baseline === null
              ? `CR ${fmtPct(s.cr)}`
              : `CR ${fmtPct(s.cr)} (обычно ${fmtPct(s.baseline)}, отклонение ${fmtPct(s.deviation ?? 0)})`;
    return `- ${s.label}: ${fmtInt(s.value)} · ${cr} · статус: ${s.status}`;
  });

  const extra = [
    period.extra.automationCr !== undefined && `Конверсия директ-автоматизации (по данным сервиса): ${fmtPct(period.extra.automationCr, 2)}`,
    period.extra.articleReaders !== undefined && `Всего читателей статей (бот + соцсети + ссылки): ${fmtInt(period.extra.articleReaders)}`,
    period.extra.articleViews !== undefined && `Просмотров статей: ${fmtInt(period.extra.articleViews)}`,
    period.extra.totalPayments !== undefined && `Всего оплат за период (включая пришедших раньше): ${fmtInt(period.extra.totalPayments)}`,
  ].filter(Boolean);

  return [
    `Продукт: «${product.name}»${product.url ? ` (${product.url})` : ""}. ${product.description}`,
    `Тарифы: ${eco.mix.map((t) => `${t.name} — ${fmtRub(t.price)}`).join("; ")}.`,
    "",
    `Период: ${period.label}${period.dates ? ` (${period.dates})` : ""}.`,
    baselineCount
      ? `«Обычно» — медиана конверсии этого шага по ${baselineCount} другим периодам. Узкое место — хуже обычного более чем на ${fmtPct(BOTTLENECK_THRESHOLD, 0)}.`
      : `Других периодов нет, эталонов не используем. Статус шага — по доле отвалившихся на нём людей: больше ${fmtPct(DROP_BAD, 0)} — узкое место (bad), больше ${fmtPct(DROP_WARN, 0)} — ниже нормы (warn). Переход «охваты → директ» не оцениваем: охваты — просмотры, а не люди.`,
    "Воронка (конверсия — от предыдущего этапа):",
    ...lines,
    ...extra.map((e) => `- ${e}`),
    "",
    eco.estimated
      ? `Продажи по тарифам не указаны. Оценка: ${fmtInt(eco.sales)} оплат × средний чек ${fmtRub(eco.avgCheck)} (из настроек продукта) = выручка ≈ ${fmtRub(eco.revenue)}.`
      : eco.sales
      ? `Продажи по тарифам: ${eco.mix.map((t) => `${t.name}: ${t.count}`).join(", ")}. Выручка ${fmtRub(eco.revenue)}, средний чек ${fmtRub(eco.avgCheck)}.`
      : "Продажи по тарифам не указаны — выручку и средний чек посчитать нельзя.",
    "",
    "РНП (рабочий недельный план/отчёт):",
    rnp.trim() || "(не загружен)",
  ].join("\n");
}

const SOLUTIONS: Partial<Record<StageResult["id"], { quick: string; content: string; tech: string }>> = {
  dm: {
    quick: "Вернуть кодовое слово, которое работало, и закрепить комментарий с призывом написать его в директ под каждым роликом.",
    content: "Последние 10–15 секунд Reels — отдельная сцена с выгодой подарка и кодовым словом крупно на экране.",
    tech: "Добавить в автоматизацию триггер на комментарии и сторис-ответы, а не только на директ.",
  },
  bot: {
    quick: "Сократить первое сообщение в директе до одной фразы и одной кнопки «Забрать в боте».",
    content: "Показать в директе превью подарка (скрин статьи), чтобы был повод перейти.",
    tech: "Проверить deeplink в бота на iOS/Android и убрать промежуточные страницы.",
  },
  gift: {
    quick: "Временно убрать проверку подписки или выдавать первую часть подарка без неё.",
    content: "Объяснить в боте, зачем подписка: что человек получит в канале.",
    tech: "Повторная проверка подписки автоматически через 2–3 минуты вместо ручной кнопки.",
  },
  opened: {
    quick: "Дожим через 1 час и через 24 часа: «Статья ещё ждёт вас» с одной кнопкой.",
    content: "Переписать сообщение со ссылкой: интрига и конкретный результат после прочтения.",
    tech: "Открывать статью внутри Telegram (Instant View/WebApp) вместо внешнего браузера.",
  },
  read: {
    quick: "Сократить статью и поднять главный кейс в первый экран.",
    content: "Разбить текст на короткие блоки с подзаголовками-обещаниями и видео-вставками.",
    tech: "Отслеживать глубину дочитывания по блокам и найти место, где уходят.",
  },
  site: {
    quick: "Поставить кнопку перехода на сайт в середину статьи, а не только в конец.",
    content: "Финал статьи — мост к программе: кейс и прямое приглашение посмотреть тарифы.",
    tech: "Передавать UTM и id из бота, чтобы на сайте сразу показывать персональный оффер.",
  },
  tariff: {
    quick: "Поднять блок тарифов на первые экраны и продублировать кнопку «Выбрать тариф» в шапке.",
    content: "Добавить рядом с ценами рассрочку на 12 месяцев с ежемесячным платежом и кейсы учеников.",
    tech: "Поставить аналитику скролла и кликов, проверить, что кнопка тарифа видна и работает на мобильных.",
  },
  checkout: {
    quick: "Убрать лишние поля в форме оплаты, оставить имя и телефон.",
    content: "Повторить ценность и гарантию прямо в окне перед оплатой.",
    tech: "Проверить работу Продамуса/СБП на мобильных и скорость открытия формы.",
  },
  paid: {
    quick: "Дожим брошенных оплат в течение часа: сообщение в бот с прямой ссылкой на оплату.",
    content: "Серия писем/сообщений с разбором возражений: цена, время, «получится ли у меня».",
    tech: "Автоматическое уведомление менеджеру о брошенной оплате для звонка.",
  },
};

/** Анализ без AI — когда ключ API не задан. Тот же формат, что у модели. */
export function localAnalysis(period: Period, product: Product, baseline: Baseline = {}): string {
  const stages = analyzeFunnel(period.values, baseline);
  const worst = worstStage(stages);
  const byDropOff = worst !== null && worst.deviation === null;
  if (!worst || (!byDropOff && (worst.deviation ?? 0) >= 0) || (byDropOff && worst.status === "good")) {
    return "🔍 **Диагностика:** все этапы на уровне вашей обычной конверсии или выше.\n\n💡 **Гипотеза:** воронка сбалансирована — рост даст масштабирование охватов.\n\n🛠️ **Альтернативные решения:**\n1. **Быстрое:** увеличить частоту Reels.\n2. **Контентное:** повторить форматы, которые дали лучшие охваты.\n3. **Техническое:** настроить сквозную аналитику по каждому ролику.";
  }
  const eco = economics(period.sales, product, period.values.paid);
  const extra = extraPaymentsAtBaseline(stages, worst);
  const s = SOLUTIONS[worst.id];
  const prev = stages[stages.findIndex((x) => x.id === worst.id) - 1];
  return [
    byDropOff
      ? `🔍 **Диагностика:** сильнее всего теряем людей на шаге «${worst.label}»: дошли ${fmtPct(worst.cr ?? 0)} из «${prev.label}», отвалилось ${fmtPct(1 - (worst.cr ?? 0))}.`
      : `🔍 **Диагностика:** сильнее всего просел этап «${worst.label}»: ${fmtPct(worst.cr ?? 0)} из «${prev.label}» при обычных у вас ${fmtPct(worst.baseline ?? 0)} (${fmtPct(worst.deviation ?? 0)}).`,
    extra === null
      ? "Ниже по воронке есть этап, куда люди приходят в обход этого шага, поэтому потери в оплатах точно не посчитать. Проверьте, что клик по этому шагу правильно считается в аналитике."
      : extra > 0
        ? `Если вернуть этап к обычной конверсии, это примерно +${extra.toFixed(1)} оплат${eco.avgCheck ? ` ≈ ${fmtRub(extra * eco.avgCheck)} при среднем чеке ${fmtRub(eco.avgCheck)}` : ""}.`
        : "",
    "",
    "💡 **Гипотеза:** люди доходят до этого шага, но не видят достаточной причины сделать следующее действие — либо мешает трение (лишний шаг, неудобный интерфейс), либо не хватает доверия/аргумента в этот момент.",
    "",
    "🛠️ **Альтернативные решения:**",
    `1. **Быстрое:** ${s?.quick ?? "убрать лишний шаг на этом этапе."}`,
    `2. **Контентное:** ${s?.content ?? "усилить оффер и доказательства."}`,
    `3. **Техническое:** ${s?.tech ?? "проверить, что этап технически работает на всех устройствах."}`,
    "",
    "_Демо-режим: анализ по правилам. Добавьте ANTHROPIC_API_KEY, чтобы подключить Claude и учитывать РНП._",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}
