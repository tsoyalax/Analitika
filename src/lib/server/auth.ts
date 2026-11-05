import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

export interface UserContext {
  userId: string;
  /** Клиент Supabase от имени пользователя: RLS пускает только к его строкам. */
  sb: SupabaseClient;
}

/** Проверяет токен входа KaizenHub из заголовка Authorization. */
export async function userFromRequest(req: Request): Promise<UserContext | null> {
  if (!url || !key) return null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, sb };
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
