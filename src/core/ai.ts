import Anthropic from '@anthropic-ai/sdk';
import { addWeeks, DAYS, iso, realWeek, todayIdx, weekRange, wkOffset } from './dates';
import { createProject } from './actions';
import {
  buildProposal, LIMIT, levelFromMins, lvlOf, MAXPRJ, minsIn, PlanItem, prByName, prObj, regSplit, scheduleItems, todoAt, topicKey,
} from './planner';
import { buzz, notify, save, state, Task, toast, ui, uid } from './store';

type Item = { title: string; project: string | null; topic: string | null };
type Reg = { title: string; time: string | null; days: number[]; level: number; mins: number | null };
type BL = Item & { mins: number | null; level: number };
type AiData = Record<string, unknown>;

export const voice = { text: '', busy: false, note: '' };
export let prop: null | { data: AiData; done: Item[]; plan: PlanItem[]; regular: Reg[]; rw: string; ti: number; sel: string | null; tasks: Task[]; shifted: number } = null;
let lastText = '';

/* ---------- промпты ---------- */
function weekPrompt() {
  const rw = realWeek(); let s = '';
  for (let k = 0; k <= 8; k++) s += k + ' — ' + weekRange(addWeeks(rw, k)) + (k === 0 ? ' (текущая)' : '') + '; ';
  return 'Календарь недель (номер — даты): ' + s;
}
function projectsPrompt() {
  const m = state.memory, now = Date.now();
  const names = state.projects.map(p => p.name);
  const topics = Object.keys(m.topics).map(k => m.topics[k]).sort((a, b) => b.n - a.n).slice(0, 8).map(t => t.name + ' (' + t.n + ')');
  const recent = [...state.tasks, ...state.backlog].slice(-24).map(t => { const p = prObj(t.project); return t.title + (p ? ' [' + p.name + ']' : ''); });
  const dis = Object.keys(m.dismissed).filter(k => now - m.dismissed[k] < 14 * 864e5);
  return '4) project и topic. Проекты (сферы жизни) человека: ' + (names.join('; ') || 'пока нет') + '. Для КАЖДОЙ задачи из done, plan и backlog поставь project — точное название одного проекта из этого списка, если задача к нему относится, иначе null. Новые проекты создавай ТОЛЬКО если человек сам назвал их проектами («проект X», «новый проект Y», «работаю над проектом Z», «заведи проект…»): добавь их в projects_new коротким названием до 3 слов без слова «проект» и у задач этого проекта ставь project = то же название. В остальных случаях проекты не придумывай. ' +
    'Если project = null, но задача относится к повторяющейся теме (язык, спорт, дети, ремонт, блог и подобное), дай topic — короткое название темы из 1–3 слов; если подходящая тема уже есть в памяти, используй её название. Известные темы из памяти: ' + (topics.join('; ') || 'нет') + '.\n' +
    '5) backlog — идеи и дела без срока («когда-нибудь», «надо бы», «на потом», «есть идея»). Их не ставь в plan. У каждой есть level (сложность 1–3, как в plan).\n' +
    '6) suggest — только если по памяти видно, что человек часто возвращается к теме, которой нет среди проектов (3 и больше похожих задач вместе с прошлыми): объект {name, why}, why — одна короткая фраза. Не предлагай отклонённые темы: ' + (dis.join('; ') || 'нет') + '. Недавняя память (последние задачи): ' + (recent.join('; ') || 'пусто') + '.\n';
}
function mainPrompt(text: string) {
  const ti = todayIdx(), rw = realWeek();
  const known = state.regulars.map(r => r.title).join('; ') || 'нет';
  return 'Сегодня ' + DAYS[ti].toLowerCase() + ', ' + iso(new Date()) + '. Неделя идёт с понедельника (' + rw + ') по воскресенье. ' +
    'Индексы дней: 0 — понедельник, 1 — вторник, 2 — среда, 3 — четверг, 4 — пятница, 5 — суббота, 6 — воскресенье. Сегодня индекс ' + ti + '.\n\n' +
    'Ниже расшифровка голосовой записи человека (возможны оговорки, повторы, ошибки распознавания). Раздели её на три списка:\n' +
    '1) done — что человек фактически уже сделал (прошедшее время). Идёт в «Сделано» на сегодня. Короткие формулировки до 8 слов.\n' +
    '2) plan — разовые задачи, которые он только собирается сделать на этой неделе (будущее время, намерения). Короткие формулировки до 8 слов, с глагола. У каждой: mins — примерные затраты времени в минутах (реалистично, с подготовкой и усилиями: короткий звонок 10–15, письмо 15–30, документ 60–120, большой отчёт 240 и больше), level — сложность 1–3 строго по mins: 1 до 30 минут, 2 от 30 минут до 2,5 часов, 3 больше 2,5 часов (примеры типов дел: 1 — лёгкая рутина до 30 минут: позвонить, написать, купить, отправить; 2 — средняя, 1–3 часа сосредоточенной работы; 3 — сложная: много времени, усилий или нервов — отчёт, экзамен, большой проект, трудный разговор, тяжёлая тренировка) и day. ' +
    'day указывай (индекс дня) только если человек сам назвал день или срок, иначе day = null: распределением по дням занимается приложение. week — через сколько недель от текущей нужна задача (0 — на этой неделе, 1 — на следующей, 2 — через две недели и так далее, максимум 12). Указывай week, если человек назвал неделю или срок («на следующей неделе», «через две недели», «в середине ноября», «до 20 числа»), иначе 0. Если названа дата, определи по календарю, на какую неделю и день она приходится, и укажи week и day. Задачи могут относиться к разным неделям в одной записи. ' + weekPrompt() + 'Оценивай сложность честно, по смыслу задачи и словам человека («тяжело», «страшно», «на пять минут»). ' +
    '\n' +
    '3) regular — то, что человек делает РЕГУЛЯРНО, по расписанию (учёба, тренажёрный зал, рабочие часы, подработка, занятия, тренировки, курсы и подобное; слова «каждый», «по», «регулярно», «всегда», «обычно»). ' +
    'Это не разовые задачи. Каждый элемент: title — короткое название до 4 слов (если названо время, добавь его, например «Зал 19:00»), days — массив индексов дней недели, когда это происходит, mins — сколько минут это занимает за один раз (например, «рабочие часы 2–3 часа» = 150), level — сколько сил это отнимает в такой день, от 1 до 3 (рабочий день или долгая учёба = 3, тренировка или подработка = 2, короткие занятия = 1). ' +
    '«каждый день» = [0,1,2,3,4,5,6]; «по будням» = [0,1,2,3,4]; «по выходным» = [5,6]. Если дни не названы, выбери по смыслу (рабочие часы и учёба обычно по будням). Уже известные регулярные дела: ' + known + '.\n' +
    projectsPrompt() + 'Не дублируй: регулярное не должно попадать в plan и done (кроме случая, когда человек прямо сказал, что сегодня это сделал — тогда оно также попадает в done). ' +
    'Не выдумывай то, чего человек не говорил. Если чего-то нет, верни пустой массив.\n' +
    'Ответь ТОЛЬКО JSON без markdown и пояснений: {"done":[{"title":"","project":null,"topic":null}],"plan":[{"title":"","level":2,"mins":60,"week":0,"day":null,"project":null,"topic":null}],"backlog":[{"title":"","level":2,"mins":60,"project":null,"topic":null}],"regular":[{"title":"","days":[0,2,4],"level":2,"mins":60}],"suggest":[{"name":"","why":""}],"projects_new":[""]}\n\n' +
    'Расшифровка:\n<<<\n' + text + '\n>>>';
}
function onbPrompt(text: string) {
  return 'Человек перечисляет свои проекты и сферы жизни, которыми занимается (работа, учёба, спорт, подработка, ремонт, семья, блог и подобное). Выдели от 1 до 8 названий. Каждое — коротко, до 3 слов, с заглавной буквы, без слова «проект», без дублей. Не выдумывай то, что человек не называл. Ответь ТОЛЬКО JSON без markdown и пояснений: {"projects":["Работа","Учёба"]}\n\nРасшифровка:\n<<<\n' + text + '\n>>>';
}

