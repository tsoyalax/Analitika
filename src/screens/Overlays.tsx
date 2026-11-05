import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onb, onbCreate, onbSkip } from '../core/ai';
import { openScreen, setTab } from '../core/actions';
import { notify, runUndo, state, ui } from '../core/store';
import { Btn, T, useT } from '../ui/kit';

/* ---------- первый запуск: сначала проекты, потом дела ---------- */
export function Onboarding() {
  const t = useT();
  const ins = useSafeAreaInsets();
  const step = state.memory.onb;
  if (step !== 'projects' && step !== 'plans') return null;
  const Arrow = () => <Text style={{ fontSize: 30, color: t.acc, textAlign: 'center', marginTop: 6 }}>↘</Text>;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: ins.top + 24, paddingBottom: ins.bottom + 170 }}>
        {step === 'projects' && onb.list.length ? (
          <>
            <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 14 }}>📁</Text>
            <T size={28} w="800" style={{ textAlign: 'center', marginBottom: 10 }}>Вот ваши проекты</T>
            <T sub style={{ textAlign: 'center', marginBottom: 18 }}>Уберите лишнее, и я создам для каждого папку. Дальше расскажете про дела.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
              {onb.list.map((n, i) => (
                <Pressable key={n} onPress={() => { onb.list.splice(i, 1); notify(); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44, paddingHorizontal: 16, borderRadius: 99, backgroundColor: t.card }}>
                  <T w="600">{n}</T><T sub size={13}>✕</T>
                </Pressable>
              ))}
            </View>
            <View style={{ gap: 10 }}>
              <Btn title="Создать проекты" onPress={onbCreate} />
              <Btn kind="sec" title="Сказать заново" onPress={() => { onb.list = []; notify(); }} />
            </View>
          </>
        ) : step === 'projects' ? (
          <>
            <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 14 }}>📁</Text>
            <T size={28} w="800" style={{ textAlign: 'center', marginBottom: 10 }}>Какие у вас проекты?</T>
            <T sub style={{ textAlign: 'center' }}>Назовите сферы и проекты, которыми живёте: например, работа, учёба, спорт, подработка, ремонт. Нажмите кнопку помощника внизу и просто расскажите.</T>
            <Arrow />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 56, textAlign: 'center', marginBottom: 14 }}>🗓️</Text>
            <T size={28} w="800" style={{ textAlign: 'center', marginBottom: 10 }}>Какие дела планируете?</T>
            <T sub style={{ textAlign: 'center', marginBottom: 18 }}>Расскажите, что хотите сделать на этой неделе. Я распределю задачи по дням и разложу по проектам.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {state.projects.map(p => (
                <View key={p.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44, paddingHorizontal: 16, borderRadius: 99, backgroundColor: t.card }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} /><T w="600">{p.name}</T>
                </View>
              ))}
            </View>
            <Arrow />
          </>
        )}
        <Pressable onPress={onbSkip} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 14 }}><T sub size={15}>Пропустить</T></Pressable>
      </ScrollView>
    </View>
  );
}

/* ---------- конфетти ---------- */
const COLORS = ['#5b5bf0', '#b45fe0', '#ff7a6b', '#34c759', '#ffcc00', '#32ade6'];
export function Confetti() {
  const n = ui.confetti, big = ui.bigConfetti;
  const p = useRef(new Animated.Value(0)).current;
  const { width: W, height: H } = Dimensions.get('window');
  const parts = useMemo(() => Array.from({ length: n ? (big ? 110 : 50) : 0 }).map((_, i) => {
    const a = Math.random() * Math.PI * 2, v = (0.45 + Math.random() * 0.75) * (big ? 420 : 300);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, w: 5 + Math.random() * 7, h: 4 + Math.random() * 8, r: (Math.random() - 0.5) * 1440, c: COLORS[i % COLORS.length], round: Math.random() < 0.35 };
  }), [n, big]);
  useEffect(() => {
    if (!n) return;
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: 1700, useNativeDriver: true }).start();
  }, [n, p]);
  if (!n) return null;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {parts.map((q, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: W / 2, top: H / 2, width: q.w, height: q.round ? q.w : q.h, borderRadius: q.round ? q.w / 2 : 2, backgroundColor: q.c,
          opacity: p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: steps, outputRange: steps.map(s => q.vx * (1 - Math.pow(1 - s, 2)) * 1.2) }) },
            { translateY: p.interpolate({ inputRange: steps, outputRange: steps.map(s => q.vy * s + 700 * s * s) }) },
            { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', q.r + 'deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
}

/* ---------- тост с «Отменить» ---------- */
export function Toast() {
  const t = useT();
  const ins = useSafeAreaInsets();
  const ts = ui.toast;
  if (!ts) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: ins.top + 10, left: 12, right: 12, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.ink, borderRadius: 24, paddingVertical: 12, paddingLeft: 18, paddingRight: ts.undo ? 10 : 18, maxWidth: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <Text style={{ color: t.bg, fontSize: 15, flexShrink: 1 }}>{ts.msg}</Text>
        {ts.undo ? <Pressable onPress={runUndo} hitSlop={8}><Text style={{ color: t.bg, fontWeight: '800', fontSize: 15, opacity: 0.75 }}>Отменить</Text></Pressable> : null}
      </View>
    </View>
  );
}

/* ---------- баннер напоминания ---------- */
export function Banner() {
  const t = useT();
  const ins = useSafeAreaInsets();
  const b = ui.banner;
  if (!b) return null;
  const close = () => { ui.banner = null; notify(); };
  return (
    <View style={{ position: 'absolute', top: ins.top + 64, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 20, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.bord, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 6 }}>
      <T size={15} style={{ flex: 1 }}>{b.msg}</T>
      <Pressable onPress={() => { close(); if (b.k === 'week') openScreen('review'); else setTab(b.k === 'evening' ? 'todo' : 'home'); }}><T size={15} w="700" style={{ color: t.acc }}>Открыть</T></Pressable>
      <Pressable onPress={close} hitSlop={8}><T sub size={22}>×</T></Pressable>
    </View>
  );
}
