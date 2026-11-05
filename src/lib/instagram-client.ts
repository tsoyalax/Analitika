import { BASE_PATH } from "./config";
import type { IgConnection, IgMedia } from "./instagram-stats";
import { accessToken, getSupabase } from "./supabase";

const STATE_KEY = "ig-oauth-state";

export const redirectUri = () => `${window.location.origin}${BASE_PATH}/instagram/callback`;

async function api<T>(path: string, body: object = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE_PATH}/api/instagram/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(res.status === 401 ? "Войдите в KaizenHub" : (data.message ?? `Ошибка ${res.status}`));
  }
  return data as T;
}

/** Подключение и публикации читаем прямо из Supabase — RLS отдаёт только свои строки. */
export async function loadInstagram(): Promise<{ conn: IgConnection | null; media: IgMedia[] }> {
  const sb = getSupabase();
  if (!sb) return { conn: null, media: [] };
  const [conn, media] = await Promise.all([
    sb.from("instagram_connections").select("username,keyword,synced_at,token_expires_at").maybeSingle(),
    sb
      .from("instagram_media")
      .select("media_id,caption,media_type,product_type,permalink,thumbnail_url,posted_at,views,reach,likes,comments,saved,shares")
      .order("posted_at", { ascending: false }),
  ]);
  if (conn.error) throw conn.error;
  if (media.error) throw media.error;
  return { conn: conn.data as IgConnection | null, media: (media.data ?? []) as IgMedia[] };
}

export async function startConnect(): Promise<void> {
  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {}
  const { url } = await api<{ url: string }>("start", { redirectUri: redirectUri(), state });
  window.location.href = url;
}

export function checkState(state: string | null): boolean {
  try {
    const saved = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return Boolean(state && saved && state === saved);
  } catch {
    // Хранилище недоступно (приватный режим) — проверку пропускаем: код всё равно одноразовый.
    return true;
  }
}

export const exchangeCode = (code: string) =>
  api<{ username: string; matched: number }>("exchange", { code, redirectUri: redirectUri() });

export const syncInstagram = (keyword?: string) =>
  api<{ matched: number; total: number }>("sync", keyword === undefined ? {} : { keyword });

export const disconnectInstagram = () => api<{ ok: true }>("disconnect");
