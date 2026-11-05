import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/respond";

/** Отключить Instagram: удаляем токен и загруженные публикации. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return unauthorized();
  try {
    const media = await ctx.sb.from("instagram_media").delete().eq("user_id", ctx.userId);
    if (media.error) throw media.error;
    const conn = await ctx.sb.from("instagram_connections").delete().eq("user_id", ctx.userId);
    if (conn.error) throw conn.error;
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
