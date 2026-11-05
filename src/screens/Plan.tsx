import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addToWeek, arrangeWeek, goWeek, openCal, openScreen, openSheet, setPlanView, setSel, shiftDay, shiftMonth } from '../core/actions';
import { dayKey, DAYS, durText, fmt, iso, m2t, MONTHS, MONTHS_N, mondayOf, parseISO, pl, rel, SHORT, todayIdx, wdIdx, weekRange } from '../core/dates';
import {
  busyFrom, calEvents, calIndex, dayCfg, dayDate, dayLoad, doneAt, Ev, freeFrom, isPast, isToday, LIMIT, lv, regRange, regsAt,
  sumIv, todoAt, viewWeek, weekStats,
} from '../core/planner';
import { buzz, lastUndo, notify, runUndo, Task, ui } from '../core/store';
import { FocusLine, TopCard, WrCard } from '../ui/cards';
import { ChevL, ChevR, Plus, Shuffle, Sort, Undo } from '../ui/icons';
import { Card, Input, Seg, T, useT } from '../ui/kit';
import { FreeSlot, LoadBar, RegChip, TaskTile } from '../ui/tiles';

export const ScrollCtx = createContext<{ scrollTo: (y: number) => void; dayY: Record<number, number> }>({ scrollTo: () => {}, dayY: {} });

