import { addWeeks, DAYS, dayKey, fmt, iso, parseISO, range, realWeek, rel, short, todayIdx, weekRange, wkOffset, wdIdx, mondayOf, pl, m2t } from './dates';
import {
  carryList, carryTarget, dayDate, defMins, doneAt, flexDay, LIMIT, lv, MAXPRJ, minsOf, nextSlot, overdueTasks, pickDay, placeTask,
  prByName, prObj, roomIn, scheduleItems, setJitter, suggestions, todoAt, topicKey, unusedColor, viewWeek,
} from './planner';
import { Backlog, buzz, byId, notify, replaceState, save, ScreenName, SheetState, snap, state, Task, toast, ui, uid, emptyState, savePrefs } from './store';

/* ---------- навигация ---------- */
export function openScreen(name: ScreenName, id?: string) { ui.screens.push({ name, id }); notify(); }
export function closeScreen() { ui.screens.pop(); notify(); }
export function closeScreenNamed(name: ScreenName) { ui.screens = ui.screens.filter(s => s.name !== name); }
export function openSheet(s: SheetState) { ui.sheet = s; notify(); }
export function closeSheet() { ui.sheet = null; notify(); }
export function setTab(t: 'home' | 'todo') {
  if (t === ui.tab) return;
  ui.tab = t;
  if (t === 'todo' && ui.off === 0 && ui.planView === 'week') ui.selDay = todayIdx();
  buzz(); notify();
}
export function goWeek(n: number) { ui.off = n; ui.selDay = n === 0 ? todayIdx() : 0; buzz(); notify(); }
export function setSel(k: string) { const d = parseISO(k); ui.calSel = k; ui.calY = d.getFullYear(); ui.calM = d.getMonth(); }
// выбранная дата — общий источник для «Дня»; «Неделя» и «Месяц» берут её отсюда
export function setPlanView(v: 'day' | 'week' | 'month') {
  if (ui.planView === 'week') setSel(dayKey(viewWeek(), ui.selDay));
  if (v === 'day' || v === 'week') { const d = parseISO(ui.calSel); ui.off = wkOffset(iso(mondayOf(d))); ui.selDay = wdIdx(d); }
  ui.planView = v; savePrefs(); buzz(); notify();
}
export function openCal(k?: string) { setSel(k || iso(new Date())); ui.planView = 'day'; savePrefs(); ui.tab = 'todo'; ui.screens = []; buzz(); notify(); }
export function shiftDay(n: number) { const d = parseISO(ui.calSel); d.setDate(d.getDate() + n); setSel(iso(d)); buzz(); notify(); }
export function shiftMonth(n: number) { ui.calM += n; if (ui.calM < 0) { ui.calM = 11; ui.calY--; } if (ui.calM > 11) { ui.calM = 0; ui.calY++; } buzz(); notify(); }

/* ---------- откат ---------- */
export function revert(s: Task) {
  const t = byId(s.id);
  if (!t) return;
  (Object.keys(t) as (keyof Task)[]).forEach(k => { if (!(k in s)) delete t[k]; });
  Object.assign(t, s);
}
function restore(s: Task) { const t = byId(s.id); if (t) revert(s); else state.tasks.push(s); save(); }

