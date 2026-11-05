"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BASE_PATH } from "@/lib/config";
import { checkState, exchangeCode } from "@/lib/instagram-client";

/** Сюда Instagram возвращает человека после «Разрешить». */
export default function InstagramCallback() {
  const [message, setMessage] = useState("Подключаю Instagram и загружаю публикации…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fail = (text: string) => {
      setFailed(true);
      setMessage(text);
    };
    if (params.get("error")) return fail("Вы отменили подключение Instagram.");
    const code = params.get("code");
    if (!code) return fail("Instagram не прислал код подключения.");
    if (!checkState(params.get("state"))) return fail("Ссылка подключения устарела. Начните заново с дашборда.");

    exchangeCode(code).then(
      () => window.location.replace(BASE_PATH),
      (e: Error) => fail(e.message),
    );
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center text-sm">
        {!failed && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
        <p>{message}</p>
        {failed && (
          <a href={BASE_PATH} className="text-indigo-400 hover:underline">
            Вернуться к дашборду
          </a>
        )}
      </div>
    </div>
  );
}
