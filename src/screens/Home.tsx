import React from 'react';
import { Pressable, View } from 'react-native';
import { openCal, openScreen, openSheet } from '../core/actions';
import { DAYS, fmt, realWeek, todayIdx } from '../core/dates';
import { doneAt, LIMIT, lv, regsAt, todoAt } from '../core/planner';
import { FocusLine, TopCard, WrCard } from '../ui/cards';
import { Clock } from '../ui/icons';
import { T, useT } from '../ui/kit';
import { FreeSlot, RegChip, Ring, TaskTile } from '../ui/tiles';

export function Home() {
  const t = useT();
  const ti = todayIdx(), w = realWeek();
  const todo = todoAt(w, ti).sort((a, b) => lv(b) - lv(a));
  const done = doneAt(w, ti);
  const free = LIMIT - todo.length - done.length;
  const regs = regsAt(ti);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 4, paddingHorizontal: 2 }}>
        <View>
          <T size={32} w="700">Сегодня</T>
          <T sub size={16} style={{ marginTop: 3 }}>{fmt(new Date())}, {DAYS[ti].toLowerCase()}</T>
        </View>
        <Pressable onPress={() => openCal()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 99, backgroundColor: t.seg }}>
          <Clock color={t.ink} size={18} /><T size={14} w="600">По часам</T>
        </Pressable>
      </View>
      <TopCard overdueOnly />
      <WrCard />
      <FocusLine w={w} />
      <Ring done={done.length} total={done.length + todo.length} />
      {regs.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 18 }}>{regs.map(r => <RegChip key={r.id} r={r} w={w} d={ti} />)}</View> : null}
      <View style={{ gap: 8 }}>
        {todo.slice(0, LIMIT).map(x => <TaskTile key={x.id} t={x} />)}
        {Array.from({ length: Math.max(0, free) }).map((_, i) => <FreeSlot key={'f' + i} label="Свободно" onPress={() => openSheet({ kind: 'free', w, d: ti })} />)}
      </View>
      {!todo.length && free <= 0 ? <T sub style={{ textAlign: 'center', marginTop: 8 }}>Задач больше нет! Отдыхайте :)</T> : null}
      {done.length ? (
        <Pressable onPress={() => openScreen('done')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, paddingHorizontal: 6, marginTop: 10 }}>
          <T sub size={15} w="600">Выполнено сегодня</T><T sub size={15} w="700">{done.length} ›</T>
        </Pressable>
      ) : null}
    </View>
  );
}
