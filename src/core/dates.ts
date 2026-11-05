export const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MON_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const pad = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function parseISO(s: string) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function addWeeks(s: string, n: number) { const d = parseISO(s); d.setDate(d.getDate() + 7 * n); return iso(d); }
export function mondayOf(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export function wdIdx(d: Date) { return (d.getDay() + 6) % 7; }
export function todayIdx() { return wdIdx(new Date()); }
export function realWeek() { return iso(mondayOf(new Date())); }
export function fmt(d: Date) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
export function fmtS(d: Date) { return d.getDate() + ' ' + MON_S[d.getMonth()]; }
export function hhmm(ts: number) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
export function dayKey(w: string, d: number) { const x = parseISO(w); x.setDate(x.getDate() + d); return iso(x); }
export function m2t(m: number) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
export function t2m(v: string | null | undefined) { const p = String(v || '').split(':'); return p.length === 2 && p[0] !== '' && p[1] !== '' ? (+p[0]) * 60 + (+p[1]) : NaN; }
export function range(a: number, b: number) { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r; }
export function weekRange(w: string) { const b = parseISO(w); b.setDate(b.getDate() + 6); return fmtS(parseISO(w)) + ' – ' + fmtS(b); }
export function wkOffset(w: string) { return Math.round((parseISO(w).getTime() - parseISO(realWeek()).getTime()) / 6048e5); }
// День относительно понедельника текущей недели (сегодня = todayIdx)
export function rel(w: string, d: number) { return Math.round((parseISO(w).getTime() - parseISO(realWeek()).getTime()) / 864e5) + d; }

export function pl(n: number, a: string, b: string, c: string) { const m = n % 100, k = n % 10; if (m > 10 && m < 15) return c; if (k === 1) return a; if (k > 1 && k < 5) return b; return c; }
export function fmtMins(m: number) { if (m < 60) return m + ' мин'; return String(Math.round(m / 30) / 2).replace('.', ',') + ' ч'; }
export function durText(m: number) { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + ' ч' + (r ? ' ' + r + ' мин' : '') : r + ' мин'; }
export function short(s: string) { return s.length > 26 ? s.slice(0, 25) + '…' : s; }
export function greetWord() { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; }
export function dayLabelTs(ts: number) {
  const d = new Date(ts), n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return diff === 0 ? 'Сегодня' : diff === 1 ? 'Вчера' : SHORT[wdIdx(d)] + ', ' + fmt(d);
}
export function daysLabel(ds: number[]) {
  const s = ds.slice().sort().join('');
  if (s === '0123456') return 'каждый день';
  if (s === '01234') return 'по будням';
  if (s === '56') return 'по выходным';
  return ds.slice().sort().map(d => SHORT[d]).join(', ');
}
