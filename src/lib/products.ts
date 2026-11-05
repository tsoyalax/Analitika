// Тарифы программы «Цифровой актив» (assets.therykunov.ru).

export type TariffId = "solo" | "support" | "turnkey";

export const TARIFFS: { id: TariffId; name: string; price: number }[] = [
  { id: "solo", name: "Самостоятельно", price: 25_000 },
  { id: "support", name: "С поддержкой Романа", price: 80_000 },
  { id: "turnkey", name: "Под ключ. White Label", price: 290_000 },
];

export const PRODUCT = {
  name: "Цифровой актив",
  url: "https://assets.therykunov.ru",
  description:
    "Онлайн-программа Романа Рыкунова: создать цифровой продукт с ИИ, собрать автоворонку в Telegram-боте и привлекать бесплатный трафик короткими роликами. Доступ 2 месяца, оплата картой, СБП или в рассрочку до 12 месяцев.",
};

export type SalesMix = Partial<Record<TariffId, number>>;

export interface Economics {
  revenue: number;
  sales: number;
  avgCheck: number;
  mix: { id: TariffId; name: string; price: number; count: number; revenue: number }[];
}

export function economics(mix: SalesMix): Economics {
  const rows = TARIFFS.map((t) => {
    const count = mix[t.id] ?? 0;
    return { ...t, count, revenue: count * t.price };
  });
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const sales = rows.reduce((s, r) => s + r.count, 0);
  return { revenue, sales, avgCheck: sales ? revenue / sales : 0, mix: rows };
}
