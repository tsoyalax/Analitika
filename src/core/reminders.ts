import { iso, realWeek, short, t2m, todayIdx } from './dates';
import { doneAt, lv, regsOn, todoAt } from './planner';
import { buzz, notify, save, saveFired, state, ui } from './store';

/* напоминания: работают, пока приложение открыто — баннером сверху */
export const NF = {
  morning: { t: '09:00', title: 'Утро', sub: 'План на день' },
  evening: { t: '21:00', title: 'Вечер', sub: 'Что сделано за день' },
  week: { t: '19:00', title: 'Итоги недели', sub: 'По воскресеньям' },
};
type K = keyof typeof NF;

export function nfGet(k: K) { const s = state.settings.nf?.[k] || {}; return { on: !!s.on, t: s.t || NF[k].t }; }
export function nfSet(k: string, patch: { on?: boolean; t?: string }) {
  state.settings.nf = state.settings.nf || {};
  state.settings.nf[k] = { ...(state.settings.nf[k] || {}), ...patch };
  if (patch.t) { delete ui.nfFired[k]; saveFired(); }
  save();
  if (patch.on) nfCheck();
}
export function nfMessage(k: K) {
  const w = realWeek(), ti = todayIdx();
  if (k === 'morning') {
    const todo = todoAt(w, ti).sort((a, b) => lv(b) - lv(a));
    return todo.length ? 'Задач на сегодня: ' + todo.length + '. Начните с «' + short(todo[0].title) + '»' : 'На сегодня задач нет. Самое время спланировать день.';
  }
  if (k === 'evening') {
    const done = doneAt(w, ti).length, left = todoAt(w, ti).length;
    return 'Сегодня сделано: ' + done + (left ? ', осталось: ' + left + '. Перенести на завтра?' : '. Хороший день!');
  }
  return 'Неделя заканчивается. Подведите итоги и разберите хвосты.';
}
export function showBanner(k: string, msg: string) { ui.banner = { k, msg }; buzz('warn'); notify(); }

export function nfCheck() {
  const n = new Date(), mm = n.getHours() * 60 + n.getMinutes(), f = ui.nfFired, today = iso(n);
  let ch = false;
  (['morning', 'evening', 'week'] as K[]).forEach(k => {
    const c = nfGet(k); if (!c.on) return;
    if (k === 'week' && todayIdx() !== 6) return;
    const m = t2m(c.t); if (isNaN(m) || mm < m || f[k] === today) return;
    f[k] = today; ch = true;
    if (k !== 'week' && mm - m > 360) return;
    showBanner(k, nfMessage(k));
  });
  if (regsOn()) state.regulars.forEach(r => {
    if (!r.time || r.rem == null || r.days.indexOf(todayIdx()) < 0) return;
    const s = t2m(r.time), key = 'r:' + r.id;
    if (isNaN(s) || mm < s - r.rem || f[key] === today) return;
    f[key] = today; ch = true;
    if (mm >= s + Math.max(r.mins || 60, 15)) return;
    const left = s - mm;
    showBanner('reg', left > 0 ? r.title + ' — через ' + left + ' мин (' + r.time + ')' : r.title + ' — уже идёт (с ' + r.time + ')');
  });
  if (ch) saveFired();
  notify(); // обновить состояния регулярных дел и кольцо времени
}
