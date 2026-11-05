// Instagram API с входом через Instagram (graph.instagram.com).
// Документация: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

const GRAPH = "https://graph.instagram.com/v27.0";
export const SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

export class InstagramError extends Error {}

export const instagramConfigured = () =>
  Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_TOKEN_SECRET);

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error?.message ?? body.error_message ?? `HTTP ${res.status}`;
    throw new InstagramError(msg);
  }
  return body as T;
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export interface Token {
  accessToken: string;
  expiresAt: Date;
}

/** Код из редиректа → короткий токен (1 час) → длинный (60 дней). */
export async function exchangeCode(code: string, redirectUri: string): Promise<Token> {
  const form = new FormData();
  form.set("client_id", process.env.INSTAGRAM_APP_ID ?? "");
  form.set("client_secret", process.env.INSTAGRAM_APP_SECRET ?? "");
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code.replace(/#_$/, ""));
  const short = await call<{ data?: { access_token: string }[]; access_token?: string }>(
    "https://api.instagram.com/oauth/access_token",
    { method: "POST", body: form },
  );
  const shortToken = short.data?.[0]?.access_token ?? short.access_token;
  if (!shortToken) throw new InstagramError("Instagram не вернул токен");

  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
    access_token: shortToken,
  });
  const long = await call<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?${params}`,
  );
  return { accessToken: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000) };
}

const DAY = 24 * 60 * 60 * 1000;

/** Продлеваем токен, если до конца меньше 10 дней (Instagram разрешает с 24 часов от выдачи). */
export async function refreshIfNeeded(token: Token): Promise<Token | null> {
  if (token.expiresAt.getTime() - Date.now() > 10 * DAY) return null;
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token.accessToken });
  const res = await call<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?${params}`,
  );
  return { accessToken: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
}

export interface Profile {
  user_id: string;
  username: string;
  account_type?: string;
}

export function getProfile(accessToken: string): Promise<Profile> {
  return call<Profile>(`${GRAPH}/me?fields=user_id,username,account_type&access_token=${accessToken}`);
}

export interface Media {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

/** Все публикации аккаунта (до maxItems), от новых к старым. */
export async function listMedia(accessToken: string, maxItems = 1000): Promise<Media[]> {
  const out: Media[] = [];
  let next: string | undefined = `${GRAPH}/me/media?fields=${MEDIA_FIELDS}&limit=100&access_token=${accessToken}`;
  while (next && out.length < maxItems) {
    const page: { data: Media[]; paging?: { next?: string } } = await call(next);
    out.push(...page.data);
    next = page.paging?.next;
  }
  return out;
}

export interface MediaInsights {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
}

const METRICS = ["views", "reach", "likes", "comments", "saved", "shares"] as const;

/** Статистика публикации. Для каруселей Instagram её не отдаёт — вернём null-ы. */
export async function getInsights(accessToken: string, media: Media): Promise<MediaInsights> {
  const empty: MediaInsights = { views: null, reach: null, likes: null, comments: null, saved: null, shares: null };
  if (media.media_type === "CAROUSEL_ALBUM") {
    return { ...empty, likes: media.like_count ?? null, comments: media.comments_count ?? null };
  }
  const res = await call<{ data: { name: string; values?: { value: number }[] }[] }>(
    `${GRAPH}/${media.id}/insights?metric=${METRICS.join(",")}&access_token=${accessToken}`,
  );
  const result = { ...empty };
  for (const m of res.data) {
    if ((METRICS as readonly string[]).includes(m.name)) {
      result[m.name as keyof MediaInsights] = m.values?.[0]?.value ?? null;
    }
  }
  return result;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

export const matchesKeyword = (caption: string | undefined, keyword: string) =>
  norm(caption ?? "").includes(norm(keyword.trim()));