/* ---------- вызов Claude ---------- */
async function ask(promptText: string) {
  const client = new Anthropic({ apiKey: ui.apiKey });
  // fallbacks — серверный повтор на другой модели, если запрос отклонён фильтрами безопасности
  const res = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    messages: [{ role: 'user', content: promptText }],
    ...({ fallbacks: 'default' } as object),
  } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { code: 'refusal' });
  return res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
}

export async function processVoice() {
  const text = voice.text.trim();
  if (!text) { toast('Ничего не написано. Попробуйте ещё раз.'); return; }
  if (!ui.apiKey) { voice.note = 'Добавьте ключ Claude API в Настройки → Помощник.'; notify(); return; }
  lastText = text; voice.busy = true; voice.note = ''; notify();
  const onb = state.memory.onb === 'projects';
  try {
    const out = await ask(onb ? onbPrompt(text) : mainPrompt(text));
    const mt = out.match(/\{[\s\S]*\}/);
    if (!mt) throw new Error('bad');
    voice.busy = false; voice.text = '';
    if (ui.sheet?.kind === 'voice') ui.sheet = null;
    if (onb) onbApply(JSON.parse(mt[0])); else apply(JSON.parse(mt[0]));
  } catch (err) {
    const e = err as { status?: number; code?: string };
    voice.busy = false;
    voice.note = (e.status === 401 ? 'Ключ API не подошёл.' : e.status === 429 ? 'Слишком много запросов. Подождите минуту.' : e.code === 'refusal' ? 'Помощник отказался разбирать запись.' : 'Не удалось разобрать запись.') + ' Текст сохранён — можно отправить снова.';
  }
  notify();
}

