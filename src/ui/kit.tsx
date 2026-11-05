import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { m2t, t2m } from '../core/dates';
import { buzz } from '../core/store';
import { ChevL, ChevR, Check, Trash, Undo, Cal } from './icons';
import { makeTheme, Theme } from './theme';

export const ThemeCtx = createContext<Theme>(makeTheme(true));
export const useT = () => useContext(ThemeCtx);

/* ---------- текст ---------- */
export function T({ style, sub, size, w, ...p }: TextProps & { sub?: boolean; size?: number; w?: TextStyle['fontWeight'] }) {
  const t = useT();
  return <Text {...p} style={[{ color: sub ? t.sub : t.ink, fontSize: size || 17, fontWeight: w }, style]} />;
}

/* ---------- кнопки ---------- */
export function Btn({ title, onPress, kind = 'pri', style, disabled, small }: { title: string; onPress: () => void; kind?: 'pri' | 'sec' | 'dng' | 'soft'; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean }) {
  const t = useT();
  const bg = kind === 'pri' ? t.acc : kind === 'dng' ? 'rgba(255,59,48,0.12)' : kind === 'soft' ? t.accSoft : t.seg;
  const fg = kind === 'pri' ? t.accOn : kind === 'dng' ? t.danger : kind === 'soft' ? t.acc : t.ink;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [{ backgroundColor: bg, borderRadius: 16, minHeight: small ? 46 : 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 }, style]}>
      <Text style={{ color: fg, fontSize: small ? 15 : 17, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}
export function Chip({ label, sub, on, onPress, dot, dim, style }: { label: string; sub?: string; on?: boolean; onPress?: () => void; dot?: string; dim?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 99, backgroundColor: on ? t.acc : t.tile, opacity: dim ? 0.4 : 1 }, style]}>
      {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
      <View>
        <Text style={{ color: on ? t.accOn : t.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {sub ? <Text style={{ color: on ? t.accOn : t.sub, opacity: on ? 0.75 : 1, fontSize: 11.5, fontWeight: '500' }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
export function Seg({ items, value, onChange }: { items: [string, string][]; value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.seg, borderRadius: 12, padding: 3, gap: 2 }}>
      {items.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={{ flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: value === k ? t.card : 'transparent' }}>
          <Text style={{ color: value === k ? t.ink : t.sub, fontWeight: '600', fontSize: 15 }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function DayChips({ days, isOn, isFull, onPress, sub }: { days: string[]; isOn: (i: number) => boolean; isFull?: (i: number) => boolean; onPress: (i: number) => void; sub?: (i: number) => string }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {days.map((s, i) => {
        const on = isOn(i);
        return (
          <Pressable key={i} onPress={() => onPress(i)} style={{ flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: on ? t.acc : t.tile, alignItems: 'center', justifyContent: 'center', opacity: isFull && isFull(i) ? 0.38 : 1 }}>
            <Text style={{ color: on ? t.accOn : t.sub, fontSize: 11, fontWeight: '600' }}>{s}</Text>
            {sub ? <Text style={{ color: on ? t.accOn : t.ink, fontSize: 15, fontWeight: '600' }}>{sub(i)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useT();
  return <Text style={[{ color: t.sub, fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 2 }, style]}>{children}</Text>;
}
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useT();
  const st = [{ backgroundColor: t.card, borderRadius: 22, padding: 16, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.bord }, style];
  return onPress ? <Pressable onPress={onPress} style={st}>{children}</Pressable> : <View style={st}>{children}</View>;
}
export function Input(p: React.ComponentProps<typeof TextInput>) {
  const t = useT();
  return <TextInput placeholderTextColor={t.sub} {...p} style={[{ backgroundColor: t.tile, color: t.ink, borderRadius: 14, fontSize: 17, paddingHorizontal: 14, minHeight: 50, paddingVertical: 12 }, p.style]} />;
}
export function LvlBars({ level }: { level: number }) {
  const t = useT();
  const c = level === 1 ? t.done : level === 2 ? t.warn : t.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 18 }}>
      {[7, 12, 17].map((h, i) => <View key={i} style={{ width: 4, height: h, borderRadius: 2, backgroundColor: i < level ? c : t.seg }} />)}
    </View>
  );
}
export function Dot({ color, size = 8 }: { color: string; size?: number }) { return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />; }

/* ---------- время ЧЧ:ММ ---------- */
export function TimeField({ value, onChange, placeholder }: { value: number | null; onChange: (m: number | null) => void; placeholder?: string }) {
  const t = useT();
  const [txt, setTxt] = useState(value == null || isNaN(value) ? '' : m2t(value));
  useEffect(() => { setTxt(value == null || isNaN(value) ? '' : m2t(value)); }, [value]);
  const commit = () => {
    const raw = txt.replace(/[^\d:.]/g, '').replace('.', ':');
    if (!raw) { onChange(null); return; }
    let m = t2m(raw.includes(':') ? raw : raw.length <= 2 ? raw + ':00' : raw.slice(0, -2) + ':' + raw.slice(-2));
    if (isNaN(m) || m < 0 || m > 1439) { setTxt(value == null ? '' : m2t(value)); return; }
    m = Math.round(m); onChange(m); setTxt(m2t(m));
  };
  return (
    <TextInput value={txt} onChangeText={setTxt} onEndEditing={commit} onSubmitEditing={commit} placeholder={placeholder || '--:--'} placeholderTextColor={t.sub}
      keyboardType="numbers-and-punctuation" maxLength={5} returnKeyType="done"
      style={{ minWidth: 92, textAlign: 'center', fontSize: 17, color: t.ink, backgroundColor: t.seg, borderRadius: 10, paddingHorizontal: 12, minHeight: 40, fontVariant: ['tabular-nums'] }} />
  );
}
export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>
      <T>{label}</T>{children}
    </View>
  );
}

/* ---------- строка-ссылка как в меню настроек ---------- */
export function LinkRow({ icon, iconBg, title, sub, onPress, right }: { icon?: React.ReactNode; iconBg?: string; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 66, paddingHorizontal: 14, backgroundColor: pressed ? t.seg : t.card, borderRadius: 20, marginBottom: 8, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth, borderColor: t.bord })}>
      {icon ? <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg || t.tile, alignItems: 'center', justifyContent: 'center' }}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="700" numberOfLines={1}>{title}</T>
        {sub ? <T sub size={14} numberOfLines={1}>{sub}</T> : null}
      </View>
      {right || <ChevR color={t.sub} size={20} />}
    </Pressable>
  );
}

/* ---------- свайп по строке: вправо — действие, влево — удалить ---------- */
export type SwipeKind = 'todo' | 'done' | 'bl' | 'reg';
export function SwipeRow({ kind, onRight, onLeft, children, radius = 20 }: { kind: SwipeKind; onRight?: () => void; onLeft?: () => void; children: React.ReactNode; radius?: number }) {
  const t = useT();
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(320);
  const cb = useRef({ onRight, onLeft });
  cb.current = { onRight, onLeft };
  const armed = useRef(false);
  const cur = useRef(0);
  const pr = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      let dx = g.dx;
      if (!cb.current.onRight) dx = Math.min(0, dx);
      if (!cb.current.onLeft) dx = Math.max(0, dx);
      x.setValue(dx); cur.current = dx;
      const a = Math.abs(dx) > Math.min(110, w.current * 0.35);
      if (a && !armed.current) buzz();
      armed.current = a;
    },
    onPanResponderRelease: () => {
      const dx = cur.current; cur.current = 0;
      armed.current = false;
      if (Math.abs(dx) > Math.min(110, w.current * 0.35)) {
        const right = dx > 0;
        Animated.timing(x, { toValue: right ? w.current * 1.1 : -w.current * 1.1, duration: 180, useNativeDriver: true }).start(() => {
          const f = right ? cb.current.onRight : cb.current.onLeft;
          if (f) f();
          x.setValue(0);
        });
      } else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;
  const rightBg = kind === 'todo' ? t.done : kind === 'done' ? t.warn : t.acc;
  const RightIc = kind === 'todo' ? Check : kind === 'done' ? Undo : Cal;
  return (
    <View style={{ borderRadius: radius, overflow: 'hidden' }} onLayout={e => { w.current = e.nativeEvent.layout.width; }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: rightBg, justifyContent: 'center', paddingHorizontal: 24, opacity: x.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
        <RightIc color={kind === 'bl' ? t.accOn : '#fff'} size={26} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.dark ? '#6e6e73' : '#8e8e93', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 24, opacity: x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        <Trash color="#fff" size={26} />
      </Animated.View>
      <Animated.View {...pr.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}

/* ---------- нижний лист ---------- */
export function Sheet({ onClose, children, title, sub, right, full }: { onClose: () => void; children: React.ReactNode; title?: string; sub?: string; right?: React.ReactNode; full?: boolean }) {
  const t = useT();
  const ins = useSafeAreaInsets();
  const y = useRef(new Animated.Value(600)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 16 }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [y, fade]);
  const grab = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => { if (g.dy > 100) close.current(); else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: fade }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ translateY: y }], backgroundColor: t.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: full ? '94%' : '90%', minHeight: full ? '70%' : undefined }}>
          <View {...grab.panHandlers} style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.dash }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T size={22} w="700">{title}</T>
                {sub ? <T sub size={15} style={{ marginTop: 4 }}>{sub}</T> : null}
              </View>
              {right}
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: title ? 14 : 0, paddingBottom: ins.bottom + 22 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---------- вложенный экран ---------- */
export function Screen({ title, onBack, backLabel = 'Назад', right, children }: { title: string; onBack: () => void; backLabel?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  const ins = useSafeAreaInsets();
  const x = useRef(new Animated.Value(400)).current;
  useEffect(() => { Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start(); }, [x]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, paddingTop: ins.top, transform: [{ translateX: x }] }]}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={onBack} hitSlop={8} style={{ position: 'absolute', left: 6, flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <ChevL color={t.acc} size={24} /><Text style={{ color: t.acc, fontSize: 17 }}>{backLabel}</Text>
        </Pressable>
        <Text numberOfLines={1} style={{ color: t.ink, fontSize: 17, fontWeight: '700', maxWidth: '46%' }}>{title}</Text>
        <View style={{ position: 'absolute', right: 6, flexDirection: 'row', alignItems: 'center' }}>{right}</View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: ins.bottom + 40 }}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}
export function HeaderBtn({ label, onPress, children }: { label?: string; onPress: () => void; children?: React.ReactNode }) {
  const t = useT();
  return <Pressable onPress={onPress} hitSlop={6} style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>{children || <Text style={{ color: t.acc, fontSize: 17, fontWeight: '600' }}>{label}</Text>}</Pressable>;
}

/* ---------- карточка-подсказка ---------- */
export function SugCard({ title, text, actions }: { title: string; text: string; actions: { label: string; kind?: 'pri' | 'sec' | 'dng'; onPress: () => void; wide?: boolean }[] }) {
  return (
    <Card style={{ marginVertical: 8 }}>
      <T size={18} w="700" style={{ marginBottom: 6 }}>{title}</T>
      <T sub size={15.5} style={{ marginBottom: 14 }}>{text}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {actions.map(a => <Btn key={a.label} small title={a.label} kind={a.kind || 'sec'} onPress={a.onPress} style={{ flexGrow: 1, flexBasis: a.wide ? '100%' : '40%' }} />)}
      </View>
    </Card>
  );
}
export function Empty({ children }: { children: React.ReactNode }) { return <T sub size={15} style={{ paddingVertical: 10, paddingHorizontal: 6 }}>{children}</T>; }
