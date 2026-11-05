import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { authorizeUrl, instagramConfigured } from "@/lib/server/instagram";
import { notConfigured } from "@/lib/server/respond";

/** Ссылка на окно входа Instagram. state придумывает и проверяет браузер. */
export async function POST(req: Request) {
  if (!(await userFromRequest(req))) return unauthorized();
  if (!instagramConfigured()) return notConfigured();
  const { redirectUri, state } = (await req.json()) as { redirectUri: string; state: string };
  if (!redirectUri || !state) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ url: authorizeUrl(redirectUri, state) });
}
