import type { UserContext } from "./auth";
import { decrypt, encrypt } from "./crypto";
import { getInsights, InstagramError, listMedia, matchesKeyword, refreshIfNeeded, type Media } from "./instagram";

const BATCH = 5;

/**
 * Забирает публикации со словом-фильтром в подписи и их статистику за всё время
 * и сохраняет в instagram_media. Публикации, которые больше не подходят под слово, удаляет.
 */
export async function syncMedia({ sb, userId }: UserContext): Promise<{ matched: number; total: number }> {
  const { data: conn, error } = await sb
    .from("instagram_connections")
    .select("token_enc,token_expires_at,keyword")
    .maybeSingle();
  if (error) throw error;
  if (!conn) throw new InstagramError("Instagram не подключён");

  let token = { accessToken: decrypt(conn.token_enc), expiresAt: new Date(conn.token_expires_at) };
  if (token.expiresAt.getTime() < Date.now()) {
    throw new InstagramError("Доступ к Instagram истёк — подключите аккаунт заново");
  }
  const refreshed = await refreshIfNeeded(token).catch(() => null);
  if (refreshed) {
    token = refreshed;
    await sb
      .from("instagram_connections")
      .update({ token_enc: encrypt(token.accessToken), token_expires_at: token.expiresAt.toISOString() })
      .eq("user_id", userId);
  }

  const all = await listMedia(token.accessToken);
  const matched = all.filter((m) => matchesKeyword(m.caption, conn.keyword));

  const rows = [];
  for (let i = 0; i < matched.length; i += BATCH) {
    const batch = matched.slice(i, i + BATCH);
    const insights = await Promise.all(
      batch.map((m) =>
        getInsights(token.accessToken, m).catch(() => ({
          views: null,
          reach: null,
          likes: m.like_count ?? null,
          comments: m.comments_count ?? null,
          saved: null,
          shares: null,
        })),
      ),
    );
    rows.push(...batch.map((m, j) => toRow(userId, m, insights[j])));
  }

  if (rows.length) {
    const { error: upsertError } = await sb.from("instagram_media").upsert(rows, { onConflict: "user_id,media_id" });
    if (upsertError) throw upsertError;
  }
  const stale = sb.from("instagram_media").delete().eq("user_id", userId);
  const { error: deleteError } = rows.length
    ? await stale.not("media_id", "in", `(${rows.map((r) => `"${r.media_id}"`).join(",")})`)
    : await stale;
  if (deleteError) throw deleteError;

  await sb.from("instagram_connections").update({ synced_at: new Date().toISOString() }).eq("user_id", userId);
  return { matched: rows.length, total: all.length };
}

function toRow(userId: string, m: Media, ins: Awaited<ReturnType<typeof getInsights>>) {
  return {
    user_id: userId,
    media_id: m.id,
    caption: (m.caption ?? "").slice(0, 2200),
    media_type: m.media_type ?? "",
    product_type: m.media_product_type ?? "",
    permalink: m.permalink ?? "",
    thumbnail_url: m.thumbnail_url ?? m.media_url ?? "",
    posted_at: m.timestamp ?? null,
    views: ins.views,
    reach: ins.reach,
    likes: ins.likes ?? m.like_count ?? null,
    comments: ins.comments ?? m.comments_count ?? null,
    saved: ins.saved,
    shares: ins.shares,
    fetched_at: new Date().toISOString(),
  };
}
