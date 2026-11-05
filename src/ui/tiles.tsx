import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { completeTask, deleteTask, openSheet, returnTask } from '../core/actions';
import { hhmm, m2t, pl, fmtMins } from '../core/dates';
import { dayFrac, minsOf, prObj, regRange, regState } from '../core/planner';
import { Regular, Task, ui } from '../core/store';
import { Check, Clock, Repeat } from './icons';
import { SwipeRow, T, useT } from './kit';

function subInfo(t: Task) {
  const p: string[] = [], s = t.subs || [];
  if (s.length) p.push('Подзадачи ' + s.filter(x => x.d).length + '/' + s.length);
  if (t.note) p.push('заметка');
  return p.join(' · ');
}

// Плитка задачи: галочка, название, проект, время; свайп вправо — выполнено/вернуть, влево — удалить
export function TaskTile({ t, onPress, onLongPress, noCheck, compact }: { t: Task; onPress?: () => void; onLongPress?: () => void; noCheck?: boolean; compact?: boolean }) {
  const th = useT();
  const done = t.status === 'done', pr = prObj(t.project), info = subInfo(t);
  const fresh = done && ui.lastDoneId === t.id && Date.now() - ui.lastDoneAt < 1300;
  const time = done ? (t.doneTs ? hhmm(t.doneTs) : '') : (typeof t.start === 'number' ? m2t(t.start) + ' · ' : '') + fmtMins(minsOf(t));
  return (
    <SwipeRow kind={done ? 'done' : 'todo'} onRight={() => (done ? returnTask(t) : completeTask(t))} onLeft={() => deleteTask(t)}>
      <Pressable onPress={onPress || (() => openSheet({ kind: 'task', id: t.id }))} onLongPress={onLongPress} delayLongPress={380}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: compact ? 52 : 60, paddingVertical: 9, paddingLeft: noCheck ? 16 : 12, paddingRight: 14, backgroundColor: th.tile, borderRadius: 20, borderLeftWidth: pr ? 4 : 0, borderLeftColor: pr?.color }}>
        {noCheck ? null : (
          <Pressable hitSlop={10} disabled={done} onPress={() => completeTask(t)}
            style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: done ? th.acc : th.sub, backgroundColor: fresh ? th.acc : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {done ? <Check color={fresh ? th.accOn : th.acc} size={15} /> : null}
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={compact ? 16 : 17} w="500" style={done ? { color: th.sub, textDecorationLine: 'line-through' } : undefined}>{t.title}</T>
          {pr ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pr.color }} /><T sub size={12} w="500" numberOfLines={1}>{pr.name}</T></View> : null}
          {!done && t.moves ? <Text style={{ color: th.warn, fontSize: 12.5, fontWeight: '600', marginTop: 2 }}>Перенесена: {t.moves} {pl(t.moves, 'раз', 'раза', 'раз')}</Text> : null}
          {info ? <T sub size={12.5} style={{ marginTop: 2 }}>{info}</T> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock color={th.sub} size={15} />
          <T sub size={13.5} style={{ fontVariant: ['tabular-nums'] }}>{time}</T>
        </View>
      </Pressable>
    </SwipeRow>
  );
}

export function FreeSlot({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={{ minHeight: 52, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.dash, justifyContent: 'center', paddingHorizontal: 18 }}>
      <T sub size={15}>{label}</T>
    </Pressable>
  );
}

export function regSpan(r: Regular) { const g = regRange(r); return g ? m2t(g.s) + '–' + m2t(Math.min(1440, g.e)) : ''; }
export function RegChip({ r, w, d, onPress }: { r: Regular; w: string; d: number; onPress?: () => void }) {
  const t = useT();
  const st = regState(r, w, d);
  return (
    <Pressable onPress={onPress || (() => openSheet({ kind: 'regular', id: r.id }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 11, borderRadius: 99, backgroundColor: st === 'now' ? t.acc : t.accSoft, opacity: st === 'past' ? 0.55 : 1 }}>
      {st === 'past' ? <Check color={t.sub} size={13} /> : <Repeat color={st === 'now' ? t.accOn : t.acc} size={13} />}
      <Text style={{ color: st === 'now' ? t.accOn : st === 'past' ? t.sub : t.acc, fontSize: 13.5, fontWeight: '600', textDecorationLine: st === 'past' ? 'line-through' : 'none' }}>{r.title}</Text>
      {r.time ? <Text style={{ color: st === 'now' ? t.accOn : t.sub, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{regSpan(r)}</Text> : null}
    </Pressable>
  );
}

// Кольцо прогресса дня; тонкое кольцо под ним — сколько прошло от начала до конца дня
export function Ring({ done, total }: { done: number; total: number }) {
  const t = useT();
  const R = 104, C = 2 * Math.PI * R, p = total ? done / total : 0, all = total > 0 && done === total;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 14 }}>
      <Svg width={220} height={220} viewBox="0 0 220 220">
        <Circle cx={110} cy={110} r={R} stroke={t.seg} strokeWidth={10} fill="none" />
        <Circle cx={110} cy={110} r={R} stroke={t.acc} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 110 110)" />
        <Circle cx={110} cy={110} r={R} stroke={t.bord} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - dayFrac())} transform="rotate(-90 110 110)" />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {all ? (
          <T size={18} w="700" style={{ textAlign: 'center' }}>{'Задач больше нет!\nОтдыхайте :)'}</T>
        ) : (
          <>
            <T size={46} w="800" style={{ fontVariant: ['tabular-nums'] }}>{Math.round(p * 100)}%</T>
            <T w="600" size={15}>Прогресс</T>
            <T sub size={14}>{total ? done + '/' + total : 'Задач на сегодня нет'}</T>
          </>
        )}
      </View>
    </View>
  );
}

export function LoadBar({ h }: { h: number }) {
  const t = useT();
  const c = h <= 3 ? t.done : h <= 6 ? t.warn : t.danger;
  return <View style={{ width: 36, height: 6, borderRadius: 3, backgroundColor: t.seg, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.min(100, Math.round(h / 10 * 100))}%`, backgroundColor: c, borderRadius: 3 }} /></View>;
}
