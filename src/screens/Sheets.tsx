import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { cancelProp, confirmProp, processVoice, prop, propList, propNewProjects, shuffleProp, voice } from '../core/ai';
import {
  addTaskAt, closeSheet, completeTask, deleteProject, deleteRegular, deleteTask, moveProject, moveToDay, moveToWeek, openSheet,
  pickIntoDay, placeAt, postponeTask, returnTask, saveProject, setLevel, setProject, swapToday,
} from '../core/actions';
import { addWeeks, DAYS, durText, fmt, fmtMins, fmtS, hhmm, iso, m2t, mondayOf, parseISO, pl, realWeek, SHORT, t2m, todayIdx, wdIdx, weekRange, wkOffset } from '../core/dates';
import {
  dayCfg, defRegMins, doneAt, LIMIT, LVL_HINT, LVL_NAMES, levelFromMins, lv, minsIn, minsOf, PALETTE, pickDay, prObj, regSplit, regsOn,
  roomIn, todoAt, unusedColor,
} from '../core/planner';
import { buzz, byId, notify, save, state, toast, ui, uid } from '../core/store';
import { Send } from '../ui/icons';
import { Btn, Chip, DayChips, FieldRow, Input, Label, LvlBars, Sheet, T, TimeField, useT } from '../ui/kit';

