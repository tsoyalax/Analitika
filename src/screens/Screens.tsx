import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import {
  addBacklog, backupText, carryOver, closeScreen, createProject, deleteAllTasks, deleteRegular, deleteBacklog, moveProject, openCal, openScreen,
  openSheet, pdDate, resetAll, restoreBackup, scheduleBacklog, toggleWeekClosed, wmeta,
} from '../core/actions';
import { addWeeks, daysLabel, durText, fmtMins, fmtS, m2t, parseISO, pl, realWeek, SHORT, t2m, todayIdx, weekRange } from '../core/dates';
import { NF, nfGet, nfMessage, nfSet, showBanner } from '../core/reminders';
import {
  carryList, dayCfg, defRegMins, doneAt, LIMIT, MAXPRJ, prCounts, prObj, QUICK, regsOn, streaks, weekReport, weekStats,
} from '../core/planner';
import { buzz, notify, save, saveApiKey, state, Task, toast, ui } from '../core/store';
import {
  Bell, Cal, Chart, Clock, Data, Done, Down, Folder, FolderFill, Help, Key, Palette, Repeat, Reorder, Search, Spark, Up,
} from '../ui/icons';
import { Btn, Card, Chip, Empty, HeaderBtn, Input, Label, LinkRow, Screen, Seg, SwipeRow, T, TimeField, useT } from '../ui/kit';
import { PALS } from '../ui/theme';
import { regSpan, TaskTile } from '../ui/tiles';

/* ---------- настройки ---------- */
function Ic({ c, children }: { c: string; children: (color: string) => React.ReactNode }) {
  return <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>{children('#fff')}</View>;
}
function H({ children }: { children: React.ReactNode }) { return <T size={18} w="700" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>{children}</T>; }
function SwRow({ title, sub, value, onChange, extra }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
      <View style={{ flex: 1 }}><T w="600">{title}</T>{sub ? <T sub size={13.5}>{sub}</T> : null}</View>
      {extra}
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.acc }} />
    </View>
  );
}

