import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { iso, mondayOf, todayIdx } from './dates';

export type Sub = { id: string; t: string; d: boolean };
export type Task = {
  id: string; title: string; status: 'todo' | 'done';
  week: string | null; day: number | null;
  level?: number; mins?: number | null; pin?: boolean; moves?: number;
  project?: string | null; topic?: string | null;
  doneWeek?: string | null; doneDay?: number | null; doneTs?: number;
  note?: string; subs?: Sub[]; start?: number; keep?: number; keepTs?: number; pk?: number;
};
export type Regular = { id: string; title: string; days: number[]; time: string | null; mins?: number | null; level?: number; rem: number | null };
export type Project = { id: string; name: string; color: string };
export type Backlog = { id: string; title: string; project: string | null; topic: string | null; level: number; mins?: number | null; note?: string | null; subs?: Sub[] | null; ts: number };
export type WeekMeta = { focus?: string; review?: string; closed?: number; snooze?: string };
export type Settings = {
  haptics?: boolean; confetti?: boolean;
  theme?: 'auto' | 'light' | 'dark'; pal?: string;
  nf?: Record<string, { on?: boolean; t?: string }>;
};
export type Memory = {
  sessions: number; log: { ts: number; text: string }[];
  topics: Record<string, { name: string; n: number; sess: string[]; last: number }>;
  ai: Record<string, { name: string; why: string; ts: number }>;
  dismissed: Record<string, number>;
  onb?: 'projects' | 'plans' | 'done'; ovSnooze?: string;
};
export type State = {
  tasks: Task[]; regulars: Regular[]; regDone: Record<string, boolean>; projects: Project[]; backlog: Backlog[];
  weekMeta: Record<string, WeekMeta>; settings: Settings; memory: Memory; dayStart?: number; dayEnd?: number;
};

export type ScreenName = 'settings' | 'projects' | 'project' | 'done' | 'review' | 'regulars';
export type SheetState =
  | { kind: 'voice' }
  | { kind: 'proposal' }
  | { kind: 'task'; id: string }
  | { kind: 'swap'; id: string }
  | { kind: 'free'; w: string; d: number }
  | { kind: 'editProject'; id: string | null }
  | { kind: 'regular'; id: string | null }
  | { kind: 'cp'; mode: 'free'; a: number; b: number }
  | { kind: 'cp'; mode: 'task'; id: string }
  | { kind: 'hours' }
  | null;

export const KEY = 'journal-ai-v2';
const PREFS = 'od-prefs', APIKEY = 'od-api-key', NFKEY = 'od-nf';

export function emptyState(): State {
  return { tasks: [], regulars: [], regDone: {}, projects: [], backlog: [], weekMeta: {}, settings: { theme: 'dark' }, memory: { sessions: 0, log: [], topics: {}, ai: {}, dismissed: {}, onb: 'projects' } };
}
export const state: State = emptyState();

export const ui = {
  ready: false,
  tab: 'home' as 'home' | 'todo',
  off: 0,
  selDay: todayIdx(),
  planView: 'week' as 'day' | 'week' | 'month',
  calSel: iso(new Date()), calY: new Date().getFullYear(), calM: new Date().getMonth(),
  screens: [] as { name: ScreenName; id?: string }[],
  sheet: null as SheetState,
  toast: null as null | { msg: string; undo?: () => void; id: number },
  banner: null as null | { k: string; msg: string },
  confetti: 0, bigConfetti: false,
  lastDoneId: null as string | null, lastDoneAt: 0,
  pdTab: 'work',
  prjOrder: false,
  wrW: null as string | null,
  stPage: null as null | string,
  apiKey: '',
  nfFired: {} as Record<string, string>,
};

/* ---------- подписка: всё приложение перерисовывается от одного счётчика ---------- */
let version = 0;
const listeners = new Set<() => void>();
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function notify() { version++; listeners.forEach(l => l()); }
export function useStore() { return useSyncExternalStore(subscribe, () => version); }