/* ---------- первый запуск: проекты ---------- */
export const onb = { list: [] as string[] };
function onbApply(data: AiData) {
  const names: string[] = [], raw = Array.isArray(data.projects) ? data.projects : [], room = MAXPRJ - state.projects.length;
  raw.forEach((n: unknown) => {
    const s = String((n as { name?: string })?.name ?? n ?? '').trim().replace(/^проект\s+/i, '').slice(0, 28);
    if (s && !prByName(s) && names.map(topicKey).indexOf(topicKey(s)) < 0 && names.length < room) names.push(s);
  });
  if (!names.length) { toast('Не расслышал проекты. Скажите ещё раз.'); return; }
  onb.list = names; buzz('success'); notify();
}
export function onbCreate() {
  const names = onb.list.slice(); onb.list = [];
  state.memory.onb = 'plans';
  names.forEach(n => { if (state.projects.length < MAXPRJ && !prByName(n)) createProject(n); });
  save(); buzz('success'); toast('Проекты созданы: ' + names.length);
}
export function onbSkip() { onb.list = []; state.memory.onb = state.memory.onb === 'projects' ? 'plans' : 'done'; save(); }

/* ---------- разбор ответа ---------- */
// Элемент ответа ИИ: строка или объект {title, project, topic}
function itemObj(x: unknown): Item {
  const o = (typeof x === 'string' ? { title: x } : (x || {})) as Record<string, unknown>;
  const pr = prByName(o.project); let topic: string | null = null;
  if (!pr) { const raw = String(o.topic || o.project || '').trim(); if (raw && topicKey(raw) !== 'null') topic = raw.slice(0, 28); }
  return { title: String(o.title || '').trim(), project: pr ? pr.id : null, topic };
}
function newProjNames(data: AiData) {
  const raw = Array.isArray(data.projects_new) ? data.projects_new : [], out: string[] = [];
  raw.forEach((n: unknown) => {
    const s = String((n as { name?: string })?.name ?? n ?? '').trim().replace(/^проект\s+/i, '').slice(0, 28);
    if (s && !prByName(s) && out.map(topicKey).indexOf(topicKey(s)) < 0) out.push(s);
  });
  return out;
}
function learn(done: Item[], plan: PlanItem[], backlog: BL[], data: AiData) {
  const m = state.memory, sid = uid(), now = Date.now();
  m.sessions++;
  if (lastText) { m.log.push({ ts: now, text: lastText.slice(0, 400) }); if (m.log.length > 40) m.log.shift(); lastText = ''; }
  [...done, ...plan, ...backlog].forEach(it => {
    if (it.project || !it.topic || prByName(it.topic)) return;
    const k = topicKey(it.topic), tp = m.topics[k] || (m.topics[k] = { name: it.topic, n: 0, sess: [], last: 0 });
    tp.n++; tp.last = now;
    if (tp.sess.indexOf(sid) < 0) tp.sess.push(sid);
  });
  (Array.isArray(data.suggest) ? data.suggest : []).forEach((s: { name?: string; why?: string }) => {
    const name = String(s?.name || '').trim().slice(0, 28), k = topicKey(name);
    if (name && !prByName(name)) m.ai[k] = { name, why: String(s?.why || '').trim().slice(0, 140), ts: now };
  });
}