/* ---------- выполнение, возврат, удаление ---------- */
export function completeTask(t: Task) {
  t.status = 'done'; t.doneWeek = realWeek(); t.doneDay = todayIdx(); t.doneTs = Date.now();
  ui.lastDoneId = t.id; ui.lastDoneAt = Date.now();
  buzz('success');
  if (state.settings.confetti !== false) { ui.confetti++; ui.bigConfetti = todoAt(realWeek(), todayIdx()).length === 0; }
  save();
}
export function returnTask(t: Task) {
  const s = snap(t);
  t.status = 'todo';
  const w0 = t.week || t.doneWeek!, d0 = t.day != null ? t.day : t.doneDay!;
  placeTask(t, w0, d0);
  const moved = !(t.week === w0 && t.day === d0);
  save();
  toast(moved ? '«' + short(t.title) + '» — в «Сделать», ' + DAYS[t.day!].toLowerCase() + ' (день был заполнен)' : '«' + short(t.title) + '» — снова в «Сделать»', () => restore(s));
}
export function deleteTask(t: Task) {
  const s = snap(t);
  state.tasks = state.tasks.filter(x => x.id !== t.id);
  save(); buzz('medium');
  toast('Удалено: «' + short(t.title) + '»', () => restore(s));
}
export function postponeTask(t: Task) {
  const s = snap(t);
  if (!nextSlot(t)) { toast('Свободного слота не нашлось'); return; }
  save(); buzz();
  toast('Перенесено: ' + pdDate(t), () => { revert(s); save(); });
}
export function pdDate(t: Task) { const d = parseISO(t.week!); d.setDate(d.getDate() + t.day!); return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][t.day!] + ', ' + fmt(d); }
export function rollOverdue() {
  const list = overdueTasks().sort((a, b) => lv(b) - lv(a));
  if (!list.length) return;
  const snaps = list.map(snap); let moved = 0;
  list.forEach(t => { if (nextSlot(t)) moved++; });
  save(); buzz('medium');
  toast('Перенёс на свободные слоты: ' + moved, () => { snaps.forEach(revert); save(); });
}
export function toBacklog(t: Task) {
  const s = snap(t), item: Backlog = { id: uid(), title: t.title, project: t.project || null, topic: t.topic || null, level: t.level || 2, mins: t.mins || null, note: t.note || null, subs: t.subs || null, ts: Date.now() };
  state.tasks = state.tasks.filter(x => x.id !== t.id);
  state.backlog.push(item); save();
  toast('«' + short(t.title) + '» убрана в бэклог', () => { state.backlog = state.backlog.filter(x => x.id !== item.id); state.tasks.push(s); save(); });
}
export function keepTask(t: Task) { t.keep = t.moves || 0; t.keepTs = Date.now(); save(); toast('Оставил. Спрошу снова, если задача опять зависнет'); }
export function snoozeOverdue() { state.memory.ovSnooze = iso(new Date()); save(); }

/* ---------- перенос по дням и неделям ---------- */
export function moveToDay(t: Task, d: number) {
  if (d === t.day) return;
  if (!roomIn(todoAt(t.week!, d, t.id), lv(t))) { toast('В «' + DAYS[d].toLowerCase() + '»: нет места (' + LIMIT + ' задачи, одна сложная)'); buzz('warn'); return; }
  if (d > t.day!) t.moves = (t.moves || 0) + 1;
  t.day = d; t.pin = true; save(); buzz();
}
export function moveToWeek(t: Task, w: string) {
  if (t.status !== 'todo' || t.week === w) return;
  const d = pickDay(w, t, (ww, dd) => todoAt(ww, dd, t.id));
  if (d < 0) { toast('На этой неделе нет места: не больше ' + LIMIT + ' задач в день'); buzz('warn'); return; }
  const s = snap(t);
  if (w > t.week! && t.week! <= realWeek()) t.moves = (t.moves || 0) + 1;
  t.week = w; t.day = d; t.pin = true;
  save(); buzz();
  toast('Перенесено: ' + weekRange(w) + ', ' + DAYS[d].toLowerCase(), () => { revert(s); save(); });
}
export function setLevel(t: Task, nl: number) {
  if (t.status === 'todo' && nl === 3 && !roomIn(todoAt(t.week!, t.day!, t.id), 3)) { toast('В этот день уже есть сложная задача'); buzz('warn'); return; }
  t.level = nl; t.mins = defMins(nl); save(); buzz();
}
export function setProject(t: Task, pid: string | null) { t.project = pid; if (pid) t.topic = null; save(); buzz(); }

