import { addWeeks, dayKey, iso, mondayOf, parseISO, range, realWeek, rel, t2m, todayIdx, wdIdx } from './dates';
import { Regular, state, Task, ui } from './store';

export const LIMIT = 3;
export const MAXPRJ = 8;
export const PALETTE = ['#c28a80', '#8f7ab8', '#6e9c8b', '#c3a35f', '#6b93b9', '#b97fa2', '#8a90a6', '#79a77f'];
export const QUICK = ['Работа', 'Учёба', 'Здоровье', 'Дом', 'Финансы', 'Семья', 'Хобби'];
export const LVL_NAMES = ['', 'Легко', 'Средне', 'Сложно'];
export const LVL_HINT = ['', 'до 30 мин', 'до 2,5 ч', 'больше 2,5 ч'];

/* ---------- просматриваемая неделя ---------- */
export function viewMonday() { const m = mondayOf(new Date()); m.setDate(m.getDate() + ui.off * 7); return m; }
export function viewWeek() { return iso(viewMonday()); }
export function dayDate(i: number) { const m = viewMonday(); m.setDate(m.getDate() + i); return m; }
export function isToday(i: number) { return ui.off === 0 && i === todayIdx(); }
export function isPast(i: number) { return ui.off < 0 || (ui.off === 0 && i < todayIdx()); }

/* ---------- выборки ---------- */
export function todoAt(w: string, d: number, exclude?: string) { return state.tasks.filter(t => t.status === 'todo' && t.week === w && t.day === d && t.id !== exclude); }
export function doneAt(w: string, d: number) { return state.tasks.filter(t => t.status === 'done' && t.doneWeek === w && t.doneDay === d).sort((a, b) => (a.doneTs || 0) - (b.doneTs || 0)); }
export function weekStats(w: string) {
  let todo = 0, done = 0;
  state.tasks.forEach(t => { if (t.status === 'todo' && t.week === w) todo++; else if (t.status === 'done' && t.doneWeek === w) done++; });
  return { todo, done, total: todo + done };
}
export function prObj(id: string | null | undefined) { return id ? state.projects.find(p => p.id === id) || null : null; }
export function topicKey(s: unknown) { return String(s || '').trim().toLowerCase(); }
export function prByName(n: unknown) { const k = topicKey(n); if (!k || k === 'null') return null; return state.projects.find(p => topicKey(p.name) === k) || null; }
export function prCounts(id: string) {
  return {
    work: state.tasks.filter(t => t.project === id && t.status === 'todo').length,
    done: state.tasks.filter(t => t.project === id && t.status === 'done').length,
    bl: state.backlog.filter(b => b.project === id).length,
  };
}
export function unusedColor() { const used = state.projects.map(p => p.color); return PALETTE.find(c => used.indexOf(c) < 0) || PALETTE[state.projects.length % PALETTE.length]; }

/* ---------- сложность и время ---------- */
export function lv(t: { level?: number }) { return t.level || 2; }
export function lvlOf(x: unknown) { const n = parseInt(String(x), 10); return n >= 1 && n <= 3 ? n : 2; }
// Сложность по примерным затратам времени: до 30 минут — лёгкая, до 2,5 часов — средняя, больше — сложная
export function levelFromMins(m: number) { return m <= 30 ? 1 : m <= 150 ? 2 : 3; }
export function defMins(l: number) { return l === 1 ? 20 : l === 3 ? 180 : 75; }
export function defRegMins(l?: number) { return l === 1 ? 30 : l === 3 ? 240 : 90; }
export function minsIn(x: unknown) { const n = parseInt(String(x), 10); return n > 0 ? Math.max(5, Math.min(720, n)) : null; }
export function minsOf(t: Task) { return t.mins || defMins(t.level || 2); }

/* ---------- часы дня ---------- */
export function dayCfg() {
  let s = typeof state.dayStart === 'number' ? state.dayStart : 420, e = typeof state.dayEnd === 'number' ? state.dayEnd : 1260;
  if (!(e > s)) { s = 420; e = 1260; }
  return { s, e };
}
export function dayFrac() { const c = dayCfg(), n = new Date(), m = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; return Math.max(0, Math.min(1, (m - c.s) / (c.e - c.s))); }

