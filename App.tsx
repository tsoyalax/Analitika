import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { voice } from './src/core/ai';
import { closeScreen, closeSheet, openScreen, openSheet, setTab } from './src/core/actions';
import { normalize, normRegs, viewWeek, weekStats } from './src/core/planner';
import { nfCheck } from './src/core/reminders';
import { load, notify, save, state, ui, useStore } from './src/core/store';
import { Home } from './src/screens/Home';
import { Banner, Confetti, Onboarding, Toast } from './src/screens/Overlays';
import { Plan, PlanHeader, ScrollCtx } from './src/screens/Plan';
import { Screens } from './src/screens/Screens';
import { Sheets } from './src/screens/Sheets';
import { Bars, Cal, Home as HomeIc, Sliders } from './src/ui/icons';
import { ThemeCtx } from './src/ui/kit';
import { useTheme } from './src/ui/theme';

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

function Root() {
  useStore();
  const theme = useTheme();
  const ins = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sc = useMemo(() => ({ scrollTo: (y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 150), animated: true }), dayY: {} as Record<number, number> }), []);

  useEffect(() => {
    load().then(() => {
      normalize(); normRegs();
      ui.ready = true; save();
      setTimeout(nfCheck, 2000);
    });
    const iv = setInterval(nfCheck, 30000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') nfCheck(); });
    // Android «назад»: закрыть лист, затем экран
    const bh = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ui.sheet) { if (!voice.busy) closeSheet(); return true; }
      if (ui.stPage) { ui.stPage = null; notify(); return true; }
      if (ui.screens.length) { closeScreen(); return true; }
      return false;
    });
    return () => { clearInterval(iv); sub.remove(); bh.remove(); };
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [ui.tab, ui.off, ui.planView]);

  const t = theme;
  if (!ui.ready) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.acc} /></View>;
  const isPlan = ui.tab === 'todo';
  const badge = weekStats(viewWeek()).todo;
  const settingsOpen = ui.screens.some(s => s.name === 'settings');

  const Tab = ({ on, label, icon, onPress, count }: { on: boolean; label: string; icon: React.ReactNode; onPress: () => void; count?: number }) => (
    <Pressable onPress={onPress} style={{ flex: 1, margin: 6, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? t.accSoft : 'transparent' }}>
      {icon}
      <Text style={{ fontSize: 11, fontWeight: '600', color: on ? t.acc : t.sub }}>{label}</Text>
      {count ? <View style={{ position: 'absolute', top: 4, left: '56%', minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5, backgroundColor: t.acc, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.accOn, fontSize: 11.5, fontWeight: '700' }}>{count}</Text></View> : null}
    </Pressable>
  );

  return (
    <ThemeCtx.Provider value={theme}>
      <ScrollCtx.Provider value={sc}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <StatusBar style={t.dark ? 'light' : 'dark'} />
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" stickyHeaderIndices={isPlan ? [0] : undefined}
            contentContainerStyle={{ paddingTop: ins.top, paddingBottom: ins.bottom + 180 }}>
            {isPlan ? <View style={{ backgroundColor: t.bg, paddingHorizontal: 16 }}><PlanHeader /></View> : null}
            <View style={{ paddingHorizontal: 16 }}>{isPlan ? <Plan /> : <Home />}</View>
          </ScrollView>

          <View style={[styles.tabbar, { bottom: ins.bottom + 10, backgroundColor: t.card, borderColor: t.bord, borderWidth: t.dark ? 0 : StyleSheet.hairlineWidth }]}>
            <Tab on={ui.tab === 'home' && !settingsOpen} label="Сегодня" icon={<HomeIc color={ui.tab === 'home' && !settingsOpen ? t.acc : t.sub} size={25} />} onPress={() => { ui.screens = []; setTab('home'); notify(); }} />
            <Tab on={isPlan && !settingsOpen} label="Календарь" count={badge} icon={<Cal color={isPlan && !settingsOpen ? t.acc : t.sub} size={25} />} onPress={() => { ui.screens = []; setTab('todo'); notify(); }} />
            <Tab on={settingsOpen} label="Настройки" icon={<Sliders color={settingsOpen ? t.acc : t.sub} size={25} />} onPress={() => { if (!settingsOpen) { ui.stPage = null; openScreen('settings'); } }} />
          </View>

          <Onboarding />

          <Pressable accessibilityLabel="Голосовой помощник" onPress={() => { voice.note = ''; openSheet({ kind: 'voice' }); }} onLongPress={() => openScreen('done')}
            style={({ pressed }) => [styles.ai, { bottom: ins.bottom + 88, backgroundColor: t.acc, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
            <Bars color={t.accOn} active={voice.busy} />
          </Pressable>

          <Screens />
          <Sheets />
          <Banner />
          <Confetti />
          <Toast />
        </View>
      </ScrollCtx.Provider>
    </ThemeCtx.Provider>
  );
}

const styles = StyleSheet.create({
  tabbar: { position: 'absolute', left: 12, right: 12, height: 64, borderRadius: 32, flexDirection: 'row', paddingHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ai: { position: 'absolute', right: 18, width: 96, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});
export { state };
