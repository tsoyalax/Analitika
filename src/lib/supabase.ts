import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/**
 * Клиент того же Supabase, что у KaizenHub. Ключ сессии в браузере по умолчанию
 * (sb-<проект>-auth-token) совпадает с KaizenHub, а /funnel открывается на том же
 * домене — поэтому вход общий. Без переменных окружения — null (только мок-данные).
 */
export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    client =
      url && key
        ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
        : null;
  }
  return client;
}

export async function accessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