function SettingsRoot() {
  const t = useT();
  const [q, setQ] = useState('');
  const st = weekStats(realWeek()), dc = dayCfg(), np = state.projects.length, nr = state.regulars.length;
  const nf = (['morning', 'evening', 'week'] as const).filter(k => nfGet(k).on);
  const th = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' }[state.settings.theme || 'dark'];
  const pal = PALS.find(p => p.id === (state.settings.pal || 'mono'));
  const go = (p: string) => { ui.stPage = p; notify(); };
  const qq = q.trim().toLowerCase();
  const found = qq ? state.tasks.filter(x => (x.title + ' ' + (x.note || '') + ' ' + (x.subs || []).map(s => s.t).join(' ')).toLowerCase().indexOf(qq) >= 0).slice(0, 60) : [];
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.seg, borderRadius: 14, paddingHorizontal: 12, marginBottom: 8 }}>
        <Search color={t.sub} size={20} />
        <Input value={q} onChangeText={setQ} placeholder="Поиск по задачам" style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
      </View>
      {qq ? (
        found.length ? found.map(x => (
          <Pressable key={x.id} onPress={() => openSheet({ kind: 'task', id: x.id })} style={{ backgroundColor: t.card, borderRadius: 16, padding: 14, marginBottom: 6 }}>
            <T w="500" style={x.status === 'done' ? { textDecorationLine: 'line-through', color: t.sub } : undefined}>{x.title}</T>
            <T sub size={13}>{x.status === 'done' ? 'Сделано' : x.week ? pdDate(x) : 'Без даты'}</T>
          </Pressable>
        )) : <Empty>Ничего не найдено</Empty>
      ) : (
        <>
          <LinkRow icon={<Ic c="#8e8e93">{c => <Key color={c} size={22} />}</Ic>} title="Помощник" sub={ui.apiKey ? 'Ключ Claude API добавлен' : 'Добавьте ключ Claude API'} onPress={() => go('assistant')} />
          <H>Планирование</H>
          <LinkRow icon={<Ic c="#e5483a">{c => <Cal color={c} />}</Ic>} title="Календарь" sub="Задачи, занятое и свободное время" onPress={() => openCal()} />
          <LinkRow icon={<Ic c="#3fb35a">{c => <Done color={c} />}</Ic>} title="Выполненное" sub={'Сегодня ' + doneAt(realWeek(), todayIdx()).length + ', за неделю ' + st.done} onPress={() => openScreen('done')} />
          <LinkRow icon={<Ic c="#5a4ee0">{c => <FolderFill color={c} />}</Ic>} title="Проекты" sub={np ? np + ' ' + pl(np, 'проект', 'проекта', 'проектов') : 'Пока нет проектов'} onPress={() => openScreen('projects')} />
          <LinkRow icon={<Ic c="#25a99b">{c => <Repeat color={c} size={20} />}</Ic>} title="Регулярные дела" sub={nr ? nr + ' ' + pl(nr, 'дело', 'дела', 'дел') : 'Пока нет'} onPress={() => openScreen('regulars')} />
          <LinkRow icon={<Ic c="#2f86e8">{c => <Chart color={c} />}</Ic>} title="Итоги недели" sub={'Эта неделя: ' + st.done + ' из ' + st.total} onPress={() => { ui.wrW = null; openScreen('review'); }} />
          <LinkRow icon={<Ic c="#f08a00">{c => <Clock color={c} />}</Ic>} title="Часы дня" sub={m2t(dc.s) + ' – ' + m2t(dc.e)} onPress={() => openSheet({ kind: 'hours' })} />
          <H>Приложение</H>
          <LinkRow icon={<Ic c="#e5483a">{c => <Bell color={c} />}</Ic>} title="Напоминания" sub={nf.length ? nf.map(k => NF[k].title + ' ' + nfGet(k).t).join(', ') : 'Выключены'} onPress={() => go('notify')} />
          <LinkRow icon={<Ic c="#7a52e0">{c => <Palette color={c} />}</Ic>} title="Оформление" sub={th + (pal ? ' · ' + pal.name : '')} onPress={() => go('look')} />
          <LinkRow icon={<Ic c="#e0356f">{c => <Spark color={c} />}</Ic>} title="Отклик" sub={state.settings.haptics === false || state.settings.confetti === false ? 'Часть выключена' : 'Вибрация, конфетти'} onPress={() => go('feedback')} />
          <H>Данные</H>
          <LinkRow icon={<Ic c="#2f86e8">{c => <Data color={c} />}</Ic>} title="Резервная копия и данные" sub="Копия, восстановление, очистка" onPress={() => go('data')} />
          <LinkRow icon={<Ic c="#76767e">{c => <Help color={c} />}</Ic>} title="Подсказки" sub="Жесты, сложность, нагрузка" onPress={() => go('help')} />
        </>
      )}
    </>
  );
}
function AssistantPage() {
  const [k, setK] = useState(ui.apiKey);
  return (
    <>
      <Card>
        <T w="700">Ключ Claude API</T>
        <T sub size={14} style={{ marginVertical: 8 }}>Помощник разбирает ваш рассказ о дне через Claude (модель Claude Opus 5.5). Ключ хранится только на этом устройстве и не попадает в резервную копию.</T>
        <Input value={k} onChangeText={setK} placeholder="sk-ant-..." autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Btn small kind="sec" title="Вставить" onPress={async () => setK((await Clipboard.getStringAsync()).trim())} style={{ flex: 1 }} />
          <Btn small title="Сохранить" onPress={() => { saveApiKey(k); toast(k.trim() ? 'Ключ сохранён' : 'Ключ удалён'); }} style={{ flex: 1 }} />
        </View>
      </Card>
      <T sub size={14} style={{ margin: 6 }}>Ключ можно создать в консоли Anthropic (platform.claude.com). Для речи используйте кнопку микрофона на системной клавиатуре — текст попадёт в поле помощника.</T>
    </>
  );
}
function NotifyPage() {
  const [, force] = useState(0);
  const upd = () => force(x => x + 1);
  return (
    <>
      <Card>
        {(['morning', 'evening', 'week'] as const).map(k => (
          <SwRow key={k} title={NF[k].title} sub={NF[k].sub} value={nfGet(k).on} onChange={v => { nfSet(k, { on: v }); upd(); }}
            extra={<TimeField value={t2m(nfGet(k).t)} onChange={m => { if (m != null) { nfSet(k, { t: m2t(m) }); upd(); } }} />} />
        ))}
        <SwRow title="Регулярные дела" sub="Напоминание перед началом, время задаётся у каждого дела" value={regsOn()} onChange={v => { nfSet('regs', { on: v }); upd(); }} />
      </Card>
      <Btn kind="sec" title="Проверить" onPress={() => showBanner('morning', nfMessage('morning'))} style={{ marginTop: 12 }} />
      <T sub size={14} style={{ margin: 6, marginTop: 12 }}>Напоминания приходят, пока приложение открыто: баннером сверху. Если вы открыли приложение позже назначенного времени, напоминание покажется один раз.</T>
    </>
  );
}
function LookPage() {
  const t = useT();
  return (
    <Card>
      <Label>Тема</Label>
      <Seg items={[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']]} value={state.settings.theme || 'dark'} onChange={v => { state.settings.theme = v as 'auto'; save(); buzz(); }} />
      <Label style={{ marginTop: 18 }}>Расцветка</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {PALS.map(p => {
          const on = (state.settings.pal || 'mono') === p.id;
          return (
            <Pressable key={p.id} onPress={() => { state.settings.pal = p.id; save(); buzz(); }} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.l ? (t.dark ? p.d![0] : p.l[0]) : t.ink, borderWidth: on ? 3 : 0, borderColor: t.sub }} />
              <T sub size={11.5}>{p.name}</T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
function FeedbackPage() {
  const [, force] = useState(0);
  const set = (k: 'haptics' | 'confetti', v: boolean) => { state.settings[k] = v; save(); force(x => x + 1); if (v) buzz(); };
  return (
    <Card>
      <SwRow title="Вибрация" sub="Короткий отклик на действия" value={state.settings.haptics !== false} onChange={v => set('haptics', v)} />
      <SwRow title="Конфетти" sub="Анимация при выполнении задач" value={state.settings.confetti !== false} onChange={v => set('confetti', v)} />
    </Card>
  );
}
function DataPage() {
  const [txt, setTxt] = useState('');
  const [arm, setArm] = useState('');
  const nd = state.tasks.filter(x => x.status === 'done').length, nt = state.tasks.length - nd;
  return (
    <>
      <Card>
        <T w="700">Резервная копия</T>
        <T sub size={14} style={{ marginVertical: 8 }}>Копия включает задачи, проекты, регулярные дела, заметки, итоги недель и настройки. Сохраните её через «Поделиться» (в Файлы, заметки, почту) или скопируйте текст. Для восстановления вставьте текст сюда.</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn small kind="sec" title="Поделиться" style={{ flex: 1 }} onPress={() => Share.share({ title: 'oneday-backup.json', message: backupText() }).catch(() => {})} />
          <Btn small kind="sec" title="Скопировать" style={{ flex: 1 }} onPress={async () => { await Clipboard.setStringAsync(backupText()); toast('Копия скопирована'); }} />
        </View>
        <Input value={txt} onChangeText={setTxt} multiline placeholder="Текст копии для восстановления" autoCapitalize="none" autoCorrect={false} style={{ minHeight: 90, marginTop: 12, fontSize: 13, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Btn small kind="sec" title="Вставить" style={{ flex: 1 }} onPress={async () => setTxt(await Clipboard.getStringAsync())} />
          <Btn small kind="sec" title="Восстановить" style={{ flex: 1 }} onPress={() => { if (restoreBackup(txt)) setTxt(''); }} />
        </View>
      </Card>
      <H>Очистка</H>
      <View style={{ gap: 10 }}>
        <Btn kind="dng" title={arm === 'tasks' ? 'Точно удалить все задачи?' : 'Удалить все задачи'} onPress={() => { if (arm !== 'tasks') { setArm('tasks'); return; } setArm(''); deleteAllTasks(); }} />
        <Btn kind="dng" title={arm === 'reset' ? 'Точно стереть всё и начать заново?' : 'Начать заново'} onPress={() => { if (arm !== 'reset') { setArm('reset'); return; } setArm(''); resetAll(); }} />
      </View>
      <T sub size={14} style={{ margin: 6, marginTop: 12 }}>Сейчас: {nt} {pl(nt, 'задача', 'задачи', 'задач')} в работе, выполнено: {nd}. «Удалить все задачи» убирает невыполненные, выполненные и бэклог, проекты и регулярные дела остаются. «Начать заново» стирает всё. Вернуть удалённое можно сразу в уведомлении «Отменить».</T>
    </>
  );
}
function HelpPage() {
  const B = ({ h, items }: { h: string; items: string[] }) => (
    <Card style={{ marginBottom: 12 }}>
      <T w="700" style={{ marginBottom: 4 }}>{h}</T>
      {items.map(s => <T key={s} sub size={15} style={{ marginTop: 4 }}>• {s}</T>)}
    </Card>
  );
  return (
    <>
      <B h="Жесты" items={['Свайп вправо по задаче — выполнено, влево — удалить.', 'Нажмите на задачу, чтобы изменить её; на неделе удерживайте задачу, чтобы открыть перенос на другой день.', 'Нажмите на будущую задачу на неделе, чтобы поменять её местами с сегодняшней.']} />
      <B h="Сложность и нагрузка" items={['Сложность задачи зависит от времени: до 30 минут — лёгкая, до 2,5 часов — средняя, больше — сложная.', 'Не больше ' + LIMIT + ' задач в день, из них одна сложная. Сложные задачи уходят на выходные.', 'Полоска у дня показывает нагрузку в часах вместе с регулярными делами.']} />
      <B h="Подзадачи, заметки и итоги" items={['Скажите «на следующей неделе…» или «через две недели…», и задачи встанут на нужную неделю.', 'Внутри задачи можно добавить подзадачи и заметку.', '«Итоги недели» показывают сделанное, серию дней, нагрузку по дням и проектам; там же фокус недели и перенос невыполненного.']} />
    </>
  );
}
const STP: Record<string, [string, () => React.ReactElement]> = {
  assistant: ['Помощник', () => <AssistantPage />], notify: ['Напоминания', () => <NotifyPage />], look: ['Оформление', () => <LookPage />],
  feedback: ['Отклик', () => <FeedbackPage />], data: ['Данные', () => <DataPage />], help: ['Подсказки', () => <HelpPage />],
};
function SettingsScreen() {
  const p = ui.stPage && STP[ui.stPage];
  return (
    <Screen title={p ? p[0] : 'Настройки'} onBack={() => { if (ui.stPage) { ui.stPage = null; notify(); } else closeScreen(); }}>
      {p ? p[1]() : <SettingsRoot />}
    </Screen>
  );
}

/* ---------- проекты ---------- */
function ProjectsScreen() {
  const t = useT();
  return (
    <Screen title="Мои проекты" onBack={closeScreen} right={
      <>
        <HeaderBtn onPress={() => { ui.prjOrder = !ui.prjOrder; notify(); if (ui.prjOrder) toast('Стрелками меняйте порядок проектов'); }}><Reorder color={ui.prjOrder ? t.ink : t.acc} /></HeaderBtn>
        <HeaderBtn label="Создать" onPress={() => openSheet({ kind: 'editProject', id: null })} />
      </>
    }>
      {state.projects.map((p, i) => {
        const c = prCounts(p.id);
        return (
          <LinkRow key={p.id} icon={<FolderFill color={p.color} size={24} />} title={p.name} sub={'В работе ' + c.work + ', бэклог ' + c.bl + ', сделано ' + c.done}
            onPress={ui.prjOrder ? undefined : () => openScreen('project', p.id)}
            right={ui.prjOrder ? (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <HeaderBtn onPress={() => moveProject(p.id, -1)}><Up color={i === 0 ? t.seg : t.ink} size={20} /></HeaderBtn>
                <HeaderBtn onPress={() => moveProject(p.id, 1)}><Down color={i === state.projects.length - 1 ? t.seg : t.ink} size={20} /></HeaderBtn>
              </View>
            ) : undefined} />
        );
      })}
      {!state.projects.length ? (
        <>
          <Empty>Пока нет проектов. Нажмите «Создать» или выберите быстро:</Empty>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {QUICK.map(n => <Chip key={n} label={n} onPress={() => { if (state.projects.length >= MAXPRJ) { toast('Максимум ' + MAXPRJ + ' проектов'); return; } const r = createProject(n); toast('Проект «' + r.p.name + '» создан'); buzz(); }} />)}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
function ProjectScreen({ id }: { id: string }) {
  const t = useT();
  const [v, setV] = useState('');
  const p = prObj(id);
  if (!p) return null;
  const work = state.tasks.filter(x => x.project === p.id && x.status === 'todo').sort((a, b) => (a.week! + a.day).localeCompare(b.week! + b.day));
  const bl = state.backlog.filter(b => b.project === p.id);
  const dn = state.tasks.filter(x => x.project === p.id && x.status === 'done').sort((a, b) => (b.doneTs || 0) - (a.doneTs || 0));
  const tab = ui.pdTab;
  return (
    <Screen title={p.name} backLabel="Проекты" onBack={closeScreen} right={<HeaderBtn label="Изменить" onPress={() => openSheet({ kind: 'editProject', id: p.id })} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.tile, alignItems: 'center', justifyContent: 'center' }}><Folder color={p.color} /></View>
        <T size={28} w="800" style={{ flex: 1 }}>{p.name}</T>
      </View>
      <Seg items={[['work', 'В работе ' + work.length], ['bl', 'Бэклог ' + bl.length], ['done', 'Сделано ' + dn.length]]} value={tab} onChange={k => { ui.pdTab = k; notify(); }} />
      <View style={{ gap: 8, marginTop: 14 }}>
        {tab === 'work' ? (work.length ? work.map(x => <TaskTile key={x.id} t={x} />) : <Empty>В работе пусто</Empty>) : null}
        {tab === 'bl' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input style={{ flex: 1 }} value={v} onChangeText={setV} placeholder="Идея на потом" returnKeyType="done" onSubmitEditing={() => { addBacklog(p.id, v); setV(''); }} />
              <Btn small title="Добавить" onPress={() => { addBacklog(p.id, v); setV(''); }} />
            </View>
            <T sub size={13} style={{ marginHorizontal: 4 }}>Свайп вправо — запланировать, влево — удалить.</T>
            {bl.map(b => (
              <SwipeRow key={b.id} kind="bl" onRight={() => scheduleBacklog(b.id)} onLeft={() => deleteBacklog(b.id)} radius={18}>
                <View style={{ minHeight: 60, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: t.card, borderRadius: 18 }}><T w="500">{b.title}</T></View>
              </SwipeRow>
            ))}
          </>
        ) : null}
        {tab === 'done' ? (dn.length ? dn.map(x => <TaskTile key={x.id} t={x} onPress={() => {}} />) : <Empty>Пока ничего не выполнено</Empty>) : null}
      </View>
    </Screen>
  );
}

/* ---------- выполненное ---------- */
function DoneScreen() {
  const dn = state.tasks.filter(x => x.status === 'done').sort((a, b) => (b.doneTs || 0) - (a.doneTs || 0));
  return (
    <Screen title="Выполненное" onBack={closeScreen}>
      <T sub size={14} style={{ margin: 4, marginBottom: 10 }}>Свайп вправо вернёт задачу в «Сделать».</T>
      <View style={{ gap: 8 }}>{dn.length ? dn.map((x: Task) => <TaskTile key={x.id} t={x} onPress={() => {}} />) : <Empty>Пока ничего не выполнено</Empty>}</View>
    </Screen>
  );
}

/* ---------- итоги недели ---------- */
function Col({ n, max, label, on, onPress }: { n: number; max: number; label: string; on?: boolean; onPress?: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <T sub size={12} w="600">{n || ''}</T>
      <View style={{ width: 18, height: 80, borderRadius: 6, backgroundColor: t.seg, justifyContent: 'flex-end', overflow: 'hidden' }}>
        <View style={{ height: n ? `${Math.max(8, Math.round(n / max * 100))}%` : 0, backgroundColor: on ? t.acc : t.sub, borderRadius: 6 }} />
      </View>
      <T size={12} w={on ? '700' : '500'} sub={!on}>{label}</T>
    </Pressable>
  );
}
function ReviewScreen() {
  const t = useT();
  const rw = realWeek(), w = ui.wrW || rw, r = weekReport(w), m = state.weekMeta[w] || {}, sk = streaks(), ti = todayIdx();
  const maxD = Math.max(1, ...r.days);
  const pk = Object.keys(r.byPrj).sort((a, b) => r.byPrj[b] - r.byPrj[a]);
  const cl = carryList(w);
  const hist = [5, 4, 3, 2, 1, 0].map(i => { const hw = addWeeks(w, -i); return { w: hw, done: weekStats(hw).done }; });
  const mx = Math.max(1, ...hist.map(h => h.done));
  const Tile = ({ big, sub }: { big: string; sub: string }) => <Card style={{ flex: 1, padding: 12, alignItems: 'center' }}><T size={24} w="800">{big}</T><T sub size={12} style={{ textAlign: 'center' }}>{sub}</T></Card>;
  return (
    <Screen title="Итоги недели" onBack={closeScreen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <HeaderBtn onPress={() => { ui.wrW = addWeeks(w, -1); notify(); buzz(); }}><T size={24} style={{ color: t.acc }}>‹</T></HeaderBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T w="700">{weekRange(w)}</T>
          <T sub size={13}>{w === rw ? 'Текущая неделя' : w > rw ? 'Будущая неделя' : 'Прошедшая неделя'}</T>
        </View>
        <HeaderBtn onPress={() => { ui.wrW = addWeeks(w, 1); notify(); buzz(); }}><T size={24} style={{ color: t.acc }}>›</T></HeaderBtn>
      </View>
      <Card style={{ alignItems: 'center' }}>
        <T size={56} w="800">{r.pct}<T size={24} w="700">%</T></T>
        <T sub size={15}>Выполнено задач: {r.done} из {r.total}{r.mins ? ' · ~' + fmtMins(r.mins) + ' в деле' : ''}</T>
        <View style={{ alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: t.seg, marginTop: 12, overflow: 'hidden' }}><View style={{ height: '100%', width: `${r.pct}%`, backgroundColor: t.acc }} /></View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Tile big={String(sk.cur)} sub={'серия, дн.\nрекорд ' + sk.best} />
        <Tile big={r.rs ? r.rd + '/' + r.rs : '—'} sub={'регулярные\nпрошли'} />
        <Tile big={String(r.moved)} sub={'задач с\nпереносом'} />
      </View>
      <H>По дням</H>
      <Card><View style={{ flexDirection: 'row' }}>{SHORT.map((s, i) => <Col key={s} n={r.days[i]} max={maxD} label={s} on={w === rw && i === ti} />)}</View></Card>
      {pk.length ? (
        <>
          <H>По проектам</H>
          <Card style={{ gap: 10 }}>
            {pk.map(k => {
              const p = prObj(k), c = p ? p.color : t.sub;
              return (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
                  <T size={15} style={{ width: 110 }} numberOfLines={1}>{p ? p.name : 'Без проекта'}</T>
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.seg, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.round(r.byPrj[k] / r.byPrj[pk[0]] * 100)}%`, backgroundColor: c }} /></View>
                  <T w="700" size={15}>{r.byPrj[k]}</T>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
      <H>Фокус недели</H>
      <Input key={'f' + w} defaultValue={m.focus || ''} maxLength={120} placeholder="Главное на эту неделю"
        onChangeText={v => { const mm = wmeta(w); mm.focus = v.slice(0, 120); if (!mm.focus.trim()) delete mm.focus; save(); }} />
      <H>Итоги и выводы</H>
      <Input key={'r' + w} defaultValue={m.review || ''} multiline maxLength={800} placeholder="Что получилось, что помешало, что поменять на следующей неделе?" style={{ minHeight: 100, textAlignVertical: 'top' }}
        onChangeText={v => { const mm = wmeta(w); mm.review = v.slice(0, 800); if (!mm.review.trim()) delete mm.review; save(); }} />
      <View style={{ gap: 10, marginTop: 14 }}>
        {cl.length ? <Btn kind="sec" title={(w < rw ? 'Перенести невыполненное на ближайшие дни' : 'Перенести невыполненное на следующую неделю') + ' (' + cl.length + ')'} onPress={() => carryOver(w)} /> : null}
        {w <= rw ? <Btn kind={m.closed ? 'sec' : 'pri'} title={m.closed ? 'Неделя закрыта · открыть снова' : 'Закрыть неделю'} onPress={() => toggleWeekClosed(w)} /> : null}
      </View>
      <H>Последние недели</H>
      <Card><View style={{ flexDirection: 'row' }}>{hist.map(x => <Col key={x.w} n={x.done} max={mx} label={fmtS(parseISO(x.w))} on={x.w === w} onPress={() => { ui.wrW = x.w; notify(); buzz(); }} />)}</View></Card>
    </Screen>
  );
}

/* ---------- регулярные дела ---------- */
function RegularsScreen() {
  const t = useT();
  return (
    <Screen title="Регулярные дела" onBack={closeScreen} right={<HeaderBtn label="Создать" onPress={() => openSheet({ kind: 'regular', id: null })} />}>
      <T sub size={15} style={{ margin: 4, marginBottom: 14 }}>Повторяются каждую неделю и не занимают места среди {LIMIT} задач дня. На экранах дня они показывают, что ещё ждёт, а что уже прошло. Нажмите на дело, чтобы изменить, смахните влево — удалить.</T>
      {!state.regulars.length ? (
        <Card><T size={22} w="800" style={{ marginBottom: 6 }}>Пока пусто.</T><T sub>Нажмите «Создать» и задайте дело, дни, время и напоминание. Или скажите помощнику: «зал в понедельник, среду и пятницу в 19:00».</T></Card>
      ) : state.regulars.map(r => {
        let meta = daysLabel(r.days);
        if (r.time) meta += ' · ' + regSpan(r);
        meta += ' · ' + durText(r.mins || defRegMins(r.level || 2));
        if (r.time && r.rem != null) meta += ' · ' + (r.rem ? 'напомню за ' + r.rem + ' мин' : 'напомню в начале');
        return (
          <View key={r.id} style={{ marginBottom: 10 }}>
            <SwipeRow kind="reg" onLeft={() => deleteRegular(r.id)}>
              <Pressable onPress={() => openSheet({ kind: 'regular', id: r.id })} style={{ minHeight: 66, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: t.card, borderRadius: 20 }}>
                <T w="600">{r.title}</T><T sub size={14}>{meta}</T>
              </Pressable>
            </SwipeRow>
          </View>
        );
      })}
    </Screen>
  );
}

export function Screens() {
  return (
    <>
      {ui.screens.map((s, i) => {
        const k = s.name + (s.id || '') + i;
        switch (s.name) {
          case 'settings': return <SettingsScreen key={k} />;
          case 'projects': return <ProjectsScreen key={k} />;
          case 'project': return <ProjectScreen key={k} id={s.id!} />;
          case 'done': return <DoneScreen key={k} />;
          case 'review': return <ReviewScreen key={k} />;
          case 'regulars': return <RegularsScreen key={k} />;
        }
      })}
    </>
  );
}
export { Text };
