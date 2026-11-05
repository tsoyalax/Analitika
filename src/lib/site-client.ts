import type { SiteProductResult } from "@/app/api/site/route";
import { BASE_PATH } from "./config";
import { accessToken } from "./supabase";

/** Сервер открывает страницу продаж, Claude выписывает продукт и тарифы с ценами. */
export async function productFromSite(url: string): Promise<SiteProductResult> {
  const token = await accessToken();
  const res = await fetch(`${BASE_PATH}/api/site`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Войдите в KaizenHub, чтобы подтягивать данные с сайта.");
  if (!res.ok) throw new Error(data.message ?? `Ошибка ${res.status}`);
  return data as SiteProductResult;
}
