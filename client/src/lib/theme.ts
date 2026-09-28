import { useAppSelector } from '../store';

/** Literal copies of the CSS palette, for Recharts which needs real colour values. */
export function usePalette() {
  const mode = useAppSelector((s) => s.ui.mode);
  return mode === 'defender'
    ? { ink: '#e4ebdd', accent: '#d8e3b0', signal: '#e2a585', muted: '#a8bcba', faint: '#83999a', grid: 'rgba(214,228,214,0.12)', bg: '#28434c' }
    : { ink: '#efe5d6', accent: '#e2b879', signal: '#d9937e', muted: '#c0ad98', faint: '#9a8876', grid: 'rgba(240,226,206,0.12)', bg: '#3a302b' };
}

export function useTooltipStyle() {
  const c = usePalette();
  return {
    contentStyle: { background: c.bg, border: `1px solid ${c.grid}`, borderRadius: 0, fontSize: 12, fontFamily: 'IBM Plex Sans' },
    labelStyle: { color: c.muted },
    itemStyle: { color: c.ink },
    cursor: { fill: c.grid },
  };
}