/* ---------- помощник ---------- */
function VoiceSheet() {
  const t = useT();
  const onb = state.memory.onb === 'projects';
  return (
    <Sheet onClose={() => { if (!voice.busy) closeSheet(); }} title={voice.busy ? 'Разбираю запись…' : onb ? 'Какие у вас проекты?' : 'Расскажите о дне и планах'}
      sub={voice.busy ? 'Оцениваю сложность задач и распределяю нагрузку по неделе.' : onb ? 'Назовите сферы и проекты, которыми живёте. Можно надиктовать: кнопка микрофона на клавиатуре.' : 'Что сделали, что планируете на эту и следующие недели и что делаете регулярно. Надиктуйте через микрофон на клавиатуре или напишите текстом.'}>
      <Input multiline autoFocus editable={!voice.busy} value={voice.text} onChangeText={v => { voice.text = v; notify(); }}
        placeholder={onb ? 'Работа, учёба, спорт, ремонт…' : 'Сегодня я сделал… На этой неделе планирую… На следующей неделе… Регулярно хожу…'}
        style={{ minHeight: 150, textAlignVertical: 'top' }} />
      {voice.note ? <Text style={{ color: t.warn, fontSize: 14, marginTop: 10 }}>{voice.note}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Btn kind="sec" title="Отмена" disabled={voice.busy} onPress={() => { voice.text = ''; voice.note = ''; closeSheet(); }} style={{ flex: 1 }} />
        {voice.busy ? <View style={{ flex: 1.4, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.acc} /></View>
          : <Btn title="Отправить" onPress={processVoice} style={{ flex: 1.4 }} disabled={!voice.text.trim()} />}
      </View>
    </Sheet>
  );
}

/* ---------- предложение распределения ---------- */
function ProposalSheet() {
  const t = useT();
  if (!prop) return null;
  const p = prop, rw = p.rw;
  const cells: { w: string; d: number }[] = [];
  for (let d = p.ti; d < 7; d++) cells.push({ w: rw, d });
  const extra: Record<string, { w: string; d: number }> = {};
  p.tasks.forEach(x => { if (x.week !== rw) extra[x.week + '|' + x.day] = { w: x.week!, d: x.day! }; });
  Object.keys(extra).sort().forEach(k => cells.push(extra[k]));
  const sel = p.sel ? p.tasks.find(x => x.id === p.sel) || null : null;
  const tapChip = (id: string) => {
    const x = p.tasks.find(y => y.id === id)!;
    if (!sel) p.sel = id;
    else if (sel === x) p.sel = null;
    else if (sel.week === x.week && sel.day === x.day) p.sel = id;
    else { const w0 = sel.week, d0 = sel.day; sel.week = x.week; sel.day = x.day; x.week = w0; x.day = d0; sel.pin = x.pin = true; p.sel = null; buzz(); }
    notify();
  };
  const tapDay = (w: string, d: number) => {
    if (!sel) return;
    if (sel.week === w && sel.day === d) { p.sel = null; notify(); return; }
    if (!roomIn(propList(w, d, sel), lv(sel))) { toast('Нет места (3 задачи, одна сложная) — нажмите на задачу в этом дне, чтобы поменять местами'); buzz('warn'); return; }
    sel.week = w; sel.day = d; sel.pin = true; p.sel = null; buzz(); notify();
  };
  const bits: string[] = [];
  const fut = p.plan.filter(x => x.wk > 0).length;
  if (fut) bits.push('На будущие недели: ' + fut);
  if (p.shifted) bits.push('Не хватило места: ' + p.shifted + ' ' + pl(p.shifted, 'задача перенесена', 'задачи перенесены', 'задач перенесено') + ' дальше (сложные — на выходные)');
  if (p.done.length) bits.push('Сделано сегодня: ' + p.done.length);
  const npn = propNewProjects();
  if (npn.length) bits.push('Новые папки проектов: ' + npn.join(', '));
  if (p.regular.length) bits.push('Регулярное: ' + p.regular.map(r => r.title).join(', '));
  return (
    <Sheet full onClose={cancelProp} title="Так распределить неделю?"
      sub={sel ? 'Можно переименовать задачу. Нажмите на день, чтобы перенести, или на другую задачу, чтобы поменять местами.' : 'Сложные — на выходные, средние и лёгкие — по будням. Нажмите на задачу, чтобы переименовать, перенести на другой день или поменять местами.'}>
      {sel ? (
        <View style={{ marginBottom: 12 }}>
          <Label>Название задачи</Label>
          <Input defaultValue={sel.title} key={sel.id} onChangeText={v => { const s = v.replace(/\s+/g, ' ').trim().slice(0, 120); if (s) { sel.title = s; if (sel.pk != null && p.plan[sel.pk]) p.plan[sel.pk].title = s; } }} onEndEditing={notify} />
          <Label style={{ marginTop: 12 }}>Перенести на неделю</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[0, 1, 2, 3, 4, 5].map(k => {
              const w = addWeeks(rw, k);
              return <Chip key={w} label={k === 0 ? 'Эта' : k === 1 ? 'След.' : fmtS(parseISO(w))} on={sel.week === w} onPress={() => {
                const d = pickDay(w, sel, (ww, dd) => propList(ww, dd, sel));
                if (d < 0) { toast('На этой неделе нет места'); buzz('warn'); return; }
                sel.week = w; sel.day = d; sel.pin = true; p.sel = null; buzz(); notify();
              }} />;
            })}
          </View>
        </View>
      ) : null}
      {cells.map(c => {
        const mine = p.tasks.filter(x => x.week === c.w && x.day === c.d).sort((a, b) => lv(b) - lv(a));
        const ex = todoAt(c.w, c.d), dt = parseISO(c.w); dt.setDate(dt.getDate() + c.d);
        const can = !!sel && !(sel.week === c.w && sel.day === c.d) && roomIn(propList(c.w, c.d, sel), lv(sel));
        return (
          <Pressable key={c.w + c.d} onPress={() => tapDay(c.w, c.d)} style={{ backgroundColor: t.card, borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: can ? t.acc : 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <T w="700">{SHORT[c.d]}</T>
              <T sub size={14}>{fmt(dt)}{c.w !== rw ? ', ' + (wkOffset(c.w) === 1 ? 'след. неделя' : 'через ' + wkOffset(c.w) + ' нед.') : ''}</T>
              <View style={{ flex: 1 }} />
              <T sub size={13}>{ex.length + mine.length} из {LIMIT}</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ex.map(x => <View key={x.id} style={{ backgroundColor: t.tile, borderRadius: 14, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', opacity: 0.5 }}><T size={15}>{x.title}</T></View>)}
              {mine.map(x => {
                const pr = prObj(x.project);
                return (
                  <Pressable key={x.id} onPress={() => tapChip(x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.sel === x.id ? t.accSoft : t.tile, borderWidth: 2, borderColor: p.sel === x.id ? t.acc : 'transparent', borderRadius: 14, paddingHorizontal: 12, minHeight: 44, maxWidth: '100%' }}>
                    <LvlBars level={lv(x)} />
                    <T size={16} w="500" style={{ flexShrink: 1 }}>{x.title}</T>
                    {pr ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: pr.color }} /> : null}
                    <T sub size={13}>~{fmtMins(minsOf(x))}</T>
                  </Pressable>
                );
              })}
              {!ex.length && !mine.length ? <T sub size={14} style={{ paddingVertical: 10 }}>Свободно</T> : null}
            </View>
          </Pressable>
        );
      })}
      {bits.length ? <T sub size={14} style={{ marginVertical: 6 }}>{bits.join('. ')}</T> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Btn kind="sec" title="Перемешать" onPress={shuffleProp} style={{ flex: 1 }} />
        <Btn title="Ок" onPress={confirmProp} style={{ flex: 1.5 }} />
      </View>
      <Btn kind="sec" title="Отмена" onPress={cancelProp} style={{ marginTop: 10 }} />
    </Sheet>
  );
}

/* ---------- задача ---------- */
function TaskSheet({ id }: { id: string }) {
  const t = useT();
  const task = byId(id);
  const title = useRef(task?.title || '');
  const [sub, setSub] = useState('');
  useEffect(() => { if (!task) closeSheet(); }, [task]);
  if (!task) return null;
  const commit = () => { const v = title.current.trim(); if (v && v !== task.title) { task.title = v.slice(0, 120); save(); } };
  const addSub = () => { const v = sub.trim().slice(0, 120); if (!v) return; (task.subs = task.subs || []).push({ id: uid(), t: v, d: false }); setSub(''); save(); buzz(); };
  const close = () => { if (sub.trim()) addSub(); commit(); closeSheet(); };
  const todo = task.status === 'todo';
  const tDate = (i: number) => { const d = parseISO(task.week!); d.setDate(d.getDate() + i); return d; };
  const rw = realWeek(), weeks = [0, 1, 2, 3, 4, 5].map(k => addWeeks(rw, k));
  if (todo && task.week && weeks.indexOf(task.week) < 0) weeks.push(task.week);
  return (
    <Sheet onClose={close}>
      <T sub size={15} style={{ marginBottom: 10 }}>
        {todo ? 'Запланировано: ' + DAYS[task.day!].toLowerCase() + ', ' + fmt(tDate(task.day!)) + (task.moves ? '. Перенесена: ' + task.moves + ' ' + pl(task.moves, 'раз', 'раза', 'раз') : '')
          : 'Выполнено: ' + DAYS[task.doneDay!].toLowerCase() + ', ' + hhmm(task.doneTs || Date.now())}
      </T>
      <Input defaultValue={task.title} onChangeText={v => { title.current = v; }} onEndEditing={commit} returnKeyType="done" style={{ fontSize: 19, fontWeight: '600', marginBottom: 16 }} />
      {state.projects.length ? (
        <>
          <Label>Проект</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {state.projects.map(p => <Chip key={p.id} label={p.name} dot={p.color} on={task.project === p.id} onPress={() => setProject(task, p.id)} />)}
            <Chip label="Без проекта" on={!task.project} onPress={() => setProject(task, null)} />
          </View>
        </>
      ) : null}
      {todo && task.week ? (
        <>
          <Label>Неделя</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {weeks.map(w => {
              const k = wkOffset(w), n = state.tasks.filter(x => x.status === 'todo' && x.week === w).length;
              return <Chip key={w} label={k === 0 ? 'Эта' : k === 1 ? 'След.' : fmtS(parseISO(w))} sub={n + ' ' + pl(n, 'задача', 'задачи', 'задач')} on={task.week === w} onPress={() => moveToWeek(task, w)} />;
            })}
          </View>
        </>
      ) : null}
      <View style={{ gap: 6, marginBottom: 8 }}>
        {(task.subs || []).map(s => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.tile, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 }}>
            <Pressable hitSlop={8} onPress={() => { s.d = !s.d; save(); buzz(); }} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: s.d ? t.acc : t.sub, backgroundColor: s.d ? t.acc : 'transparent' }} />
            <T size={16} style={{ flex: 1, textDecorationLine: s.d ? 'line-through' : 'none', color: s.d ? t.sub : t.ink }}>{s.t}</T>
            <Pressable hitSlop={8} onPress={() => { task.subs = (task.subs || []).filter(x => x.id !== s.id); if (!task.subs.length) delete task.subs; save(); }}><T sub size={22}>×</T></Pressable>
          </View>
        ))}
      </View>
      <Input value={sub} onChangeText={setSub} placeholder="Новая подзадача" returnKeyType="done" onSubmitEditing={addSub} blurOnSubmit={false} style={{ marginBottom: 8 }} />
      <Input defaultValue={task.note || ''} multiline placeholder="Заметка к задаче" style={{ minHeight: 70, textAlignVertical: 'top', marginBottom: 16 }}
        onChangeText={v => { const s = v.slice(0, 1000); if (s.trim()) task.note = s; else delete task.note; save(); }} />
      {todo ? (
        <>
          <Label>Сложность</Label>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
            {[1, 2, 3].map(n => {
              const on = lv(task) === n;
              return (
                <Pressable key={n} onPress={() => setLevel(task, n)} style={{ flex: 1, minHeight: 54, borderRadius: 13, backgroundColor: on ? t.acc : t.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <LvlBars level={n} />
                  <View><Text style={{ color: on ? t.accOn : t.ink, fontWeight: '600', fontSize: 15 }}>{LVL_NAMES[n]}</Text><Text style={{ color: on ? t.accOn : t.sub, fontSize: 11.5, opacity: 0.75 }}>{LVL_HINT[n]}</Text></View>
                </Pressable>
              );
            })}
          </View>
          <Label>Перенести на день</Label>
          <View style={{ marginBottom: 18 }}>
            <DayChips days={SHORT} isOn={i => i === task.day} isFull={i => i !== task.day && !roomIn(todoAt(task.week!, i, task.id), lv(task))} sub={i => String(tDate(i).getDate())} onPress={i => moveToDay(task, i)} />
          </View>
        </>
      ) : null}
      <View style={{ gap: 10 }}>
        <Btn title={todo ? 'Выполнено' : 'Вернуть в «Сделать»'} onPress={() => { commit(); closeSheet(); if (todo) completeTask(task); else returnTask(task); }} />
        {todo ? <Btn kind="sec" title="След. слот" onPress={() => { commit(); closeSheet(); postponeTask(task); }} /> : null}
        <Btn kind="dng" title="Удалить" onPress={() => { closeSheet(); deleteTask(task); }} />
      </View>
    </Sheet>
  );
}

/* ---------- замена с сегодняшним днём ---------- */
function Pick({ title, sub, onPress, off }: { title: string; sub?: string; onPress: () => void; off?: boolean }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 16, backgroundColor: t.card, marginBottom: 8, opacity: off ? 0.4 : 1 }}>
      <T style={{ flex: 1 }} w="500">{title}</T>{sub ? <T sub size={14}>{sub}</T> : null}
    </Pressable>
  );
}
function SwapSheet({ id }: { id: string }) {
  const task = byId(id);
  if (!task) return null;
  const tw = realWeek(), ti = todayIdx(), here = todoAt(tw, ti), free = LIMIT - here.length - doneAt(tw, ti).length;
  const go = (k: string) => { if (swapToday(task, k)) closeSheet(); };
  return (
    <Sheet onClose={closeSheet} title={'На сегодня: ' + task.title}>
      {free > 0 && roomIn(here, lv(task)) ? <Pick title="Свободное место" sub="без замены" onPress={() => go('free')} /> : null}
      {here.map(x => <Pick key={x.id} title={x.title} sub={'→ ' + SHORT[task.day!]} onPress={() => go(x.id)} />)}
      {!here.length && !(free > 0) ? <T sub>На сегодня нет места и нечего менять</T> : null}
      <Pick title="Открыть задачу: неделя, проект, заметки" onPress={() => openSheet({ kind: 'task', id: task.id })} />
    </Sheet>
  );
}