function parse(data: AiData) {
  const done = (Array.isArray(data.done) ? data.done : []).map(itemObj).filter(o => o.title);
  const plan: PlanItem[] = (Array.isArray(data.plan) ? data.plan : []).map((p: Record<string, unknown>) => {
    let d: number | null = p && p.day != null && p.day !== '' ? parseInt(String(p.day), 10) : NaN;
    d = isNaN(d) ? null : Math.max(0, Math.min(6, d));
    const o = itemObj(p), mm = minsIn(p?.mins);
    let wk = parseInt(String(p?.week), 10); wk = isNaN(wk) ? 0 : Math.max(0, Math.min(12, wk));
    return { title: o.title, day: d, wk, mins: mm, level: mm ? levelFromMins(mm) : lvlOf(p?.level), project: o.project, topic: o.topic };
  }).filter((p: PlanItem) => p.title);
  const regular: Reg[] = (Array.isArray(data.regular) ? data.regular : []).map((r: Record<string, unknown>) => {
    let ds = (Array.isArray(r?.days) ? r.days : []).map((x: unknown) => parseInt(String(x), 10)).filter((x: number) => x >= 0 && x <= 6);
    ds = ds.filter((x: number, i: number) => ds.indexOf(x) === i).sort();
    const sp = regSplit(r?.title);
    return { title: sp.title, time: sp.time, days: ds.length ? ds : [0, 1, 2, 3, 4], level: lvlOf(r?.level), mins: minsIn(r?.mins) };
  }).filter((r: Reg) => r.title);
  const backlog: BL[] = (Array.isArray(data.backlog) ? data.backlog : []).map((b: Record<string, unknown>) => {
    const o = itemObj(b), mm = minsIn(b?.mins);
    return { ...o, mins: mm, level: mm ? levelFromMins(mm) : lvlOf(b?.level) };
  }).filter((b: BL) => b.title);
  return { done, plan, regular, backlog };
}

// Если есть задачи на план — сначала показываем предложение по дням
function apply(data: AiData) {
  const { done, plan, regular } = parse(data);
  if (plan.length) {
    const rw = realWeek(), ti = todayIdx(), bp = buildProposal(plan, rw, ti);
    prop = { data, done, plan, regular, rw, ti, sel: null, tasks: bp.tasks, shifted: bp.shifted };
    ui.sheet = { kind: 'proposal' }; buzz(); notify();
    return;
  }
  commit(data, null);
}
export function shuffleProp() {
  if (!prop) return;
  const bp = buildProposal(prop.plan, prop.rw, prop.ti, 4);
  prop.tasks = bp.tasks; prop.shifted = bp.shifted; prop.sel = null; buzz(); notify();
}
export function cancelProp() { prop = null; ui.sheet = null; toast('Ничего не добавлено'); }
export function confirmProp() {
  if (!prop) return;
  const p = prop; prop = null; ui.sheet = null;
  p.tasks.forEach(t => { delete t.pk; });
  commit(p.data, p.tasks);
}
export function propNewProjects() { return prop ? newProjNames(prop.data) : []; }
export function propList(w: string, d: number, skip?: Task) { return todoAt(w, d).concat(prop ? prop.tasks.filter(x => x !== skip && x.week === w && x.day === d) : []); }

