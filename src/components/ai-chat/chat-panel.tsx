"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { localAnalysis } from "@/lib/analysis";
import { BASE_PATH } from "@/lib/config";
import { accessToken } from "@/lib/supabase";
import type { Period } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ANALYZE_PROMPT = "Проанализируй текущую воронку и РНП.";

export function ChatPanel({ period, context, className }: { period: Period; context: string; className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    const write = (reply: string) =>
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: reply }]);

    try {
      const token = await accessToken();
      const res = await fetch(`${BASE_PATH}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ messages: history, context }),
      });
      if (res.status === 401) {
        write(
          content === ANALYZE_PROMPT
            ? `${localAnalysis(period)}\n\n_Войдите в KaizenHub, чтобы анализ делал Claude._`
            : "Чтобы задавать вопросы Claude, войдите в KaizenHub.",
        );
        return;
      }
      if (res.status === 503) {
        setDemo(true);
        write(
          content === ANALYZE_PROMPT
            ? localAnalysis(period)
            : "В демо-режиме доступен только автоматический анализ воронки. Добавьте ANTHROPIC_API_KEY в .env.local, чтобы задавать вопросы Claude.",
        );
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        write(reply);
      }
    } catch {
      write("⚠️ Не удалось связаться с сервером. Проверьте, что приложение запущено.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-indigo-400" />
          <div>
            <div className="text-sm font-medium">AI-ассистент</div>
            <div className="text-xs text-muted-foreground">
              {demo ? "Демо-режим: без ключа API" : `Видит воронку «${period.label}» и РНП`}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon-sm" onClick={() => setMessages([])} disabled={loading} title="Очистить чат">
            <Trash2 />
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="max-w-64 text-muted-foreground">
              Найду этап, который просел сильнее всего, объясню почему и предложу 3 решения.
            </p>
            <Button onClick={() => send(ANALYZE_PROMPT)}>
              <Sparkles /> Проанализировать воронку и РНП
            </Button>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-lg bg-muted px-3 py-2">
              {m.content}
            </div>
          ) : (
            <div key={i} className="leading-relaxed">
              {m.content ? (
                <Markdown text={m.content} />
              ) : (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          ),
        )}
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        {messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="mb-2"
            disabled={loading}
            onClick={() => send(ANALYZE_PROMPT)}
          >
            <Sparkles /> Проанализировать заново
          </Button>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Спросите про воронку…"
            rows={1}
            className="max-h-32 min-h-9 resize-none text-sm"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Отправить">
            {loading ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>
    </div>
  );
}
