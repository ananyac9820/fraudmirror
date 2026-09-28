import { useAppSelector } from '../store';

/** JS copy of the mirror-mode palette, for chart libraries that need literal colours. */
export function usePalette() {
  const mode = useAppSelector((s) => s.ui.mode);
  return mode === 'defender'
    ? { accent: '#22d3ee', accent2: '#34d399', danger: '#f43f5e', muted: '#475569', grid: 'rgba(148,163,184,0.1)', axis: '#64748b' }
    : { accent: '#f59e0b', accent2: '#e879f9', danger: '#e879f9', muted: '#475569', grid: 'rgba(148,163,184,0.1)', axis: '#64748b' };
}

export const tooltipStyle = {
  contentStyle: { background: '#0b111a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
};