/* ---------- «Свободно»: новая задача или перенос из недели ---------- */
function FreeSheet({ w, d }: { w: string; d: number }) {
  const t = useT();
  const [v, setV] = useState('');
  const here = todoAt(w, d);
  const cand = state.tasks.filter(x => x.status === 'todo' && x.week === w && x.day !== d).sort((a, b) => (a.day === b.day ? lv(b) - lv(a) : a.day! - b.day!));
  const add = () => { if (addTaskAt(v, w, d)) closeSheet(); };
  return (
    <Sheet onClose={closeSheet} title={DAYS[d] + ': свободное место'}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Input autoFocus style={{ flex: 1 }} value={v} onChangeText={setV} placeholder="Новая задача" returnKeyType="done" onSubmitEditing={add} />
        <Pressable onPress={add} style={{ width: 50, borderRadius: 14, backgroundColor: t.acc, alignItems: 'center', justifyContent: 'center' }}><Send color={t.accOn} /></Pressable>
      </View>
      {cand.length ? <Label>Или перенести из недели</Label> : null}
      {cand.map(x => <Pick key={x.id} title={x.title} sub={SHORT[x.day!]} off={!roomIn(here, lv(x))} onPress={() => { if (pickIntoDay(x, w, d)) closeSheet(); }} />)}
    </Sheet>
  );
}

