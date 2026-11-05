"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Cloud, LogIn, Moon, Sun, Trash2 } from "lucide-react";
import { ChatPanel } from "@/components/ai-chat/chat-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { funnelContext } from "@/lib/analysis";
import { KAIZENHUB_URL } from "@/lib/config";
import { analyzeFunnel, bottlenecks, macroSummary } from "@/lib/funnel";
import { MOCK_PERIODS, type Period } from "@/lib/mock-data";
import { deletePeriod, insertPeriod, loadPeriods, updateRnp } from "@/lib/periods-store";
import { economics } from "@/lib/products";
import { getSupabase } from "@/lib/supabase";
import { BenchmarkChart } from "./benchmark-chart";
import { BottleneckAlert } from "./bottleneck-alert";
import { DataInput } from "./data-input";
import { EconomicsCard } from "./economics-card";
import { FunnelSteps } from "./funnel-steps";
import { KpiCards } from "./kpi-cards";

type SaveState = "idle" | "saving" | "saved" | "error";

export function Dashboard() {
  const sb = getSupabase();
  const [periods, setPeriods] = useState<Period[]>(MOCK_PERIODS);
  const [periodId, setPeriodId] = useState(MOCK_PERIODS[0].id);
  const [rnpByPeriod, setRnpByPeriod] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_PERIODS.map((p) => [p.id, p.rnp])),
  );
  const [email, setEmail] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [storeError, setStoreError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const rnp = rnpByPeriod[period.id] ?? "";

  const stages = useMemo(() => analyzeFunnel(period.values), [period]);
  const macros = useMemo(() => macroSummary(stages), [stages]);
  const issues = useMemo(() => bottlenecks(stages), [stages]);
  const eco = useMemo(() => economics(period.sales), [period]);
  const context = useMemo(() => funnelContext(period, rnp), [period, rnp]);

  // Вход общий с KaizenHub: подхватываем сессию и грузим сохранённые периоды.
  useEffect(() => {
    if (!sb) return;
    const applySession = async (userEmail: string | null) => {
      setEmail(userEmail);
      if (!userEmail) {
        setPeriods((prev) => prev.filter((p) => !p.saved));
        return;
      }
      try {
        const saved = await loadPeriods(sb);
        setPeriods([...MOCK_PERIODS, ...saved]);
        setRnpByPeriod((prev) => ({ ...prev, ...Object.fromEntries(saved.map((p) => [p.id, p.rnp])) }));
        setStoreError(null);
      } catch {
        setStoreError("Не удалось загрузить сохранённые периоды.");
      }
    };
    sb.auth.getSession().then(({ data }) => applySession(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") applySession(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  async function handleUpload(p: Period) {
    if (sb && email) {
      try {
        const saved = await insertPeriod(sb, p);
        setPeriods((prev) => [...prev, saved]);
        setRnpByPeriod((prev) => ({ ...prev, [saved.id]: saved.rnp }));
        setPeriodId(saved.id);
        setStoreError(null);
        return;
      } catch {
        setStoreError("Не удалось сохранить период в базу — он открыт только в этой вкладке.");
      }
    }
    setPeriods((prev) => [...prev.filter((x) => x.id !== p.id), p]);
    setRnpByPeriod((prev) => ({ ...prev, [p.id]: rnp }));
    setPeriodId(p.id);
  }

  function handleRnpChange(value: string) {
    setRnpByPeriod((prev) => ({ ...prev, [period.id]: value }));
    if (!sb || !period.saved) return;
    const id = period.id;
    clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      updateRnp(sb, id, value).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, 800);
  }

  async function handleDelete() {
    if (!sb || !period.saved || !confirm(`Удалить период «${period.label}»?`)) return;
    try {
      await deletePeriod(sb, period.id);
      setPeriods((prev) => prev.filter((p) => p.id !== period.id));
      setPeriodId(MOCK_PERIODS[0].id);
    } catch {
      setStoreError("Не удалось удалить период.");
    }
  }

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Аналитика Reels-воронки</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {period.label} · {period.dates}
              {period.saved && (
                <>
                  <Cloud className="size-3" />
                  {saveState === "saving" ? "сохраняю…" : saveState === "error" ? "не сохранилось" : "в базе"}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={periodId} onValueChange={(v) => setPeriodId(String(v))} className="max-w-full overflow-x-auto">
            <TabsList>
              {periods.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {period.saved && (
            <Button variant="ghost" size="icon-sm" onClick={handleDelete} aria-label="Удалить период">
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Сменить тему">
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
          {sb &&
            (email ? (
              <span className="max-w-40 truncate text-xs text-muted-foreground" title={email}>
                {email}
              </span>
            ) : (
              <a href={KAIZENHUB_URL} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <LogIn /> Войти в KaizenHub
              </a>
            ))}
        </div>
      </header>

      {storeError && (
        <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/5 px-4 py-2 text-sm">{storeError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-4">
          <BottleneckAlert stages={stages} bottlenecks={issues} avgCheck={eco.avgCheck} />
          <KpiCards macros={macros} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <FunnelSteps stages={stages} extra={period.extra} />
            <div className="space-y-4">
              <BenchmarkChart stages={stages} />
              <EconomicsCard eco={eco} values={period.values} />
            </div>
          </div>
          <DataInput
            rnp={rnp}
            onRnpChange={handleRnpChange}
            current={period}
            onUpload={handleUpload}
            hint={
              !sb
                ? undefined
                : email
                  ? "Загруженные CSV и правки РНП сохраняются в ваш аккаунт KaizenHub."
                  : "Войдите в KaizenHub, чтобы загруженные периоды сохранялись."
            }
          />
        </main>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <ChatPanel key={period.id} period={period} context={context} className="h-[600px] lg:h-full" />
        </aside>
      </div>
    </div>
  );
}