/* ---------- лимиты ---------- */
// В день помещается не больше LIMIT задач, из них не больше одной сложной
export function roomIn(list: Task[], level: number) { return list.length < LIMIT && (level !== 3 || !list.some(x => lv(x) === 3)); }
// Нагрузка дня: время задач плюс регулярные дела
export function dayLoad(w: string, d: number) {
  let s = 0;
  state.tasks.forEach(t => { if (t.status === 'todo' && t.week === w && t.day === d) s += minsOf(t) / 60; });
  state.regulars.forEach(r => { if (r.days.indexOf(d) >= 0) s += (r.mins || defRegMins(r.level)) / 60; });
  return s;
}
export function loadClass(x: number) { return x <= 3 ? 'lo' : x <= 6 ? 'mid' : 'hi'; }
export function overdueDays(t: Task) { return Math.max(0, todayIdx() - rel(t.week!, t.day!)); }
export function overdueTasks() {
  const ti = todayIdx();
  return state.tasks.filter(t => t.status === 'todo' && t.week && rel(t.week, t.day!) < ti).sort((a, b) => rel(a.week!, a.day!) - rel(b.week!, b.day!));
}

/* ---------- расстановка ---------- */
let JITTER = 0;
let KEEPPK = false;
// Самый лёгкий день со свободным местом; тяжёлые задачи не копятся в одном дне
function bestDay(w: string, days: number[], level: number) {
  let best = -1, bk = 1e9;
  days.forEach(d => {
    const here = todoAt(w, d);
    if (!roomIn(here, level)) return;
    const same = here.filter(x => lv(x) === level).length, k = same * 100 + here.length * 10 + dayLoad(w, d) + 0.01 * d + Math.random() * JITTER;
    if (k < bk) { bk = k; best = d; }
  });
  return best;
}
// Сложные — на выходные; средние и лёгкие — по будням поровну
export function flexDay(w: string, from: number, level: number) {
  const prefer = level === 3 ? range(Math.max(from, 5), 6) : range(from, 4);
  let d = bestDay(w, prefer, level);
  if (d < 0 && level !== 3) d = bestDay(w, range(from, 6), level);
  return d;
}
export function placeTask(t: Task, w: string, d: number) {
  const floor = w === realWeek() ? todayIdx() : 0, days: number[] = [];
  for (let i = d; i < 7; i++) days.push(i);
  for (let i = floor; i < d; i++) days.push(i);
  for (let k = 0; k < 10; k++) {
    const ww = k === 0 ? w : addWeeks(w, k), list = k === 0 ? days : [0, 1, 2, 3, 4, 5, 6];
    for (const day of list) if (roomIn(todoAt(ww, day, t.id), lv(t))) { t.week = ww; t.day = day; return; }
  }
  t.week = w; t.day = d;
}
// Следующий свободный слот: день после текущего (для просроченной — начиная с сегодня); сложные — только на выходные
export function nextSlot(t: Task) {
  const ti = todayIdx(), cur = rel(t.week!, t.day!), start = cur < ti ? ti : cur + 1;
  for (let o = start; o < start + 70; o++) {
    const wo = Math.floor(o / 7), di = o - wo * 7;
    if (lv(t) === 3 && di < 5) continue;
    const w = addWeeks(realWeek(), wo);
    if (roomIn(todoAt(w, di, t.id), lv(t))) { t.week = w; t.day = di; t.moves = (t.moves || 0) + 1; t.pin = true; return true; }
  }
  return false;
}
// Выбор дня внутри недели: сложные — на выходные, остальные — по будням, где меньше нагрузки
export function pickDay(w: string, t: Task, listFn: (w: string, d: number) => Task[]) {
  const floor = w === realWeek() ? todayIdx() : 0, lvl = lv(t);
  const room = (d: number) => roomIn(listFn(w, d), lvl);
  let cand = (lvl === 3 ? [5, 6] : range(floor, 4)).filter(d => d >= floor && room(d));
  if (!cand.length) cand = range(floor, 6).filter(room);
  let best = -1, bk = 1e9;
  cand.forEach(d => { const k = listFn(w, d).length * 10 + dayLoad(w, d) + 0.01 * d; if (k < bk) { bk = k; best = d; } });
  return best;
}