/* ---------- проект ---------- */
function EditProjectSheet({ id }: { id: string | null }) {
  const t = useT();
  const p = id ? prObj(id) : null;
  const [name, setName] = useState(p ? p.name : '');
  const [color, setColor] = useState(p ? p.color : unusedColor());
  const [arm, setArm] = useState(false);
  const ok = () => { if (saveProject(id, name, color)) closeSheet(); };
  return (
    <Sheet onClose={closeSheet} title={p ? 'Изменить проект' : 'Новый проект'}>
      <Input autoFocus={!p} value={name} onChangeText={setName} maxLength={28} placeholder="Название: Работа, Учёба, Здоровье" returnKeyType="done" onSubmitEditing={ok} style={{ fontSize: 19, fontWeight: '600', marginBottom: 16 }} />
      {p ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Btn small kind="sec" title="Выше в списке" onPress={() => { moveProject(p.id, -1); toast('Порядок изменён'); }} style={{ flex: 1 }} />
          <Btn small kind="sec" title="Ниже в списке" onPress={() => { moveProject(p.id, 1); toast('Порядок изменён'); }} style={{ flex: 1 }} />
        </View>
      ) : null}
      <Label>Цвет</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18, padding: 4 }}>
        {PALETTE.map(c => <Pressable key={c} onPress={() => setColor(c)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: t.ink }} />)}
      </View>
      <View style={{ gap: 10 }}>
        <Btn title={p ? 'Сохранить' : 'Создать'} onPress={ok} />
        {p ? <Btn kind="dng" title={arm ? 'Точно удалить? Задачи останутся без проекта' : 'Удалить проект'} onPress={() => { if (!arm) { setArm(true); return; } closeSheet(); deleteProject(p.id); }} /> : null}
      </View>
    </Sheet>
  );
}