// «Распределить» и «Перемешать» работают со всеми невыполненными задачами недели
export function arrangeWeek(shuffle: boolean) {
  const w = viewWeek(), ti = todayIdx();
  if (ui.off < 0) { toast('Прошедшую неделю не пересобрать'); return; }
  const mov = state.tasks.filter(t => t.status === 'todo' && t.week === w);
  if (mov.length < 2) { toast('Нужно хотя бы две задачи'); return; }
  const before = mov.map(snap), from = ui.off === 0 ? ti : 0, days = range(from, 6);
  const sig = () => mov.map(t => t.id + ':' + t.day).join(',');
  const old = sig(), tries = shuffle ? 8 : 1; let placed = false;
  for (let k = 0; k < tries && !placed; k++) {
    mov.forEach(t => { t.day = null; });
    let ok = true;
    if (shuffle) {
      mov.slice().sort(() => Math.random() - 0.5).forEach(t => {
        const opts = days.filter(d => roomIn(todoAt(w, d, t.id), lv(t)));
        if (!opts.length) { ok = false; return; }
        t.day = opts[Math.floor(Math.random() * opts.length)];
      });
    } else {
      setJitter(0);
      mov.slice().sort((a, b) => lv(b) - lv(a)).forEach(t => {
        const d = flexDay(w, from, lv(t));
        if (d >= 0) t.day = d;
        else { const s = before.find(x => x.id === t.id)!; t.day = s.day; placeTask(t, w, s.day!); }
      });
    }
    if (ok && (!shuffle || sig() !== old)) placed = true;
  }
  mov.forEach(t => { if (t.day == null) t.day = before.find(x => x.id === t.id)!.day; t.pin = false; });
  save(); buzz('medium');
  toast(shuffle ? 'Задачи перемешаны' : 'Задачи распределены по нагрузке', () => { before.forEach(revert); save(); });
}
export function carryOver(w: string) {
  const list = carryList(w);
  if (!list.length) { toast('Невыполненных задач нет'); return; }
  const snaps = list.map(snap), past = w < realWeek(); let moved = 0;
  list.forEach(t => {
    if (past) { if (nextSlot(t)) moved++; return; }
    const g = carryTarget(t, w);
    if (g) { t.week = g.w; t.day = g.d; t.moves = (t.moves || 0) + 1; t.pin = true; moved++; }
  });
  save(); buzz('medium');
  toast('Перенесено задач: ' + moved, () => { snaps.forEach(revert); save(); });
}

