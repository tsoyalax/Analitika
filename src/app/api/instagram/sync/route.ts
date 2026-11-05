import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { instagramConfigured } from "@/lib/server/instagram";
import { syncMedia } from "@/lib/server/instagram-sync";
import { errorResponse, notConfigured } from "@/lib/server/respond";

export const maxDuration = 60;

/** Обновить публикации; если передано новое слово-фильтр — сначала сохранить его. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return unauthorized();
  if (!instagramConfigured()) return notConfigured();
  const { keyword } = (await req.json().catch(() => ({}))) as { keyword?: string };

  try {
    if (keyword !== undefined) {
      const clean = keyword.trim().slice(0, 60);
      if (!clean) return Response.json({ error: "bad_request", message: "Слово-фильтр пустое" }, { status: 400 });
      const { error } = await ctx.sb.from("instagram_connections").update({ keyword: clean }).eq("user_id", ctx.userId);
      if (error) throw error;
    }
    return Response.json(await syncMedia(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}