/* ---------- регулярное дело ---------- */
const RG_DUR = [15, 30, 45, 60, 90, 120, 180], RG_REM: (number | null)[] = [null, 0, 10, 30, 60];
function RegularSheet({ id }: { id: string | null }) {
  const th = useT();
  const r = id ? state.regulars.find(x => x.id === id) : null;
  const [title, setTitle] = useState(r ? r.title : '');
  const [days, setDays] = useState<number[]>(r ? r.days.slice() : [0, 1, 2, 3, 4]);
  const [time, setTime] = useState<number | null>(r && r.time ? t2m(r.time) : null);
  const [mins, setMins] = useState(r ? r.mins || defRegMins(r.level || 2) : 60);
  const [rem, setRem] = useState<number | null>(r ? r.rem : null);
  const [custom, setCustom] = useState(RG_DUR.indexOf(mins) < 0 ? String(mins) : '');
  const durs = RG_DUR.indexOf(mins) < 0 ? [...RG_DUR, mins].sort((a, b) => a - b) : RG_DUR;
  const end = time == null ? null : Math.min(1440, time + mins);
  const setT = (m: number | null) => { setTime(m); if (m == null) setRem(null); else if (rem == null && !r) setRem(10); };
  const ok = () => {
    let ttl = title.trim().slice(0, 60), tm = time;
    if (!ttl) { toast('Введите название'); return; }
    if (!days.length) { toast('Выберите хотя бы один день'); return; }
    const sp = regSplit(ttl);
    let rm = rem;
    if (sp.time) { ttl = sp.title; if (tm == null) { tm = t2m(sp.time); if (rm == null && !r) rm = 10; } }
    if (state.regulars.some(x => x.id !== id && x.title.toLowerCase() === ttl.toLowerCase())) { toast('Такое дело уже есть'); return; }
    const o = { title: ttl, days: days.slice().sort(), time: tm == null ? null : m2t(tm), mins, level: levelFromMins(mins), rem: tm == null ? null : rm };
    if (r) Object.assign(r, o); else state.regulars.push({ id: uid(), ...o });
    save(); closeSheet(); buzz();
    toast(r ? 'Сохранено' : 'Добавлено: «' + ttl + '»');
  };
  return (
    <Sheet onClose={closeSheet} title={r ? 'Изменить дело' : 'Новое регулярное дело'}>
      <Input value={title} onChangeText={setTitle} maxLength={60} placeholder="Название, например «Зал»" style={{ fontSize: 18, fontWeight: '600', marginBottom: 14 }} />
      <Label>Дни</Label>
      <DayChips days={SHORT} isOn={i => days.indexOf(i) >= 0} onPress={i => setDays(days.indexOf(i) >= 0 ? days.filter(x => x !== i) : [...days, i].sort())} />
      <FieldRow label="Начало"><TimeField value={time} onChange={setT} /></FieldRow>
      <FieldRow label="Конец"><TimeField value={end == null ? null : end === 1440 ? 1439 : end} onChange={m => {
        if (time == null) { toast('Сначала укажите время начала'); return; }
        if (m == null || m <= time) { toast('Конец должен быть позже начала'); return; }
        setMins(Math.max(5, Math.min(720, m - time))); setCustom('');
      }} /></FieldRow>
      <T sub size={14} style={{ marginVertical: 10 }}>{time != null ? 'Занято с ' + m2t(time) + ' до ' + m2t(end!) + ' · ' + durText(mins) : 'Укажите время начала, чтобы увидеть, с какого по какое занято: ' + durText(mins)}</T>
      <Label>Сколько занимает</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{durs.map(m => <Chip key={m} label={fmtMins(m)} on={mins === m} onPress={() => { setMins(m); setCustom(''); }} />)}</View>
      <FieldRow label="Своё время, минут">
        <TextInput value={custom} onChangeText={v => { setCustom(v); const m = minsIn(v); if (m) setMins(m); }} keyboardType="number-pad" placeholder="например 100"
          style={{ minWidth: 120, textAlign: 'center', fontSize: 17, color: th.ink, backgroundColor: th.seg, borderRadius: 10, minHeight: 40 }} placeholderTextColor={th.sub} />
      </FieldRow>
      <Label style={{ marginTop: 14 }}>Напоминание</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RG_REM.map(m => <Chip key={String(m)} dim={time == null} label={m == null ? 'Нет' : m === 0 ? 'В начале' : 'За ' + m + ' мин'} on={rem === m} onPress={() => { if (time == null) { toast('Сначала укажите время начала'); return; } setRem(m); }} />)}
      </View>
      <T sub size={13} style={{ marginTop: 8 }}>{time == null ? 'Чтобы получать напоминание, укажите время начала.' : regsOn() ? '' : 'Напоминания о регулярных делах выключены в настройках.'}</T>
      <View style={{ gap: 10, marginTop: 18 }}>
        <Btn title="Сохранить" onPress={ok} />
        {r ? <Btn kind="dng" title="Удалить" onPress={() => { closeSheet(); deleteRegular(r.id); }} /> : null}
      </View>
    </Sheet>
  );
}

