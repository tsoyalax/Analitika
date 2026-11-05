import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color: string; width?: number };

function Stroke({ size = 22, color, width = 2.2, children }: P & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const Check = (p: P) => <Stroke width={3.2} {...p}><Path d="M5 12.5l4.5 4.5L19 7.5" /></Stroke>;
export const ChevR = (p: P) => <Stroke width={2.6} {...p}><Path d="M9 5l7 7-7 7" /></Stroke>;
export const ChevL = (p: P) => <Stroke width={2.6} {...p}><Path d="M15 5l-7 7 7 7" /></Stroke>;
export const Home = (p: P) => <Stroke width={2} {...p}><Path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" /></Stroke>;
export const Cal = (p: P) => <Stroke width={2} {...p}><Rect x={3.5} y={5} width={17} height={15.5} rx={3.5} /><Path d="M3.5 10h17M8 3v4M16 3v4" /></Stroke>;
export const Sliders = (p: P) => <Stroke width={2} {...p}><Path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><Circle cx={16} cy={7} r={2} /><Circle cx={8} cy={17} r={2} /></Stroke>;
export const Trash = (p: P) => <Stroke {...p}><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Stroke>;
export const Undo = (p: P) => <Stroke {...p}><Path d="M9 14L4 9l5-5" /><Path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Stroke>;
export const Repeat = (p: P) => <Stroke width={2.4} {...p}><Path d="M17 2l4 4-4 4" /><Path d="M3 11V9a3 3 0 0 1 3-3h15" /><Path d="M7 22l-4-4 4-4" /><Path d="M21 13v2a3 3 0 0 1-3 3H3" /></Stroke>;
export const Folder = (p: P) => <Stroke {...p}><Path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Stroke>;
export const FolderFill = ({ size = 22, color }: P) => <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>;
export const Clock = (p: P) => <Stroke {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></Stroke>;
export const Sort = (p: P) => <Stroke {...p}><Path d="M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" /></Stroke>;
export const Shuffle = (p: P) => <Stroke {...p}><Path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Stroke>;
export const More = ({ size = 22, color }: P) => <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Circle cx={5} cy={12} r={2} /><Circle cx={12} cy={12} r={2} /><Circle cx={19} cy={12} r={2} /></Svg>;
export const Plus = (p: P) => <Stroke width={2.4} {...p}><Path d="M12 5v14M5 12h14" /></Stroke>;
export const Send = (p: P) => <Stroke width={2} {...p}><Path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8.5L2 8.5z" /></Stroke>;
export const Up = (p: P) => <Stroke width={2.6} {...p}><Path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></Stroke>;
export const Down = (p: P) => <Stroke width={2.6} {...p}><Path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" /></Stroke>;
export const Reorder = (p: P) => <Stroke {...p}><Path d="M8 4v16M8 4L4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" /></Stroke>;
export const Search = (p: P) => <Stroke {...p}><Circle cx={11} cy={11} r={7} /><Path d="M20 20l-4-4" /></Stroke>;
export const Bell = (p: P) => <Stroke width={2} {...p}><Path d="M6 17h12l-1.6-2.4V10a4.4 4.4 0 0 0-8.8 0v4.6z" /><Path d="M10.2 20a2 2 0 0 0 3.6 0" /></Stroke>;
export const Palette = (p: P) => <Stroke width={2} {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M12 3.5a8.5 8.5 0 0 1 0 17z" /></Stroke>;
export const Data = (p: P) => <Stroke width={2} {...p}><Path d="M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" /><Path d="M3.5 5h17v4h-17z" /><Path d="M10 14h4" /></Stroke>;
export const Help = (p: P) => <Stroke width={2} {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M9.5 9.6a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1 1-1.1 1.8M12 16.8v.1" /></Stroke>;
export const Chart = (p: P) => <Stroke width={2.4} {...p}><Path d="M6 20v-6M12 20V6M18 20v-9" /></Stroke>;
export const Done = (p: P) => <Stroke width={2.2} {...p}><Circle cx={12} cy={12} r={9} /><Path d="M8 12.5l3 3 5-6" /></Stroke>;
export const Spark = (p: P) => <Stroke width={1.8} {...p}><Path d="M10 3.2l1.7 4.6a3 3 0 0 0 1.8 1.8l4.6 1.7-4.6 1.7a3 3 0 0 0-1.8 1.8L10 19.4l-1.7-4.6a3 3 0 0 0-1.8-1.8L1.9 11.3l4.6-1.7a3 3 0 0 0 1.8-1.8z" /></Stroke>;
export const Pencil = (p: P) => <Stroke width={2} {...p}><Path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><Path d="M14 7l3 3" /></Stroke>;
export const Key = (p: P) => <Stroke width={2} {...p}><Circle cx={8} cy={15} r={4} /><Path d="M11 12l9-9M17 6l2 2M15 8l2 2" /></Stroke>;

// Кнопка помощника: эквалайзер
export function Bars({ color, active }: { color: string; active?: boolean }) {
  const h = active ? [12, 20, 14, 26, 16, 22, 10] : [8, 14, 20, 26, 20, 14, 8];
  return (
    <Svg width={44} height={26} viewBox="0 0 44 26" fill={color}>
      {h.map((v, i) => <Rect key={i} x={1.5 + i * 6.3} y={13 - v / 2} width={3.2} height={v} rx={1.6} />)}
    </Svg>
  );
}
