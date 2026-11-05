import { useColorScheme } from 'react-native';
import { state } from '../core/store';

export const PALS = [
  { id: 'mono', name: 'Классика' },
  { id: 'rose', name: 'Роза', l: ['#e11d74', '#fff5f9'], d: ['#ff6aa8', '#1f1519'] },
  { id: 'lilac', name: 'Лаванда', l: ['#7c5cff', '#f8f6ff'], d: ['#a994ff', '#1a1722'] },
  { id: 'peach', name: 'Персик', l: ['#ff6f4d', '#fff6f2'], d: ['#ff9a7e', '#211713'] },
  { id: 'ocean', name: 'Океан', l: ['#1d6fe5', '#f3f8ff'], d: ['#5b9dff', '#131920'] },
  { id: 'emerald', name: 'Изумруд', l: ['#0e9f6e', '#f1fbf7'], d: ['#3ddba8', '#121b18'] },
  { id: 'sunset', name: 'Закат', l: ['#f08a00', '#fffaf0'], d: ['#ffb340', '#1d1810'] },
];

export type Theme = {
  dark: boolean; bg: string; card: string; tile: string; ink: string; sub: string; line: string; bord: string; dash: string; seg: string;
  acc: string; accOn: string; accSoft: string; done: string; warn: string; danger: string; sheet: string; scrim: string;
};

function rgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h: string) { const c = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export function rgba(h: string, a: number) { return 'rgba(' + rgb(h).join(',') + ',' + a + ')'; }

export function makeTheme(dark: boolean, palId?: string): Theme {
  const base: Theme = dark
    ? { dark, bg: '#000000', card: '#1c1c1e', tile: '#2c2c2e', ink: '#f2f2f7', sub: '#8e8e93', line: 'rgba(235,235,245,0.1)', bord: 'rgba(255,255,255,0.24)', dash: 'rgba(235,235,245,0.25)', seg: 'rgba(255,255,255,0.1)', acc: '#f2f2f7', accOn: '#000000', accSoft: 'rgba(255,255,255,0.1)', done: '#34c759', warn: '#ff9f0a', danger: '#ff453a', sheet: '#1c1c1e', scrim: 'rgba(0,0,0,0.55)' }
    : { dark, bg: '#ffffff', card: '#ffffff', tile: '#f2f2f7', ink: '#1c1c1e', sub: '#8e8e93', line: 'rgba(60,60,67,0.13)', bord: 'rgba(0,0,0,0.14)', dash: 'rgba(60,60,67,0.25)', seg: 'rgba(118,118,128,0.12)', acc: '#111111', accOn: '#ffffff', accSoft: 'rgba(0,0,0,0.06)', done: '#34c759', warn: '#f08a00', danger: '#ff3b30', sheet: '#f7f7f9', scrim: 'rgba(0,0,0,0.3)' };
  const p = PALS.find(x => x.id === palId);
  if (!p || !p.l) return base;
  const [a, bg] = dark ? p.d! : p.l;
  return {
    ...base, bg, card: bg, sheet: bg,
    tile: rgba(a, dark ? 0.1 : 0.07), seg: rgba(a, dark ? 0.16 : 0.09), line: rgba(a, dark ? 0.22 : 0.16), dash: rgba(a, dark ? 0.34 : 0.3), bord: rgba(a, dark ? 0.5 : 0.4),
    acc: a, accOn: lum(a) > 0.45 ? '#111111' : '#ffffff', accSoft: rgba(a, dark ? 0.2 : 0.12),
  };
}

export function useTheme() {
  const sys = useColorScheme();
  const mode = state.settings.theme || 'dark';
  const dark = mode === 'auto' ? sys === 'dark' : mode === 'dark';
  return makeTheme(dark, state.settings.pal);
}