/* ---------- шапка ---------- */
function Arrow({ dir, onPress }: { dir: -1 | 1; onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.bord }}>
      {dir < 0 ? <ChevL color={t.ink} size={20} /> : <ChevR color={t.ink} size={20} />}
    </Pressable>
  );
}
export function PlanHeader() {
  const t = useT();
  const sc = useContext(ScrollCtx);
  const pv = ui.planView;
  let center: React.ReactNode, onPrev: () => void, onNext: () => void, onLabel: () => void;
  if (pv === 'week') {
    const a = dayDate(0), b = dayDate(6), st = weekStats(viewWeek()), pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    onPrev = () => goWeek(ui.off - 1); onNext = () => goWeek(ui.off + 1); onLabel = () => { if (ui.off !== 0) goWeek(0); };
    center = (
      <>
        <T size={19} w="800">{a.getMonth() === b.getMonth() ? a.getDate() + ' — ' + b.getDate() + ' ' + MONTHS[b.getMonth()] : fmt(a) + ' — ' + fmt(b)}</T>
        {ui.off !== 0 ? <T sub size={12.5}>К текущей неделе</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 }}>
          <View style={{ width: 124, height: 8, borderRadius: 4, backgroundColor: t.seg, overflow: 'hidden' }}><View style={{ height: '100%', width: `${pct}%`, backgroundColor: t.acc, borderRadius: 4 }} /></View>
          <T sub size={13} w="600" style={{ minWidth: 44, fontVariant: ['tabular-nums'] }}>{st.total ? st.done + ' из ' + st.total : 'нет задач'}</T>
        </View>
      </>
    );
  } else {
    const sd = parseISO(ui.calSel), isT = ui.calSel === iso(new Date());
    const mt = ui.calY === new Date().getFullYear() && ui.calM === new Date().getMonth();
    onPrev = () => (pv === 'day' ? shiftDay(-1) : shiftMonth(-1)); onNext = () => (pv === 'day' ? shiftDay(1) : shiftMonth(1));
    onLabel = () => { setSel(iso(new Date())); notify(); };
    center = (
      <>
        <T size={19} w="800">{pv === 'day' ? DAYS[wdIdx(sd)] + ', ' + fmt(sd) : MONTHS_N[ui.calM] + ' ' + ui.calY}</T>
        {(pv === 'day' ? !isT : !mt) ? <T sub size={12.5}>{pv === 'day' ? 'К сегодняшнему дню' : 'К текущему месяцу'}</T> : null}
      </>
    );
  }
  const w = viewWeek();
  return (
    <View style={{ paddingTop: 8, paddingBottom: 4 }}>
      <Seg items={[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]} value={pv} onChange={v => setPlanView(v as 'day')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
        <Arrow dir={-1} onPress={onPrev} />
        <Pressable onPress={onLabel} style={{ flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>{center}</Pressable>
        <Arrow dir={1} onPress={onNext} />
      </View>
      {pv !== 'month' ? (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 6 }}>
          {SHORT.map((s, j) => {
            const k = dayKey(w, j), sel = pv === 'day' ? ui.calSel === k : ui.selDay === j, today = isToday(j), ld = dayLoad(w, j);
            const dc = ld <= 0 ? 'transparent' : ld <= 3 ? t.done : ld <= 6 ? t.warn : t.danger;
            return (
              <Pressable key={j} style={{ flex: 1, alignItems: 'center', minHeight: 56, justifyContent: 'center' }}
                onPress={() => { if (pv === 'day') { setSel(k); notify(); } else { ui.selDay = j; notify(); const y = sc.dayY[j]; if (y != null) sc.scrollTo(y); } buzz(); }}>
                <T sub size={11.5} w="600">{s}</T>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? (today ? t.acc : t.ink) : 'transparent' }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: sel ? (today ? t.accOn : t.bg) : today ? t.acc : t.ink }}>{dayDate(j).getDate()}</Text>
                </View>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dc }} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- неделя ---------- */
function onTaskPress(x: Task) {
  if (x.status === 'todo' && rel(x.week!, x.day!) > todayIdx()) openSheet({ kind: 'swap', id: x.id });
  else openSheet({ kind: 'task', id: x.id });
}
function Tools() {
  const t = useT();
  const n = weekStats(viewWeek()).todo, dis = ui.off < 0 || n < 2;
  const B = ({ ic, onPress, off, label }: { ic: React.ReactNode; onPress: () => void; off: boolean; label: string }) => (
    <Pressable accessibilityLabel={label} disabled={off} onPress={onPress} style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.32 : 1, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.bord }}>{ic}</Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginVertical: 6 }}>
      <B label="Расставить по сложности" ic={<Sort color={t.ink} />} off={dis} onPress={() => arrangeWeek(false)} />
      <B label="Перемешать" ic={<Shuffle color={t.ink} />} off={dis} onPress={() => arrangeWeek(true)} />
      <B label="Отменить последнее" ic={<Undo color={t.ink} />} off={!lastUndo} onPress={runUndo} />
    </View>
  );
}
function WeekView() {
  const t = useT();
  const sc = useContext(ScrollCtx);
  const [txt, setTxt] = useState('');
  const w = viewWeek(), st = weekStats(w), cfg = dayCfg(), span = cfg.e - cfg.s;
  let nfree = 0;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const list = todoAt(w, i).sort((a, b) => lv(b) - lv(a)).slice(0, LIMIT), dn = doneAt(w, i), past = isPast(i), today = isToday(i);
    const free = Math.max(0, LIMIT - list.length - dn.length);
    if (!past) nfree += free;
    const dsd = dayDate(i), ev = calEvents(dsd), busyM = sumIv(busyFrom(ev, cfg.s, cfg.e));
    const regs = regsAt(i);
    return (
      <View key={i} onLayout={e => { sc.dayY[i] = e.nativeEvent.layout.y; }}
        style={{ backgroundColor: t.card, borderRadius: 26, padding: 12, marginBottom: 12, opacity: past ? 0.7 : 1, borderWidth: today ? 1.5 : t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: today ? t.acc : t.bord }}>
        <Pressable onPress={() => openCal(dayKey(w, i))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 6 }}>
          <T size={20} w="800">{DAYS[i]}</T>
          <T sub size={15}>{fmt(dsd)}</T>
          {today ? <View style={{ backgroundColor: t.acc, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ color: t.accOn, fontSize: 12, fontWeight: '700' }}>Сегодня</Text></View> : null}
          <View style={{ flex: 1 }} />
          {dayLoad(w, i) > 0 ? <LoadBar h={dayLoad(w, i)} /> : null}
          {list.length ? <T sub size={13}>{list.length} из {LIMIT}</T> : null}
          <ChevR color={t.sub} size={16} />
        </Pressable>
        {!past ? (
          <Pressable onPress={() => openCal(dayKey(w, i))} style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
            <T sub size={13}>{(busyM ? 'Занято ' + durText(busyM) + ' · ' : '') + 'Свободно ' + durText(Math.max(0, span - busyM))}</T>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.seg, marginTop: 5, overflow: 'hidden' }}>
              {ev.map((x, k) => {
                const s0 = Math.max(cfg.s, x.s), e0 = Math.min(cfg.e, x.e); if (e0 <= s0) return null;
                return <View key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(s0 - cfg.s) / span * 100}%`, width: `${(e0 - s0) / span * 100}%`, backgroundColor: x.kind === 'r' ? t.sub : t.acc }} />;
              })}
            </View>
          </Pressable>
        ) : null}
        {regs.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>{regs.map(r => <RegChip key={r.id} r={r} w={w} d={i} />)}</View> : null}
        <View style={{ gap: 8 }}>
          {list.map(x => <TaskTile key={x.id} t={x} noCheck onPress={() => onTaskPress(x)} onLongPress={() => openSheet({ kind: 'task', id: x.id })} />)}
          {free > 0 && !past ? <FreeSlot label={'Свободно · ' + free + ' ' + pl(free, 'место', 'места', 'мест')} onPress={() => openSheet({ kind: 'free', w, d: i })} /> : null}
        </View>
        {dn.length ? (
          <Pressable onPress={() => openScreen('done')} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 40, alignItems: 'center', paddingHorizontal: 6, marginTop: 4 }}>
            <T sub size={14} w="600">Выполнено</T><T sub size={14} w="700">{dn.length} ›</T>
          </Pressable>
        ) : null}
      </View>
    );
  });
  return (
    <View>
      <TopCard />
      {ui.off === 0 ? <WrCard /> : null}
      <FocusLine w={w} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T sub size={14}>Задач <T size={14} w="700">{st.todo}</T> · Сделано <T size={14} w="700">{st.done}</T> · Свободно <T size={14} w="700">{nfree}</T></T>
        <Tools />
      </View>
      {days}
      {ui.off >= 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Input style={{ flex: 1 }} value={txt} onChangeText={setTxt} placeholder={ui.off === 0 ? 'Новая задача на эту неделю' : 'Новая задача: ' + weekRange(w)} returnKeyType="done"
            onSubmitEditing={() => { addToWeek(txt); setTxt(''); }} />
          <Pressable onPress={() => { addToWeek(txt); setTxt(''); }} style={{ width: 50, borderRadius: 14, backgroundColor: t.acc, alignItems: 'center', justifyContent: 'center' }}><Plus color={t.accOn} /></Pressable>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- день по часам ---------- */
const CAL_PX = 76;
function DayView() {
  const t = useT();
  const sd = parseISO(ui.calSel), wk = iso(mondayOf(sd)), di = wdIdx(sd), c = dayCfg(), todayK = iso(new Date()), isT = ui.calSel === todayK;
  const ev: Ev[] = calEvents(sd);
  const n0 = new Date(), nm = isT ? n0.getHours() * 60 + n0.getMinutes() : 0;
  const isPastDay = ui.calSel < todayK;
  const fl = isPastDay ? c.e : isT ? Math.min(c.e, Math.max(c.s, Math.ceil(nm / 5) * 5)) : c.s;
  const phase = (x: Ev) => (isPastDay ? 'past' : !isT ? 'wait' : nm >= x.e ? 'past' : nm >= x.s ? 'now' : 'wait');
  const free = freeFrom(ev, fl, c.e).filter(f => f[1] - f[0] >= 15);
  const pastFree = fl > c.s ? freeFrom(ev, c.s, fl).filter(f => f[1] - f[0] >= 15) : [];
  const busyM = sumIv(busyFrom(ev, c.s, c.e)), freeM = isPastDay ? sumIv(pastFree) : sumIv(free);
  const tasks = todoAt(wk, di);
  const unsched = tasks.filter(x => typeof x.start !== 'number').sort((a, b) => lv(b) - lv(a));
  const untReg = regsAt(di).filter(r => !regRange(r));
  const nDone = doneAt(wk, di).length;
  const ends: number[] = [];
  ev.forEach(x => { let k = 0; while (k < ends.length && ends[k] > x.s) k++; ends[k] = x.e; x.col = k; });
  const nc = Math.max(1, ends.length);
  let lo = Math.floor(c.s / 60) * 60, hi = Math.min(1440, Math.ceil(c.e / 60) * 60);
  ev.forEach(x => { lo = Math.min(lo, Math.floor(x.s / 60) * 60); hi = Math.max(hi, Math.min(1440, Math.ceil(x.e / 60) * 60)); });
  const Y = (m: number) => (m - lo) / 60 * CAL_PX;
  const [wd, setWd] = useState(300);
  const hours: number[] = []; for (let h = lo / 60; h <= hi / 60; h++) hours.push(h);
  const LEFT = 52, area = wd - LEFT;
  return (
    <View>
      <T sub size={14} style={{ marginVertical: 8 }}>
        Занято <T size={14} w="700">{durText(busyM)}</T> · {isPastDay ? 'Свободно было' : isT ? 'Ещё свободно' : 'Свободно'} <T size={14} w="700">{durText(freeM)}</T> · Задач <T size={14} w="700">{tasks.length} из {LIMIT}</T>
      </T>
      {unsched.length || untReg.length ? (
        <Card style={{ marginBottom: 10, padding: 12 }}>
          <T sub size={12.5} w="600" style={{ marginBottom: 6 }}>Без времени</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {unsched.map(x => <Pressable key={x.id} onPress={() => openSheet({ kind: 'task', id: x.id })} style={{ backgroundColor: t.tile, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}><T size={15}>{x.title}</T></Pressable>)}
            {untReg.map(r => <Pressable key={r.id} onPress={() => openSheet({ kind: 'regular', id: r.id })} style={{ backgroundColor: t.accSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: t.acc, fontSize: 15 }}>{r.title}</Text></Pressable>)}
          </View>
        </Card>
      ) : null}
      {unsched.length ? <T sub size={13.5} style={{ marginBottom: 10 }}>{free.length ? 'Нажмите на свободное окно, чтобы поставить задачу на время.' : isPastDay ? 'Этот день уже прошёл.' : isT ? 'Свободных окон на сегодня больше нет.' : 'Свободных окон в этот день нет.'}</T> : null}
      <View onLayout={e => setWd(e.nativeEvent.layout.width)} style={{ height: (hi - lo) / 60 * CAL_PX, marginTop: 6 }}>
        {hours.map(h => (
          <View key={h} style={{ position: 'absolute', top: Y(h * 60), left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: LEFT - 6, color: t.sub, fontSize: 12, fontVariant: ['tabular-nums'], marginTop: -8 }}>{h < 24 ? m2t(h * 60) : ''}</Text>
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />
          </View>
        ))}
        {lo < c.s ? <View style={{ position: 'absolute', left: LEFT, right: 0, top: 0, height: Y(c.s), backgroundColor: t.seg, opacity: 0.5 }} /> : null}
        {hi > c.e ? <View style={{ position: 'absolute', left: LEFT, right: 0, top: Y(c.e), height: Y(hi) - Y(c.e), backgroundColor: t.seg, opacity: 0.5 }} /> : null}
        {[...pastFree.map(f => ({ f, past: true })), ...free.map(f => ({ f, past: false }))].map(({ f, past }, k) => {
          const len = f[1] - f[0], hgt = len / 60 * CAL_PX - 4, big = hgt >= 18;
          return (
            <Pressable key={'fr' + k} disabled={past} onPress={() => openSheet({ kind: 'cp', mode: 'free', a: f[0], b: f[1] })}
              style={{ position: 'absolute', left: LEFT, right: 0, top: Y(f[0]) + 2, height: hgt, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.dash, paddingHorizontal: 12, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, opacity: past ? 0.45 : 1 }}>
              {big ? <><T sub size={14} w="600">{past ? 'Было свободно' : 'Свободно'}</T><T sub size={13}>{durText(len)}</T></> : null}
            </Pressable>
          );
        })}
        {ev.map((x, k) => {
          const top = Y(x.s), hgt = Math.max(24, (x.e - x.s) / 60 * CAL_PX - 2), ph = phase(x);
          const stTxt = ph === 'now' ? ' · идёт сейчас' : ph === 'past' ? (x.kind === 'r' ? ' · завершено' : ' · время прошло') : '';
          const isR = x.kind === 'r';
          return (
            <Pressable key={'ev' + k} onPress={() => (isR ? openSheet({ kind: 'regular', id: x.r!.id }) : openSheet({ kind: 'cp', mode: 'task', id: x.t!.id }))}
              style={{ position: 'absolute', top, height: hgt, left: LEFT + x.col! / nc * area, width: area / nc - 2, borderRadius: 10, padding: 8, backgroundColor: isR ? t.accSoft : t.acc, opacity: ph === 'past' ? 0.5 : 1, overflow: 'hidden' }}>
              <Text numberOfLines={1} style={{ color: isR ? t.acc : t.accOn, fontWeight: '700', fontSize: 14 }}>{isR ? x.r!.title : x.t!.title}</Text>
              {hgt >= 40 ? <Text style={{ color: isR ? t.acc : t.accOn, opacity: 0.8, fontSize: 12.5 }}>{durText(x.e - x.s) + stTxt}</Text> : null}
            </Pressable>
          );
        })}
        {isT && nm >= lo && nm <= hi ? <View style={{ position: 'absolute', left: LEFT - 6, right: 0, top: Y(nm), height: 2, backgroundColor: t.danger }} /> : null}
      </View>
      {nDone ? (
        <Pressable onPress={() => openScreen('done')} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, alignItems: 'center', paddingHorizontal: 6, marginTop: 10 }}>
          <T sub size={15} w="600">Выполнено в этот день</T><T sub size={15} w="700">{nDone} ›</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- месяц ---------- */
function MonthView() {
  const t = useT();
  const ix = calIndex(), c = dayCfg(), first = new Date(ui.calY, ui.calM, 1), off0 = wdIdx(first), dim = new Date(ui.calY, ui.calM + 1, 0).getDate();
  const rows = Math.ceil((off0 + dim) / 7), todayK = iso(new Date());
  const cells = Array.from({ length: rows * 7 }).map((_, i) => {
    const dn = i - off0 + 1;
    if (dn < 1 || dn > dim) return <View key={i} style={{ width: '14.2857%', height: 64 }} />;
    const dt = new Date(ui.calY, ui.calM, dn), k = iso(dt), nt = ix.todo[k] || 0, nd = ix.done[k] || 0;
    const ev = calEvents(dt);
    const pct = ev.length ? Math.max(22, Math.min(100, Math.round(sumIv(busyFrom(ev, c.s, c.e)) / (c.e - c.s) * 100))) : regsAt(wdIdx(dt)).length ? 22 : 0;
    const today = k === todayK;
    return (
      <Pressable key={i} onPress={() => { setSel(k); setPlanView('day'); }} style={{ width: '14.2857%', height: 64, alignItems: 'center', paddingTop: 6 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: today ? t.acc : 'transparent' }}>
          <Text style={{ color: today ? t.accOn : t.ink, fontSize: 16, fontWeight: nt >= LIMIT ? '800' : '500' }}>{dn}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 3 }}>
          {Array.from({ length: Math.min(LIMIT, nt) }).map((_, j) => <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.ink }} />)}
          {nd ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.done }} /> : null}
        </View>
        <View style={{ width: '70%', height: 3, borderRadius: 2, marginTop: 3, backgroundColor: pct ? t.seg : 'transparent', overflow: 'hidden' }}><View style={{ height: '100%', width: `${pct}%`, backgroundColor: t.sub }} /></View>
      </Pressable>
    );
  });
  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>{SHORT.map(s => <T key={s} sub size={12} w="600" style={{ width: '14.2857%', textAlign: 'center' }}>{s}</T>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{cells}</View>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 10 }}>
        <T sub size={13}>● Задачи</T><T sub size={13} style={{ color: t.done }}>● Сделано</T><T sub size={13}>▬ Занято по часам</T>
      </View>
      <T sub size={14} style={{ marginTop: 14, textAlign: 'center' }}>Нажмите на день, чтобы увидеть, что занято и где есть свободные окна.</T>
    </View>
  );
}

export function Plan() {
  return ui.planView === 'day' ? <DayView /> : ui.planView === 'month' ? <MonthView /> : <WeekView />;
}
export { rel };