function commit(data: AiData, confirmed: Task[] | null) {
  const ti = todayIdx(), now = Date.now(), rw = realWeek();
  const { done, plan, regular, backlog } = parse(data);
  const newProj = newProjNames(data);
  done.forEach((t, i) => state.tasks.push({ id: uid(), title: t.title, project: t.project, topic: t.topic, status: 'done', week: null, day: null, doneWeek: rw, doneDay: ti, doneTs: now + i }));
  let shifted = 0;
  const nb = state.tasks.length;
  if (confirmed) confirmed.forEach(t => state.tasks.push(t)); else shifted = scheduleItems(plan, rw, ti);
  const added = state.tasks.slice(nb).filter(x => x.status === 'todo');
  regular.forEach(r => {
    const ex = state.regulars.find(x => x.title.toLowerCase() === r.title.toLowerCase());
    if (ex) { ex.days = r.days; ex.level = r.level; ex.mins = r.mins; if (r.time) { ex.time = r.time; if (ex.rem == null) ex.rem = 10; } }
    else state.regulars.push({ id: uid(), title: r.title, days: r.days, level: r.level, mins: r.mins, time: r.time || null, rem: r.time ? 10 : null });
  });
  backlog.forEach(b => state.backlog.push({ id: uid(), title: b.title, project: b.project, topic: b.topic, level: b.level, mins: b.mins, ts: now }));
  const made: string[] = [];
  newProj.forEach(n => { if (state.projects.length < MAXPRJ && !prByName(n)) { createProject(n); made.push(n); } });
  learn(done, plan, backlog, data);
  if (state.memory.onb === 'plans' && (done.length || plan.length || backlog.length || regular.length)) state.memory.onb = 'done';
  ui.off = 0; ui.selDay = ti;
  if (plan.length || (!done.length && (regular.length || backlog.length))) { ui.tab = 'todo'; ui.planView = 'week'; } else ui.tab = 'home';
  if (added.length && !added.some(x => x.week === rw)) {
    const mn = added.slice().sort((a, b) => (a.week! < b.week! ? -1 : a.week! > b.week! ? 1 : a.day! - b.day!))[0];
    ui.off = wkOffset(mn.week!); ui.selDay = mn.day!;
  }
  save(); buzz('success');
  if (!done.length && !plan.length && !regular.length && !backlog.length && !newProj.length) { toast('В записи не нашлось дел.'); return; }
  const hard = plan.filter(p => p.level === 3).length;
  let msg = 'Сделано: ' + done.length + ' · Сделать: ' + plan.length + (hard ? ' (сложных: ' + hard + ')' : '') + ' · Регулярное: ' + regular.length;
  if (backlog.length) msg += ' · Бэклог: ' + backlog.length;
  if (made.length) msg += '. Новые проекты: ' + made.join(', ');
  if (newProj.length > made.length) msg += '. Лимит проектов: ' + MAXPRJ;
  const fut = added.filter(x => x.week !== rw).length;
  if (fut) msg += ' · На другие недели: ' + fut;
  if (shifted) msg += '. На эту неделю не хватило места: перенёс ' + shifted + ' на следующие недели';
  toast(msg);
}

export function freeSlotsHint() {
  const ti = todayIdx(), rw = realWeek(); let n = 0;
  for (let d = ti; d < 7; d++) n += Math.max(0, LIMIT - todoAt(rw, d).length);
  return n;
}
