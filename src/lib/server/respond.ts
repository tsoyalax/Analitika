import { InstagramError } from "./instagram";

/** Ошибка → JSON с понятным сообщением; ошибки Instagram показываем как есть. */
export function errorResponse(error: unknown): Response {
  if (error instanceof InstagramError) {
    return Response.json({ error: "instagram", message: error.message }, { status: 502 });
  }
  console.error(error);
  return Response.json({ error: "server", message: "Что-то пошло не так. Попробуйте ещё раз." }, { status: 500 });
}

export const notConfigured = () =>
  Response.json(
    { error: "not_configured", message: "Подключение Instagram ещё не настроено (нет ключей приложения Meta)." },
    { status: 503 },
  );