/* ---------- окно в календаре ---------- */
const CP_DUR = [15, 30, 45, 60, 90, 120, 180];
function CpFreeSheet({ a, b }: { a: number; b: number }) {
  const th = useT();
  const sd = parseISO(ui.calSel), wk = iso(mondayOf(sd)), di = wdIdx(sd);
  const [v, setV] = useState('');
  const [start, setStart] = useState<number>(a);
  const [mins, setMins] = useState(Math.max(15, Math.min(120, Math.floor((b - a) / 15) * 15 || 15)));
  const un = todoAt(wk, di).filter(x => typeof x.start !== 'number');
  const durs = CP_DUR.indexOf(mins) < 0 ? [...CP_DUR, mins].sort((x, y) => x - y) : CP_DUR;
  const add = () => {
    const tk = addTaskAt(v, wk, di, { level: levelFromMins(mins), mins });
    if (tk) { closeSheet(); placeAt(tk, start); }
  };
  return (
    <Sheet onClose={closeSheet} title="Поставить в свободное окно" sub={m2t(a) + '–' + m2t(b) + ' · ' + durText(b - a) + ' свободно'}>
      {todoAt(wk, di).length < LIMIT ? (
        <>
          <Label>Новая задача</Label>
          <Input value={v} onChangeText={setV} placeholder="Что нужно сделать?" returnKeyType="done" onSubmitEditing={add} />
          <FieldRow label="Начало"><TimeField value={start} onChange={m => setStart(m == null ? a : m)} /></FieldRow>
          <Label style={{ marginTop: 12 }}>Сколько займёт</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{durs.map(m => <Chip key={m} label={fmtMins(m)} on={mins === m} onPress={() => setMins(m)} />)}</View>
          {start + mins > b ? <T size={14} style={{ marginTop: 10, color: th.warn }}>Задача выйдет за свободное окно (оно заканчивается в {m2t(b)}).</T> : null}
          <Btn title={'Добавить в расписание · ' + m2t(start) + '–' + m2t(Math.min(1440, start + mins))} disabled={!v.trim()} onPress={add} style={{ marginTop: 14 }} />
        </>
      ) : (
        <>
          <FieldRow label="Начало"><TimeField value={start} onChange={m => setStart(m == null ? a : m)} /></FieldRow>
          <T sub style={{ marginTop: 10 }}>В этот день уже {LIMIT} задачи, новую добавить нельзя.</T>
        </>
      )}
      {un.length ? <Label style={{ marginTop: 18 }}>Или поставьте задачу дня</Label> : null}
      {un.map(x => <Pick key={x.id} title={x.title} sub={'~' + fmtMins(minsOf(x)) + ' · на ' + m2t(start)} onPress={() => { closeSheet(); placeAt(x, start); }} />)}
    </Sheet>
  );
}
function CpTaskSheet({ id }: { id: string }) {
  const task = byId(id);
  const [start, setStart] = useState<number | null>(task && typeof task.start === 'number' ? task.start : null);
  if (!task) return null;
  const s0 = typeof task.start === 'number' ? task.start : 0;
  return (
    <Sheet onClose={closeSheet} title={task.title} sub={'Сейчас ' + m2t(s0) + '–' + m2t(Math.min(1440, s0 + minsOf(task))) + ' · ' + durText(minsOf(task))}>
      <FieldRow label="Начало"><TimeField value={start} onChange={setStart} /></FieldRow>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Btn title="Сохранить время" onPress={() => { if (start == null) { toast('Укажите время начала'); return; } closeSheet(); placeAt(task, start); }} />
        <Btn kind="sec" title="Открыть задачу" onPress={() => openSheet({ kind: 'task', id: task.id })} />
        <Btn kind="dng" title="Убрать из расписания" onPress={() => { delete task.start; closeSheet(); save(); toast('Время убрано'); }} />
      </View>
    </Sheet>
  );
}

