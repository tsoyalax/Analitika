"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtInt, fmtPct } from "@/lib/funnel";
import { disconnectInstagram, loadInstagram, startConnect, syncInstagram } from "@/lib/instagram-client";
import { instagramContext, summarize, type IgConnection, type IgMedia } from "@/lib/instagram-stats";

const n = (x: number | null) => (x === null ? "—" : fmtInt(x));

export function InstagramCard({ signedIn, onContext }: { signedIn: boolean; onContext: (ctx: string | null) => void }) {
  const [conn, setConn] = useState<IgConnection | null>(null);
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState<"sync" | "connect" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(data: Awaited<ReturnType<typeof loadInstagram>>) {
    setConn(data.conn);
    setMedia(data.media);
    setKeyword(data.conn?.keyword ?? "");
    onContext(data.conn ? instagramContext(data.conn, data.media) : null);
  }

  const reload = async () => apply(await loadInstagram());

  useEffect(() => {
    if (!signedIn) return;
    loadInstagram()
      .then(apply, () => setError("Не удалось загрузить данные Instagram."))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function run(kind: "sync" | "connect", action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      if (kind === "sync") await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm("Отключить Instagram? Загруженные публикации удалятся.")) return;
    await run("sync", disconnectInstagram);
  }

  const s = useMemo(() => summarize(media), [media]);
  const top = useMemo(() => [...media].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 8), [media]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Instagram</div>
          <div className="text-xs text-muted-foreground">
            {conn
              ? `@${conn.username} · публикации со словом «${conn.keyword}» за всё время`
              : "Просмотры и охваты роликов прямо из вашего аккаунта"}
          </div>
        </div>
        {conn && (
          <Button variant="ghost" size="icon-sm" onClick={disconnect} disabled={busy !== null} title="Отключить Instagram">
            <Unplug />
          </Button>
        )}
      </div>

      {!signedIn ? (
        <p className="mt-3 text-xs text-muted-foreground">Войдите в KaizenHub, чтобы подключить Instagram.</p>
      ) : !loaded ? (
        <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />
      ) : !conn ? (
        <div className="mt-3 space-y-2">
          <Button onClick={() => run("connect", startConnect)} disabled={busy !== null}>
            {busy === "connect" && <Loader2 className="animate-spin" />} Подключить Instagram
          </Button>
          <p className="text-xs text-muted-foreground">Нужен бизнес-аккаунт или аккаунт автора.</p>
        </div>
      ) : (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run("sync", () => syncInstagram(keyword !== conn.keyword ? keyword : undefined));
            }}
          >
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="слово в подписи"
              className="h-8 min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <Button type="submit" variant="outline" size="sm" disabled={busy !== null || !keyword.trim()}>
              {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Обновить
            </Button>
          </form>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Публикаций", value: fmtInt(s.count) },
              { label: "Просмотров всего", value: n(s.views.total) },
              { label: "Медиана просмотров", value: n(s.views.median) },
              {
                label: "Комментарии / охват",
                value: s.commentRate.median === null ? "—" : fmtPct(s.commentRate.median, 2),
                hint: s.commentRate.top === null ? undefined : `лучшие 25% — от ${fmtPct(s.commentRate.top, 2)}`,
              },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-lg font-semibold tabular-nums">{m.value}</div>
                {m.hint && <div className="text-xs text-muted-foreground">{m.hint}</div>}
              </div>
            ))}
          </div>

          {top.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs tabular-nums">
                <thead className="text-muted-foreground">
                  <tr className="text-right [&>th]:pb-2 [&>th]:font-normal">
                    <th className="text-left">Публикация</th>
                    <th>Просмотры</th>
                    <th>Охват</th>
                    <th>Комм.</th>
                    <th>Сохр.</th>
                    <th>Репосты</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((m) => (
                    <tr key={m.media_id} className="border-t text-right [&>td]:py-2">
                      <td className="max-w-56 text-left">
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:underline"
                          title={m.caption}
                        >
                          <span className="shrink-0 text-muted-foreground">{m.posted_at?.slice(5, 10).split("-").reverse().join(".")}</span>
                          <span className="truncate">{m.caption.replace(/\s+/g, " ") || "без подписи"}</span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                        </a>
                      </td>
                      <td>{n(m.views)}</td>
                      <td>{n(m.reach)}</td>
                      <td>{n(m.comments)}</td>
                      <td>{n(m.saved)}</td>
                      <td>{n(m.shares)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {conn.synced_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Обновлено {new Date(conn.synced_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              {s.count > top.length && ` · показаны ${top.length} лучших из ${s.count}`}
            </p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