/* ---------- добавление ---------- */
export function addTaskAt(title: string, w: string, d: number, extra?: Partial<Task>) {
  const v = title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!v) return null;
  if (todoAt(w, d).length >= LIMIT) { toast('В этот день уже ' + LIMIT + ' ' + pl(LIMIT, 'задача', 'задачи', 'задач')); buzz('warn'); return null; }
  const t: Task = { id: uid(), title: v, status: 'todo', week: w, day: d, level: 2, mins: null, pin: true, project: null, topic: null, ...extra };
  state.tasks.push(t); save(); buzz();
  toast('Добавлено: ' + short(v), () => { state.tasks = state.tasks.filter(x => x.id !== t.id); save(); });
  return t;
}
export function addToWeek(title: string) {
  const w = viewWeek(), from = ui.off === 0 ? todayIdx() : 0;
  const d = (ui.selDay >= from && roomIn(todoAt(w, ui.selDay), 2)) ? ui.selDay : flexDay(w, from, 2);
  if (d < 0) { toast('На этой неделе нет места'); buzz('warn'); return; }
  const t = addTaskAt(title, w, d);
  if (t) { ui.selDay = d; toast('Добавлено: ' + DAYS[d].toLowerCase(), () => { state.tasks = state.tasks.filter(x => x.id !== t.id); save(); }); }
}
export function pickIntoDay(t: Task, w: string, d: number) {
  if (!roomIn(todoAt(w, d, t.id), lv(t))) { toast('В этот день не помещается: уже есть сложная задача'); buzz('warn'); return false; }
  t.week = w; t.day = d; t.pin = true;
  state.tasks = state.tasks.filter(x => x.id !== t.id).concat([t]);
  save(); buzz(); return true;
}
// замена: задача будущего дня ↔ одна из сегодняшних
export function swapToday(t: Task, withId: 'free' | string) {
  const tw = realWeek(), ti = todayIdx(), ow = t.week!, od = t.day!, before = [snap(t)];
  if (withId === 'free') {
    if (!roomIn(todoAt(tw, ti), lv(t))) { toast('Сегодня не помещается: уже есть сложная задача'); buzz('warn'); return false; }
    t.week = tw; t.day = ti; t.pin = true;
  } else {
    const o = byId(withId); if (!o) return false;
    if (!roomIn(todoAt(tw, ti, o.id), lv(t)) || !roomIn(todoAt(ow, od, t.id), lv(o))) { toast('Не получится: в этом дне уже была бы вторая сложная задача'); buzz('warn'); return false; }
    before.push(snap(o));
    o.week = ow; o.day = od; o.pin = true; o.moves = (o.moves || 0) + 1;
    t.week = tw; t.day = ti; t.pin = true;
  }
  save(); buzz('medium');
  toast(withId === 'free' ? 'Задача перенесена на сегодня' : 'Задачи поменялись местами', () => { before.forEach(revert); save(); });
  return true;
}
export function placeAt(t: Task, m: number) {
  t.start = m; save(); buzz();
  toast('«' + short(t.title) + '» · ' + m2t(m) + '–' + m2t(Math.min(1440, m + minsOf(t))));
}

/* ---------- проекты ---------- */
export function createProject(name: string, color?: string) {
  const k = topicKey(name), p = { id: uid(), name: String(name).trim().slice(0, 28), color: color || unusedColor() };
  let moved = 0;
  state.projects.push(p);
  [...state.tasks, ...state.backlog].forEach(t => { if (!t.project && t.topic && topicKey(t.topic) === k) { t.project = p.id; moved++; } });
  delete state.memory.topics[k]; delete state.memory.ai[k];
  save();
  return { p, moved };
}
export function saveProject(id: string | null, name: string, color: string) {
  name = name.trim().slice(0, 28);
  if (!name) { toast('Введите название проекта'); return false; }
  if (state.projects.some(p => p.id !== id && topicKey(p.name) === topicKey(name))) { toast('Такой проект уже есть'); return false; }
  if (id) { const p = prObj(id); if (p) { p.name = name; p.color = color; } save(); return true; }
  if (state.projects.length >= MAXPRJ) { toast('Максимум ' + MAXPRJ + ' проектов'); return false; }
  const r = createProject(name, color);
  toast('Проект «' + short(r.p.name) + '» создан' + (r.moved ? ': собрано задач — ' + r.moved : ''));
  return true;
}
export function deleteProject(id: string) {
  [...state.tasks, ...state.backlog].forEach(t => { if (t.project === id) t.project = null; });
  state.projects = state.projects.filter(p => p.id !== id);
  ui.screens = ui.screens.filter(s => !(s.name === 'project' && s.id === id));
  save(); toast('Проект удалён');
}
export function moveProject(id: string, dir: number) {
  const i = state.projects.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= state.projects.length) return;
  const t = state.projects[i]; state.projects[i] = state.projects[j]; state.projects[j] = t;
  save(); buzz();
}
export function acceptSuggestion(k: string) {
  const s = suggestions().find(x => x.k === k);
  if (s) { const r = createProject(s.name); toast('Проект «' + short(r.p.name) + '» создан' + (r.moved ? ': собрано задач — ' + r.moved : '')); buzz(); }
}
export function dismissSuggestion(k: string) { state.memory.dismissed[k] = Date.now(); save(); toast('Хорошо, спрошу позже'); }

