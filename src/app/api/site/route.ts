import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { supabaseConfigured, unauthorized, userFromRequest } from "@/lib/server/auth";
import { fetchPageText, PageError } from "@/lib/server/fetch-page";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const SiteProduct = z.object({
  name: z.string(),
  description: z.string(),
  tariffs: z.array(z.object({ name: z.string(), price: z.number() })),
  notes: z.string(),
});

export type SiteProductResult = z.infer<typeof SiteProduct> & { url: string };

const PROMPT = `Ниже — текст страницы продаж онлайн-продукта. Выпиши:
- name — название продукта;
- description — 1–2 предложения: что это, формат, длительность, способы оплаты (рассрочка и т.п.), если указаны;
- tariffs — все тарифы с ценой полной оплаты в рублях (число без пробелов). Цену в рассрочку или «в месяц» не бери, зачёркнутую старую цену — тоже. Если тарифов нет, а цена одна — один тариф с названием продукта;
- notes — коротко по-русски: что нашёл, в чём не уверен (например, цены в другой валюте или скрыты до заявки).
Ничего не придумывай: если цен на странице нет — tariffs пустой.`;

export async function POST(req: Request) {
  if (supabaseConfigured && !(await userFromRequest(req))) return unauthorized();
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no_key", message: "Не задан ANTHROPIC_API_KEY." }, { status: 503 });
  }
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url?.trim()) return Response.json({ error: "bad_request", message: "Укажите ссылку." }, { status: 400 });

  let page;
  try {
    page = await fetchPageText(url);
  } catch (error) {
    const message = error instanceof PageError ? error.message : "Не удалось открыть сайт.";
    return Response.json({ error: "page", message }, { status: 422 });
  }
  if (page.text.length < 200) {
    return Response.json(
      { error: "page", message: "На странице почти нет текста — возможно, сайт собирается скриптами. Введите тарифы вручную." },
      { status: 422 },
    );
  }

  try {
    const res = await new Anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(SiteProduct) },
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nАдрес: ${page.url}\nЗаголовок: ${page.title}\n\n<page>\n${page.text}\n</page>`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return Response.json({ error: "not_parsed", message: "Не удалось разобрать страницу." }, { status: 422 });
    }
    const out = res.parsed_output;
    return Response.json({
      ...out,
      tariffs: out.tariffs.filter((t) => t.name.trim() && t.price > 0),
      url: page.url,
    } satisfies SiteProductResult);
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error("site", error.status, error.message);
    return Response.json({ error: "api", message: "Не удалось разобрать страницу. Попробуйте ещё раз." }, { status: 502 });
  }
}