export type PlanItem = { title: string; day: number | null; wk: number; mins: number | null; level: number; project: string | null; topic: string | null };
// Ранжируем по сложности: сначала самые тяжёлые
export function scheduleItems(items: PlanItem[], rw: string, ti: number) {
  let shifted = 0;
  const fixed = items.filter(i => i.day != null);
  const flex = items.filter(i => i.day == null).sort((a, b) => b.level - a.level);
  fixed.forEach(it => {
    const wk = it.wk || 0, w0 = wk > 0 ? addWeeks(rw, wk) : (it.day! < ti ? addWeeks(rw, 1) : rw);
    const t: Task = { id: rid(), title: it.title, status: 'todo', week: w0, day: it.day, level: it.level, mins: it.mins || null, pin: true, pk: KEEPPK ? items.indexOf(it) : undefined, project: it.project || null, topic: it.topic || null };
    placeTask(t, w0, it.day!);
    if (t.week !== w0 || t.day !== it.day) shifted++;
    state.tasks.push(t);
  });
  flex.forEach(it => {
    const wk = it.wk || 0, base = addWeeks(rw, wk), from = wk > 0 ? 0 : ti;
    let w = base, d = flexDay(base, from, it.level), moved = false;
    for (let k = 1; d < 0 && k <= 6; k++) { w = addWeeks(base, k); d = flexDay(w, 0, it.level); moved = true; }
    const t: Task = { id: rid(), title: it.title, status: 'todo', week: w, day: d, level: it.level, mins: it.mins || null, pk: KEEPPK ? items.indexOf(it) : undefined, project: it.project || null, topic: it.topic || null };
    if (d < 0) { t.week = base; t.day = from; placeTask(t, base, from); moved = true; }
    if (moved) shifted++;
    state.tasks.push(t);
  });
  return shifted;
}
function rid() { return Math.random().toString(36).slice(2, 10); }
// Расчёт предложения без записи в данные: работаем на копии списка задач
export function buildProposal(items: PlanItem[], rw: string, ti: number, jitter = 0) {
  const base = state.tasks;
  let out: Task[] = [], shifted = 0;
  state.tasks = base.slice(); JITTER = jitter; KEEPPK = true;
  try { shifted = scheduleItems(items, rw, ti); out = JSON.parse(JSON.stringify(state.tasks.slice(base.length))); }
  finally { state.tasks = base; JITTER = 0; KEEPPK = false; }
  return { tasks: out, shifted };
}
export function setJitter(j: number) { JITTER = j; }

// После загрузки: разносим дни, где задач больше лимита
export function normalize() {
  for (let pass = 0; pass < 6; pass++) {
    const groups: Record<string, Task[]> = {};
    let moved = false;
    state.tasks.forEach(t => { if (t.status === 'todo' && t.week) (groups[t.week + '|' + t.day] = groups[t.week + '|' + t.day] || []).push(t); });
    Object.keys(groups).forEach(k => { const g = groups[k]; for (let i = LIMIT; i < g.length; i++) { placeTask(g[i], g[i].week!, g[i].day!); moved = true; } });
    if (!moved) break;
  }
}

