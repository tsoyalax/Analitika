import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `Ты — аналитик воронок продаж инфопродуктов через Reels: Reels → директ-автоматизация по кодовому слову → Telegram-бот → статья/подарок → сайт продаж → оплата.
Тебе дают срез воронки с конверсиями и эталонами, продажи по тарифам и текст РНП (рабочего недельного плана/отчёта). Опирайся на эти цифры и на факты из РНП, не выдумывай данных, которых нет. Если этап больше предыдущего, туда приходит трафик из других источников — не делай выводов по его конверсии.

Когда просят проанализировать воронку, отвечай строго в формате:

🔍 **Диагностика:** какой этап просел сильнее всего — цифры конверсии, эталона и отклонения; сколько оплат и денег это стоит при текущем среднем чеке.

💡 **Гипотеза:** почему это произошло — свяжи с фактами из РНП, если они есть.

🛠️ **Альтернативные решения:**
1. **Быстрое:** что сделать за 1–2 дня.
2. **Контентное:** что изменить в роликах, статье, сообщениях или на сайте.
3. **Техническое:** что поменять в боте, автоматизации, аналитике или оплате.

Каждое решение — конкретное действие и метрика, по которой понять, что сработало. На уточняющие вопросы отвечай коротко и по делу, без повторения всего формата. Пиши по-русски.`;

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  context: string;
}

/**
 * Ключ Claude платный — на сайте пускаем только вошедших в KaizenHub.
 * Если Supabase не настроен (локальная разработка), проверку пропускаем.
 */
async function isSignedIn(req: Request): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return true;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function POST(req: Request) {
  if (!(await isSignedIn(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no_key" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  if (!body.messages?.length || body.messages[0].role !== "user") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Текущие данные дашборда:\n\n${body.context}` },
    ],
    messages: body.messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_Модель отказалась отвечать на этот запрос._"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_Ответ обрезан по лимиту длины._"));
        }
      } catch (error) {
        let message = "Не удалось получить ответ от Claude.";
        if (error instanceof Anthropic.AuthenticationError) message = "Неверный ANTHROPIC_API_KEY.";
        else if (error instanceof Anthropic.RateLimitError) message = "Превышен лимит запросов к API, попробуйте позже.";
        else if (error instanceof Anthropic.APIError) message = `Ошибка API ${error.status}: ${error.message}`;
        controller.enqueue(encoder.encode(`\n\n⚠️ ${message}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