/* ---------- часы дня ---------- */
function HoursSheet() {
  const c = dayCfg();
  const set = (s: number, e: number) => {
    if (e <= s) { toast('Конец дня должен быть позже начала'); notify(); return; }
    state.dayStart = s; state.dayEnd = e; save();
  };
  return (
    <Sheet onClose={closeSheet} title="Часы дня">
      <FieldRow label="Начало дня"><TimeField value={c.s} onChange={m => m != null && set(m, c.e)} /></FieldRow>
      <FieldRow label="Конец дня"><TimeField value={c.e} onChange={m => m != null && set(c.s, m)} /></FieldRow>
      <T sub size={13} style={{ marginTop: 12 }}>Тонкая линия поверх круга прогресса заполняется от начала до конца дня. Календарь по часам показывает свободные окна в эти часы.</T>
    </Sheet>
  );
}

export function Sheets() {
  const s = ui.sheet;
  if (!s) return null;
  switch (s.kind) {
    case 'voice': return <VoiceSheet />;
    case 'proposal': return <ProposalSheet />;
    case 'task': return <TaskSheet key={s.id} id={s.id} />;
    case 'swap': return <SwapSheet id={s.id} />;
    case 'free': return <FreeSheet w={s.w} d={s.d} />;
    case 'editProject': return <EditProjectSheet id={s.id} />;
    case 'regular': return <RegularSheet key={s.id || 'new'} id={s.id} />;
    case 'cp': return s.mode === 'free' ? <CpFreeSheet a={s.a} b={s.b} /> : <CpTaskSheet id={s.id} />;
    case 'hours': return <HoursSheet />;
  }
}
export { weekRange };