/* ---------- бэклог ---------- */
export function addBacklog(pid: string, title: string) {
  const v = title.trim(); if (!v) return;
  state.backlog.push({ id: uid(), title: v.slice(0, 120), project: pid, topic: null, level: 2, ts: Date.now() });
  save(); buzz();
}
export function deleteBacklog(id: string) {
  const b = state.backlog.find(x => x.id === id); if (!b) return;
  const copy = snap(b), idx = state.backlog.indexOf(b);
  state.backlog.splice(idx, 1); save();
  toast('Удалено из бэклога: «' + short(b.title) + '»', () => { state.backlog.splice(idx, 0, copy); save(); });
}
export function scheduleBacklog(id: string) {
  const b = state.backlog.find(x => x.id === id); if (!b) return;
  scheduleItems([{ title: b.title, level: b.level || 2, mins: b.mins || null, day: null, wk: 0, project: b.project, topic: b.topic }], realWeek(), todayIdx());
  const t = state.tasks[state.tasks.length - 1];
  if (b.note) t.note = b.note; if (b.subs) t.subs = b.subs;
  const copy = snap(b), idx = state.backlog.indexOf(b);
  state.backlog.splice(idx, 1); save();
  toast('«' + short(b.title) + '» запланировано: ' + DAYS[t.day!].toLowerCase() + (t.week !== realWeek() ? ', след. неделя' : ''), () => {
    state.tasks = state.tasks.filter(x => x.id !== t.id); state.backlog.splice(idx, 0, copy); save();
  });
}

/* ---------- регулярные дела ---------- */
export function deleteRegular(id: string) {
  const r = state.regulars.find(x => x.id === id); if (!r) return;
  const copy = snap(r), idx = state.regulars.indexOf(r);
  state.regulars = state.regulars.filter(x => x.id !== id);
  save();
  toast('«' + short(r.title) + '» удалено из регулярных', () => { state.regulars.splice(idx, 0, copy); save(); });
}

/* ---------- итоги недели ---------- */
export function wmeta(w: string) { return state.weekMeta[w] || (state.weekMeta[w] = {}); }
export function toggleWeekClosed(w: string) {
  const m = wmeta(w);
  if (m.closed) { delete m.closed; toast('Неделя снова открыта'); } else { m.closed = Date.now(); toast('Неделя закрыта'); buzz('success'); }
  save();
}

/* ---------- данные ---------- */
export function deleteAllTasks() {
  const st = JSON.stringify(state.tasks), sb = JSON.stringify(state.backlog), n = state.tasks.length + state.backlog.length;
  if (!n) { toast('Задач нет'); return; }
  state.tasks = []; state.backlog = []; save(); buzz('medium');
  toast('Удалено задач: ' + n, () => { state.tasks = JSON.parse(st); state.backlog = JSON.parse(sb); save(); });
}
export function resetAll() {
  const all = JSON.stringify(state);
  replaceState({ ...emptyState(), settings: { theme: state.settings.theme, pal: state.settings.pal } });
  ui.off = 0; ui.screens = []; ui.sheet = null; ui.tab = 'home';
  save(); buzz('medium');
  toast('Всё стёрто. Начнём заново', () => { replaceState(JSON.parse(all)); save(); });
}
export function backupText() { return JSON.stringify({ app: 'OneDay', v: 1, ts: Date.now(), state }); }
export function restoreBackup(txt: string) {
  txt = txt.trim();
  if (!txt) { toast('Вставьте текст копии'); return false; }
  let o;
  try { o = JSON.parse(txt); if (o && o.state) o = o.state; if (!o || !Array.isArray(o.tasks)) throw new Error('bad'); }
  catch { toast('Это не похоже на копию OneDay'); return false; }
  const all = JSON.stringify(state);
  replaceState(o); save(); buzz('success');
  toast('Данные восстановлены', () => { replaceState(JSON.parse(all)); save(); });
  return true;
}

export { doneAt, dayDate, addWeeks, prByName };
