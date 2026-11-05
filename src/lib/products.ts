// Продукт и тарифы: подтягиваются с сайта продаж (или правятся вручную) и хранятся в настройках.
// Пока настроек нет — тарифы «Цифрового актива» (assets.therykunov.ru).

export interface Tariff {
  /** Стабильный ключ: по нему в периодах хранятся продажи. */
  id: string;
  name: string;
  price: number;
}

export interface Product {
  name: string;
  url: string;
  description: string;
  tariffs: Tariff[];
}

export const DEFAULT_PRODUCT: Product = {
  name: "Цифровой актив",
  url: "https://assets.therykunov.ru",
  description:
    "Онлайн-программа Романа Рыкунова: создать цифровой продукт с ИИ, собрать автоворонку в Telegram-боте и привлекать бесплатный трафик короткими роликами. Доступ 2 месяца, оплата картой, СБП или в рассрочку до 12 месяцев.",
  tariffs: [
    { id: "solo", name: "Самостоятельно", price: 25_000 },
    { id: "support", name: "С поддержкой Романа", price: 80_000 },
    { id: "turnkey", name: "Под ключ. White Label", price: 290_000 },
  ],
};

/** Продажи по тарифам: id тарифа → штук. */
export type SalesMix = Partial<Record<string, number>>;

export interface Economics {
  revenue: number;
  sales: number;
  avgCheck: number;
  mix: (Tariff & { count: number; revenue: number })[];
}

export function economics(mix: SalesMix, tariffs: Tariff[]): Economics {
  const rows = tariffs.map((t) => {
    const count = mix[t.id] ?? 0;
    return { ...t, count, revenue: count * t.price };
  });
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const sales = rows.reduce((s, r) => s + r.count, 0);
  return { revenue, sales, avgCheck: sales ? revenue / sales : 0, mix: rows };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/**
 * Новые тарифы с сайта → сохраняем id тех, что совпали по названию со старыми,
 * чтобы не потерять продажи в уже введённых периодах.
 */
export function mergeTariffs(prev: Tariff[], next: { name: string; price: number }[]): Tariff[] {
  return next.map((t) => {
    const same = prev.find((p) => norm(p.name) === norm(t.name));
    return { id: same?.id ?? `t-${crypto.randomUUID().slice(0, 8)}`, name: t.name.trim(), price: Math.round(t.price) };
  });
}
