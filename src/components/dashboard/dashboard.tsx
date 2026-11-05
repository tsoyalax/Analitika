"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Cloud, Loader2, LogIn, Moon, Pencil, Sun, Trash2 } from "lucide-react";
import { ChatPanel } from "@/components/ai-chat/chat-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { funnelContext } from "@/lib/analysis";
import { KAIZENHUB_URL } from "@/lib/config";
import { analyzeFunnel, bottlenecks, macroSummary } from "@/lib/funnel";
import type { Period } from "@/lib/period";
import { deletePeriod, insertPeriod, loadPeriods, updatePeriod, updateRnp } from "@/lib/periods-store";
import { economics } from "@/lib/products";
import { periodFromScreenshots } from "@/lib/screenshots";
import { getSupabase } from "@/lib/supabase";
import { AddData } from "./add-data";
import { BenchmarkChart } from "./benchmark-chart";
import { BottleneckAlert } from "./bottleneck-alert";
import { DataInput } from "./data-input";
import { EconomicsCard } from "./economics-card";
import { FunnelSteps } from "./funnel-steps";
import { KpiCards } from "./kpi-cards";
import { PeriodForm } from "./period-form";

type SaveState = "idle" | "saving" | "saved" | "error";

export function Dashboard() {
  const sb = getSupabase();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  // Пока не знаем, вошёл ли человек, не показываем пустой экран.
  const [ready, setReady] = useState(!sb);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [storeError, setStoreError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; period: Period | null; isNew: boolean; notice?: string }>({
    open: false,
    period: null,
    isNew: true,
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const period = periods.find((p) => p.id === periodId) ?? periods[periods.length - 1] ?? null;
  const canSave = Boolean(sb && email);

  // Вход общий с KaizenHub: подхватываем сессию и грузим сохранённые периоды.
  useEffect(() => {
    if (!sb) return;
    const applySession = async (userEmail: string | null) => {
      setEmail(userEmail);
      if (!userEmail) {
        setPeriods((prev) => prev.filter((p) => !p.saved));
        setReady(true);
        return;
      }
      try {
        const saved = await loadPeriods(sb);
        setPeriods((prev) => [...saved, ...prev.filter((p) => !p.saved)]);
        setStoreError(null);
      } catch {
        setStoreError("Не удалось загрузить сохранённые периоды.");
      } finally {
        setReady(true);
      }
    };
    sb.auth.getSession().then(({ data }) => applySession(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") applySession(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  /** Добавить или изменить период: в базу, если человек вошёл, иначе только в этой вкладке. */
  async function savePeriod(p: Period) {
    let result = p;
    if (sb && email) {
      try {
        result = p.saved ? await updatePeriod(sb, p) : await insertPeriod(sb, p);
      } catch {
        throw new Error("Не удалось сохранить период в базу. Попробуйте ещё раз.");
      }
    }
    setPeriods((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? result : x)) : [...prev, result]));
    setPeriodId(result.id);
    setStoreError(null);
    setForm({ open: false, period: null, isNew: true });
  }

  async function handleScreenshots(files: File[]) {
    if (sb && !email) throw new Error("Войдите в KaizenHub, чтобы распознавать скриншоты.");
    const { period: draft, notes } = await periodFromScreenshots(files);
    setForm({ open: true, period: draft, isNew: true, notice: notes });
  }

  async function handleCsv(p: Period) {
    try {
      await savePeriod(p);
    } catch (e) {
      setStoreError((e as Error).message);
    }
  }

  function handleRnpChange(value: string) {
    if (!period) return;
    const id = period.id;
    setPeriods((prev) => prev.map((p) => (p.id === id ? { ...p, rnp: value } : p)));
    if (!sb || !period.saved) return;
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
    if (!period || !confirm(`Удалить период «${period.label}»?`)) return;
    try {
      if (sb && period.saved) await deletePeriod(sb, period.id);
      setPeriods((prev) => prev.filter((p) => p.id !== period.id));
      setPeriodId(null);
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

  const openNew = () => setForm({ open: true, period: null, isNew: true });

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
              {period ? [period.label, period.dates].filter(Boolean).join(" · ") : "Нет данных"}
              {period?.saved && (
                <>
                  <Cloud className="size-3" />
                  {saveState === "saving" ? "сохраняю…" : saveState === "error" ? "не сохранилось" : "в базе"}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periods.length > 0 && (
            <Tabs value={period?.id} onValueChange={(v) => setPeriodId(String(v))} className="max-w-full overflow-x-auto">
              <TabsList>
                {periods.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {period && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => setForm({ open: true, period, isNew: false })} aria-label="Изменить период">
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={handleDelete} aria-label="Удалить период">
                <Trash2 />
              </Button>
            </>
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
      {ready && sb && !email && (
        <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/5 px-4 py-2 text-sm">
          Вы не вошли в KaizenHub: введённые данные пропадут, когда вы закроете вкладку.
        </div>
      )}

      {!ready ? (
        <Loader2 className="mx-auto mt-24 size-6 animate-spin text-muted-foreground" />
      ) : !period ? (
        <EmptyState onManual={openNew} onCsv={handleCsv} onScreenshots={handleScreenshots} canSave={canSave} />
      ) : (
        <PeriodView
          key={period.id}
          period={period}
          onRnpChange={handleRnpChange}
          addData={<AddData onManual={openNew} onCsv={handleCsv} onScreenshots={handleScreenshots} />}
        />
      )}

      <PeriodForm
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        period={form.period}
        isNew={form.isNew}
        notice={form.notice}
        onSubmit={savePeriod}
      />
    </div>
  );
}

function EmptyState({
  onManual,
  onCsv,
  onScreenshots,
  canSave,
}: {
  onManual: () => void;
  onCsv: (p: Period) => void;
  onScreenshots: (files: File[]) => Promise<void>;
  canSave: boolean;
}) {
  return (
    <div className="mx-auto mt-12 max-w-xl rounded-xl border bg-card p-8 text-center">
      <BarChart3 className="mx-auto size-8 text-indigo-400" />
      <h2 className="mt-4 text-lg font-semibold">Добавьте первый период</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Загрузите скриншоты статистики (бот, директ, Instagram, оплаты) — Claude перепишет с них цифры, — или введите их вручную, или загрузите CSV по шаблону. Дашборд посчитает
        конверсии, найдёт узкие места, а AI-ассистент разберёт их вместе с РНП.
        {canSave && " Периоды сохраняются в ваш аккаунт KaizenHub."}
      </p>
      <div className="mt-6 flex justify-center">
        <AddData onManual={onManual} onCsv={onCsv} onScreenshots={onScreenshots} size="default" />
      </div>
    </div>
  );
}

function PeriodView({
  period,
  onRnpChange,
  addData,
}: {
  period: Period;
  onRnpChange: (v: string) => void;
  addData: React.ReactNode;
}) {
  const stages = useMemo(() => analyzeFunnel(period.values), [period]);
  const macros = useMemo(() => macroSummary(stages), [stages]);
  const issues = useMemo(() => bottlenecks(stages), [stages]);
  const eco = useMemo(() => economics(period.sales), [period]);
  const context = useMemo(() => funnelContext(period, period.rnp), [period]);

  return (
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
        <DataInput rnp={period.rnp} onRnpChange={onRnpChange} />
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Добавить период</div>
          {addData}
        </div>
      </main>
      <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <ChatPanel period={period} context={context} className="h-[600px] lg:h-full" />
      </aside>
    </div>
  );
}