let saveT: ReturnType<typeof setTimeout> | undefined;
export function save() {
  notify();
  clearTimeout(saveT);
  saveT = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }, 150);
}
export function savePrefs() { AsyncStorage.setItem(PREFS, JSON.stringify({ planView: ui.planView })).catch(() => {}); }
export function saveApiKey(k: string) { ui.apiKey = k.trim(); AsyncStorage.setItem(APIKEY, ui.apiKey).catch(() => {}); notify(); }
export function saveFired() { AsyncStorage.setItem(NFKEY, JSON.stringify(ui.nfFired)).catch(() => {}); }

export function ensureShape() {
  state.tasks = state.tasks || []; state.regulars = state.regulars || []; state.regDone = state.regDone || {};
  state.projects = state.projects || []; state.backlog = state.backlog || []; state.weekMeta = state.weekMeta || {}; state.settings = state.settings || {};
  const m = state.memory = state.memory || ({} as Memory);
  m.log = m.log || []; m.topics = m.topics || {}; m.ai = m.ai || {}; m.dismissed = m.dismissed || {}; m.sessions = m.sessions || 0;
  if (m.onb == null) m.onb = (!state.projects.length && !state.tasks.length) ? 'projects' : 'done';
}
// Полная замена данных без смены объекта state (на него ссылаются все модули)
export function replaceState(o: Partial<State>) {
  (Object.keys(state) as (keyof State)[]).forEach(k => { delete state[k]; });
  Object.assign(state, o);
  ensureShape();
}

export async function load() {
  try {
    const [raw, prefs, key, fired, old] = await Promise.all([
      AsyncStorage.getItem(KEY), AsyncStorage.getItem(PREFS), AsyncStorage.getItem(APIKEY), AsyncStorage.getItem(NFKEY), AsyncStorage.getItem('journal-ai-v1'),
    ]);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.tasks) replaceState(p);
    } else if (old) {
      // перенос из старого формата
      const o = JSON.parse(old), tasks: Task[] = [];
      (o.entries || []).forEach((e: { done?: string[]; ts: number }) => (e.done || []).forEach(t => tasks.push({ id: uid(), title: t, status: 'done', week: null, day: null, doneWeek: iso(mondayOf(new Date(e.ts))), doneDay: (new Date(e.ts).getDay() + 6) % 7, doneTs: e.ts })));
      (o.tasks || []).forEach((t: { title: string; done?: boolean; week: string; day: number }) => tasks.push(t.done
        ? { id: uid(), title: t.title, status: 'done', week: t.week, day: t.day, doneWeek: t.week, doneDay: t.day, doneTs: Date.now() }
        : { id: uid(), title: t.title, status: 'todo', week: t.week, day: t.day }));
      replaceState({ ...emptyState(), tasks });
    }
    if (prefs) { const pv = JSON.parse(prefs).planView; if (pv === 'day' || pv === 'week' || pv === 'month') ui.planView = pv; }
    if (key) ui.apiKey = key;
    if (fired) ui.nfFired = JSON.parse(fired) || {};
  } catch { /* повреждённые данные — начинаем с пустого состояния */ }
  ensureShape();
}

export function uid() { return Math.random().toString(36).slice(2, 10); }
export function snap<T>(t: T): T { return JSON.parse(JSON.stringify(t)); }
export function byId(id: string | null | undefined) { return state.tasks.find(x => x.id === id); }

/* ---------- отклик и уведомления ---------- */
export function buzz(kind: 'light' | 'medium' | 'heavy' | 'warn' | 'success' = 'light') {
  if (state.settings.haptics === false) return;
  try {
    if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch { /* нет вибромотора */ }
}

let toastT: ReturnType<typeof setTimeout> | undefined;
export let lastUndo: (() => void) | null = null;
export function toast(msg: string, undo?: () => void) {
  if (undo) lastUndo = undo;
  ui.toast = { msg, undo, id: Date.now() };
  clearTimeout(toastT);
  toastT = setTimeout(() => { ui.toast = null; notify(); }, undo ? 5500 : 3200);
  notify();
}
export function runUndo() {
  const u = ui.toast?.undo || lastUndo;
  clearTimeout(toastT); ui.toast = null; lastUndo = null;
  if (u) { u(); buzz(); } else toast('Нечего отменять');
  notify();
}
