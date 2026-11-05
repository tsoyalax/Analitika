"use client";

import { useMemo, useState } from "react";
import { BarChart3, Moon, Sun } from "lucide-react";
import { ChatPanel } from "@/components/ai-chat/chat-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { funnelContext } from "@/lib/analysis";
import { analyzeFunnel, bottlenecks, macroSummary } from "@/lib/funnel";
import { MOCK_PERIODS, type Period } from "@/lib/mock-data";
import { economics } from "@/lib/products";
import { BenchmarkChart } from "./benchmark-chart";
import { BottleneckAlert } from "./bottleneck-alert";
import { DataInput } from "./data-input";
import { EconomicsCard } from "./economics-card";
import { FunnelSteps } from "./funnel-steps";
import { KpiCards } from "./kpi-cards";

export function Dashboard() {
  const [periods, setPeriods] = useState<Period[]>(MOCK_PERIODS);
  const [periodId, setPeriodId] = useState(MOCK_PERIODS[0].id);
  const [rnpByPeriod, setRnpByPeriod] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_PERIODS.map((p) => [p.id, p.rnp])),
  );

  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const rnp = rnpByPeriod[period.id] ?? "";

  const stages = useMemo(() => analyzeFunnel(period.values), [period]);
  const macros = useMemo(() => macroSummary(stages), [stages]);
  const issues = useMemo(() => bottlenecks(stages), [stages]);
  const eco = useMemo(() => economics(period.sales), [period]);
  const context = useMemo(() => funnelContext(period, rnp), [period, rnp]);

  function handleUpload(p: Period) {
    setPeriods((prev) => [...prev.filter((x) => x.id !== p.id), p]);
    setRnpByPeriod((prev) => ({ ...prev, [p.id]: rnp }));
    setPeriodId(p.id);
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
            <p className="text-xs text-muted-foreground">
              {period.label} · {period.dates}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={periodId} onValueChange={(v) => setPeriodId(String(v))}>
            <TabsList>
              {periods.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Сменить тему">
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
        </div>
      </header>

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
            onRnpChange={(v) => setRnpByPeriod((prev) => ({ ...prev, [period.id]: v }))}
            current={period}
            onUpload={handleUpload}
          />
        </main>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <ChatPanel key={period.id} period={period} context={context} className="h-[600px] lg:h-full" />
        </aside>
      </div>
    </div>
  );
}
