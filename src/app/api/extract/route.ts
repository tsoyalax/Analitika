import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { supabaseConfigured, unauthorized, userFromRequest } from "@/lib/server/auth";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_IMAGES = 6;
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const n = () => z.number().nullable();

// Всё, чего нет на скриншотах, — null. Поля совпадают с этапами воронки и тарифами в lib/.
const Extracted = z.object({
  label: z.string().nullable(),
  dates: z.string().nullable(),
  values: z.object({
    reach: n(),
    dm: n(),
    bot: n(),
    gift: n(),
    opened: n(),
    read: n(),
    site: n(),
    tariff: n(),
    checkout: n(),
    paid: n(),
  }),
  sales: z.object({ solo: n(), support: n(), turnkey: n() }),
  extra: z.object({ automationCr: n(), articleReaders: n(), articleViews: n(), totalPayments: n() }),
  notes: z.string(),
});

export type ExtractResult = z.infer<typeof Extracted>;

const PROMPT = `На скриншотах — статистика Reels-воронки инфопродукта «Цифровой актив»: Instagram, директ-автоматизация, Telegram-бот со статьёй, сайт продаж, оплаты. Перепиши с них числа в поля ответа. Ничего не вычисляй и не додумывай: если числа для поля нет на скриншотах — null.

Соответствие полей:
- values.reach — охват/просмотры Reels (Instagram: «Охват», «Просмотры», «Accounts reached»).
- values.dm — контакты директ-автоматизации («Контакты», написали кодовое слово).
- values.bot — «Пришли в бота», впервые запустили бота.
- values.gift — «Получили статью или подарок».
- values.opened — «Открыли статью из бота».
- values.read — «Дочитали до конца».
- values.site — «Перешли на сайт продаж».
- values.tariff — «Нажали кнопку тарифа».
- values.checkout — «Открыли оплату или оставили заявку».
- values.paid — «Купили» (из пришедших в этом периоде).
- sales.solo / sales.support / sales.turnkey — сколько продано тарифов «Самостоятельно» (25 000 ₽), «С поддержкой Романа» (80 000 ₽), «Под ключ» (290 000 ₽).
- extra.automationCr — «Конверсия» директ-автоматизации, долей от 1 (48,26% → 0.4826).
- extra.articleReaders / extra.articleViews — «Всего читателей статей» и число просмотров рядом.
- extra.totalPayments — всего оплат за период (включая пришедших раньше).
- label и dates — название и даты периода, если они видны (иначе null).

Проценты рядом с абсолютными числами (например «1 288 77,9%») не переноси — бери только абсолютное число. Числа пиши без пробелов-разделителей.
В notes коротко по-русски: что распознал, что не нашёл и в чём не уверен.`;

interface Body {
  images: { mediaType: string; data: string }[];
}

export async function POST(req: Request) {
  if (supabaseConfigured && !(await userFromRequest(req))) return unauthorized();
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no_key", message: "Распознавание недоступно: не задан ANTHROPIC_API_KEY." }, { status: 503 });
  }

  const { images } = (await req.json()) as Body;
  const valid = (images ?? []).filter((i) => MEDIA_TYPES.includes(i.mediaType as (typeof MEDIA_TYPES)[number]) && i.data);
  if (!valid.length || valid.length > MAX_IMAGES) {
    return Response.json({ error: "bad_request", message: `Загрузите от 1 до ${MAX_IMAGES} изображений.` }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Extracted) },
      messages: [
        {
          role: "user",
          content: [
            ...valid.map((i) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: i.mediaType as (typeof MEDIA_TYPES)[number],
                data: i.data,
              },
            })),
            { type: "text" as const, text: PROMPT },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return Response.json({ error: "not_parsed", message: "Не удалось распознать цифры на скриншотах." }, { status: 422 });
    }
    return Response.json(res.parsed_output);
  } catch (error) {
    let message = "Не удалось распознать скриншоты.";
    if (error instanceof Anthropic.AuthenticationError) message = "Неверный ANTHROPIC_API_KEY.";
    else if (error instanceof Anthropic.RateLimitError) message = "Превышен лимит запросов к API, попробуйте позже.";
    else if (error instanceof Anthropic.APIError) message = `Ошибка API ${error.status}: ${error.message}`;
    return Response.json({ error: "api", message }, { status: 502 });
  }
}