/* ---------- регулярные дела ---------- */
export function regSplit(s: unknown) {
  const str = String(s || '').trim();
  const m = str.match(/(?:^|\s)(?:в\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s|$)/);
  if (!m || m.index == null) return { title: str, time: null as string | null };
  const title = (str.slice(0, m.index) + ' ' + str.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  return { title: title || str, time: ('0' + m[1]).slice(-2) + ':' + m[2] };
}
export function normRegs() {
  let ch = false;
  state.regulars.forEach(r => {
    if (r.time === undefined) {
      const sp = regSplit(r.title); r.time = sp.time;
      if (sp.time) { r.title = sp.title; if (r.rem === undefined) r.rem = 10; }
      ch = true;
    }
    if (r.rem === undefined) r.rem = null;
  });
  return ch;
}
export function regsOn() { const s = state.settings.nf && state.settings.nf.regs; return !s || s.on !== false; }
export function regRange(r: Regular) { const s = t2m(r.time); return isNaN(s) ? null : { s, e: s + (r.mins || defRegMins(r.level || 2)) }; }
// wait — ждёт, now — идёт сейчас, past — уже прошло
export function regState(r: Regular, w: string, d: number): 'wait' | 'now' | 'past' {
  const rw = realWeek(), ti = todayIdx();
  if (w < rw || (w === rw && d < ti)) return 'past';
  if (w > rw || d > ti) return 'wait';
  const n = new Date(), mm = n.getHours() * 60 + n.getMinutes(), g = regRange(r);
  if (!g) return mm >= dayCfg().e ? 'past' : 'wait';
  return mm >= g.e ? 'past' : mm >= g.s ? 'now' : 'wait';
}
export function regsAt(d: number) {
  return state.regulars.filter(r => r.days.indexOf(d) >= 0).sort((a, b) => (a.time ? t2m(a.time) : 1e4) - (b.time ? t2m(b.time) : 1e4));
}

/* ---------- календарь: занятое и свободные окна ---------- */
export type Ev = { kind: 'r' | 't'; r?: Regular; t?: Task; s: number; e: number; col?: number };
export function calEvents(sd: Date): Ev[] {
  const wk = iso(mondayOf(sd)), di = wdIdx(sd), ev: Ev[] = [];
  regsAt(di).forEach(r => { const g = regRange(r); if (g) ev.push({ kind: 'r', r, s: g.s, e: Math.min(1440, g.e) }); });
  todoAt(wk, di).forEach(t => { if (typeof t.start === 'number') ev.push({ kind: 't', t, s: t.start, e: Math.min(1440, t.start + minsOf(t)) }); });
  return ev.filter(x => x.e > x.s).sort((a, b) => a.s - b.s || a.e - b.e);
}
export function busyFrom(ev: Ev[], lo: number, hi: number) {
  const m: number[][] = [];
  ev.forEach(x => {
    const s0 = Math.max(lo, x.s), e0 = Math.min(hi, x.e); if (e0 <= s0) return;
    const l = m[m.length - 1]; if (l && s0 <= l[1]) l[1] = Math.max(l[1], e0); else m.push([s0, e0]);
  });
  return m;
}
export function freeFrom(ev: Ev[], lo: number, hi: number) {
  const out: number[][] = []; let cur = lo;
  busyFrom(ev, lo, hi).forEach(x => { if (x[0] > cur) out.push([cur, x[0]]); cur = Math.max(cur, x[1]); });
  if (cur < hi) out.push([cur, hi]);
  return out;
}
export function sumIv(a: number[][]) { return a.reduce((n, x) => n + (x[1] - x[0]), 0); }
export function calIndex() {
  const todo: Record<string, number> = {}, done: Record<string, number> = {};
  state.tasks.forEach(t => {
    if (t.status === 'todo' && t.week && t.day != null) { const k = dayKey(t.week, t.day); todo[k] = (todo[k] || 0) + 1; }
    else if (t.status === 'done' && t.doneWeek && t.doneDay != null) { const k = dayKey(t.doneWeek, t.doneDay); done[k] = (done[k] || 0) + 1; }
  });
  return { todo, done };
}

/* ---------- итоги недели ---------- */
export function weekReport(w: string) {
  const days = [0, 0, 0, 0, 0, 0, 0], byPrj: Record<string, number> = {};
  let mins = 0, done = 0, todo = 0, moved = 0;
  state.tasks.forEach(t => {
    if (t.status === 'done' && t.doneWeek === w) {
      done++; days[t.doneDay!]++; mins += minsOf(t);
      const k = t.project || ''; byPrj[k] = (byPrj[k] || 0) + 1;
      if (t.moves) moved++;
    } else if (t.status === 'todo' && t.week === w) { todo++; if (t.moves) moved++; }
  });
  let rs = 0, rd = 0;
  state.regulars.forEach(r => r.days.forEach(d => { rs++; if (regState(r, w, d) === 'past') rd++; }));
  const total = done + todo;
  return { done, todo, total, pct: total ? Math.round(done / total * 100) : 0, days, mins, moved, byPrj, rs, rd };
}
export function streaks() {
  const s: Record<string, number> = {};
  state.tasks.forEach(t => { if (t.status === 'done' && t.doneWeek && t.doneDay != null) s[dayKey(t.doneWeek, t.doneDay)] = 1; });
  Object.keys(state.regDone).forEach(k => { const p = k.split('|'); if (p.length === 3 && state.regDone[k]) s[dayKey(p[0], +p[1])] = 1; });
  const keys = Object.keys(s).sort();
  let best = 0, run = 0, prev: string | null = null;
  keys.forEach(k => {
    if (prev) { const nx = parseISO(prev); nx.setDate(nx.getDate() + 1); run = iso(nx) === k ? run + 1 : 1; } else run = 1;
    if (run > best) best = run;
    prev = k;
  });
  let cur = 0; const c = new Date();
  if (!s[iso(c)]) c.setDate(c.getDate() - 1);
  while (s[iso(c)]) { cur++; c.setDate(c.getDate() - 1); }
  return { cur, best };
}
export function carryList(w: string) {
  if (w > realWeek()) return [];
  const cur = w === realWeek(), ti = todayIdx();
  return state.tasks.filter(t => t.status === 'todo' && t.week === w && (!cur || t.day! <= ti)).sort((a, b) => lv(b) - lv(a) || a.day! - b.day!);
}
export function carryTarget(t: Task, from: string) {
  for (let o = 1; o <= 8; o++) {
    const nw = addWeeks(from, o), order = o === 1 ? [t.day!].concat(range(0, 6).filter(x => x !== t.day)) : range(0, 6);
    for (const di of order) {
      if (lv(t) === 3 && di < 5) continue;
      if (roomIn(todoAt(nw, di, t.id), lv(t))) return { w: nw, d: di };
    }
  }
  return null;
}

/* ---------- память и предложения проектов ---------- */
export function suggestions() {
  const m = state.memory, out: { k: string; name: string; n: number; why: string }[] = [], now = Date.now();
  if (state.projects.length >= MAXPRJ) return out;
  const hidden = (k: string) => !!prByName(k) || (m.dismissed[k] && now - m.dismissed[k] < 14 * 864e5);
  Object.keys(m.topics).forEach(k => { const tp = m.topics[k]; if (tp.n >= 3 && tp.sess.length >= 2 && !hidden(k)) out.push({ k, name: tp.name, n: tp.n, why: '' }); });
  Object.keys(m.ai).forEach(k => { const a = m.ai[k]; if (!hidden(k) && !out.some(o => o.k === k)) out.push({ k, name: a.name, n: m.topics[k] ? m.topics[k].n : 0, why: a.why || '' }); });
  return out.sort((a, b) => b.n - a.n);
}
// Задача «зависла»: переносилась 3+ раза или не выполняется неделю и дольше
export function staleTask() {
  const now = Date.now(); let best: Task | null = null, bs = -1;
  state.tasks.forEach(t => {
    if (t.status !== 'todo' || !t.week) return;
    const m = t.moves || 0, od = overdueDays(t);
    let ask = false;
    if (m >= 3 && m >= (t.keep == null ? 3 : t.keep + 2)) ask = true;
    if (od >= 7 && now - (t.keepTs || 0) > 7 * 864e5) ask = true;
    if (ask && m + od > bs) { best = t; bs = m + od; }
  });
  return best as Task | null;
}
