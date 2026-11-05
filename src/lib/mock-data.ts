import type { StageValues } from "./funnel";
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
  /** Данные пришли из загруженного CSV, а не из мока. */
  uploaded?: boolean;
  /** Период хранится в Supabase (id — uuid строки). */
  saved?: boolean;
}

export const MOCK_PERIODS: Period[] = [
  {
    id: "w1",
    label: "Неделя 1",
    dates: "27 окт — 2 ноя",
    values: {
      reach: 185_000,
      dm: 2246,
      bot: 1654,
      gift: 1288,
      opened: 910,
      read: 1026,
      site: 1049,
      tariff: 52,
      checkout: 85,
      paid: 14,
    },
    sales: { solo: 9, support: 4, turnkey: 1 },
    extra: { automationCr: 0.4826, articleReaders: 2236, articleViews: 2981, totalPayments: 20 },
    rnp: `РНП, неделя 1
План: 20 оплат, выручка 1 000 000 ₽. Факт: 14 оплат из пришедших за неделю (всего 20 оплат за период).
Контент: 6 Reels, 2 залетели (80к и 45к просмотров), кодовое слово «АКТИВ» в директ.
Бот: проверка подписки на канал перед выдачей статьи.
Сайт: обновили первый экран, тарифы внизу длинного лендинга.
Проблемы: люди доходят до сайта, но почти не жмут кнопку тарифа. В директе много вопросов про рассрочку.`,
  },
  {
    id: "w2",
    label: "Неделя 2",
    dates: "3 ноя — 9 ноя",
    values: {
      reach: 142_000,
      dm: 1490,
      bot: 1180,
      gift: 1010,
      opened: 640,
      read: 610,
      site: 590,
      tariff: 71,
      checkout: 64,
      paid: 11,
    },
    sales: { solo: 6, support: 4, turnkey: 1 },
    extra: { automationCr: 0.412, articleReaders: 1420, articleViews: 1890, totalPayments: 15 },
    rnp: `РНП, неделя 2
План: 20 оплат. Факт: 11 оплат.
Контент: 5 Reels, ни один не вышел за 40к просмотров. Сменили кодовое слово на «ИИ».
Сайт: подняли тарифы выше, добавили блок про рассрочку на 12 месяцев.
Бот: в среду бот лежал 6 часов после обновления.
Наблюдение: в директ пишут реже, хотя охваты упали не так сильно.`,
  },
];
