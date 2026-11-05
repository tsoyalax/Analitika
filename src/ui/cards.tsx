import React from 'react';
import { Pressable } from 'react-native';
import { acceptSuggestion, deleteTask, dismissSuggestion, keepTask, openScreen, rollOverdue, snoozeOverdue, toBacklog, wmeta } from '../core/actions';
import { addWeeks, iso, pl, realWeek, short, todayIdx } from '../core/dates';
import { overdueDays, overdueTasks, staleTask, suggestions, weekReport } from '../core/planner';
import { save, state, ui } from '../core/store';
import { SugCard, T, useT } from './kit';

function StaleCard() {
  const t = staleTask();
  if (!t) return null;
  const m = t.moves || 0, od = overdueDays(t);
  const why = m >= 3 && m >= (t.keep == null ? 3 : t.keep + 2) ? 'переносится уже ' + m + ' ' + pl(m, 'раз', 'раза', 'раз') : 'не выполняется уже ' + od + ' ' + pl(od, 'день', 'дня', 'дней');
  const acts: { label: string; kind?: 'pri' | 'sec' | 'dng'; onPress: () => void; wide?: boolean }[] = [
    { label: 'Убрать', kind: 'dng', onPress: () => deleteTask(t) },
    { label: 'Оставить', onPress: () => keepTask(t) },
  ];
  if (t.project) acts.push({ label: 'В бэклог проекта', onPress: () => toBacklog(t), wide: true });
  return <SugCard title={'«' + short(t.title) + '» ' + why} text="Убрать её из плана?" actions={acts} />;
}
function OverdueCard() {
  if (state.memory.ovSnooze === iso(new Date())) return null;
  const list = overdueTasks();
  if (!list.length) return null;
  return <SugCard title={'Не выполнено: ' + list.length + ' ' + pl(list.length, 'задача', 'задачи', 'задач')} text="Задачи из прошедших дней. Перенести их на ближайшие свободные слоты?"
    actions={[{ label: 'Перенести', kind: 'pri', onPress: rollOverdue }, { label: 'Позже', onPress: snoozeOverdue }]} />;
}
function SuggestCard() {
  const s = suggestions()[0];
  if (!s) return null;
  return <SugCard title={'Кажется, ты часто говоришь про «' + s.name + '»'} text={(s.why ? s.why + ' ' : '') + (s.n ? 'Задач по теме: ' + s.n + '. ' : '') + 'Создать отдельный проект?'}
    actions={[{ label: 'Создать проект', kind: 'pri', onPress: () => acceptSuggestion(s.k) }, { label: 'Не сейчас', onPress: () => dismissSuggestion(s.k) }]} />;
}
export function TopCard({ overdueOnly }: { overdueOnly?: boolean }) {
  if (overdueOnly) return <OverdueCard />;
  if (staleTask()) return <StaleCard />;
  if (overdueTasks().length && state.memory.ovSnooze !== iso(new Date())) return <OverdueCard />;
  return <SuggestCard />;
}

// Напоминание подвести итоги: в выходные — по этой неделе, в понедельник-вторник — по прошлой
export function WrCard() {
  const ti = todayIdx(), w = ti >= 5 ? realWeek() : ti <= 1 ? addWeeks(realWeek(), -1) : null;
  if (!w) return null;
  const m = state.weekMeta[w] || {};
  if (m.closed || m.snooze === iso(new Date())) return null;
  const r = weekReport(w);
  if (!r.total) return null;
  return <SugCard title={w === realWeek() ? 'Неделя подходит к концу' : 'Прошлая неделя ещё не закрыта'} text={'Сделано ' + r.done + ' из ' + r.total + '. Посмотреть итоги и разобрать хвосты?'}
    actions={[{ label: 'Итоги недели', kind: 'pri', onPress: () => { ui.wrW = w; openScreen('review'); } }, { label: 'Позже', onPress: () => { wmeta(w).snooze = iso(new Date()); save(); } }]} />;
}
export function FocusLine({ w }: { w: string }) {
  const t = useT();
  const f = state.weekMeta[w]?.focus;
  if (!f) return null;
  return (
    <Pressable onPress={() => { ui.wrW = w; openScreen('review'); }} style={{ backgroundColor: t.accSoft, borderRadius: 18, padding: 14, marginVertical: 6 }}>
      <T sub size={12.5} w="600">Фокус недели</T>
      <T w="700">{f}</T>
    </Pressable>
  );
}
