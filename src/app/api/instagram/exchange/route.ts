import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { encrypt } from "@/lib/server/crypto";
import { exchangeCode, getProfile, instagramConfigured } from "@/lib/server/instagram";
import { syncMedia } from "@/lib/server/instagram-sync";
import { errorResponse, notConfigured } from "@/lib/server/respond";

export const maxDuration = 60;

/** Код из редиректа Instagram → токен → профиль → первая загрузка публикаций. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return unauthorized();
  if (!instagramConfigured()) return notConfigured();
  const { code, redirectUri } = (await req.json()) as { code: string; redirectUri: string };
  if (!code || !redirectUri) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const token = await exchangeCode(code, redirectUri);
    const profile = await getProfile(token.accessToken);
    const { error } = await ctx.sb.from("instagram_connections").upsert(
      {
        user_id: ctx.userId,
        ig_user_id: String(profile.user_id),
        username: profile.username,
        account_type: profile.account_type ?? "",
        token_enc: encrypt(token.accessToken),
        token_expires_at: token.expiresAt.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    const result = await syncMedia(ctx);
    return Response.json({ username: profile.username, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
