import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 3_000_000;
const MAX_TEXT = 60_000;
const TIMEOUT_MS = 12_000;

export class PageError extends Error {}

/** Адрес из внутренней сети (localhost, 10.x, 192.168.x, метаданные облака…) — такие не открываем. */
function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new PageError("Нужна ссылка вида https://…");
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new PageError("Сайт не найден — проверьте ссылку.");
  if (addrs.some((a) => isPrivate(a.address))) throw new PageError("Эту ссылку открыть нельзя.");
}

/** Скачивает страницу (редиректы — вручную, с той же проверкой) и превращает её в текст. */
export async function fetchPageText(raw: string): Promise<{ url: string; title: string; text: string }> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new PageError("Не похоже на ссылку.");
  }

  let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FunnelAnalytics/1.0)", Accept: "text/html" },
    }).catch(() => {
      throw new PageError("Сайт не ответил.");
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new PageError(`Сайт ответил ошибкой ${res?.status ?? ""}.`.trim());
  if (!(res.headers.get("content-type") ?? "").includes("html")) throw new PageError("По ссылке не веб-страница.");

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new PageError("Страница слишком большая.");
  const html = new TextDecoder("utf-8").decode(buf);
  return { url: url.toString(), title: pageTitle(html), text: htmlToText(html).slice(0, MAX_TEXT) };
}

const pageTitle = (html: string) => decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();

function decode(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)));
}

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
