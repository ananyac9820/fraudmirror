import type { ReactNode } from 'react';

export default function KpiCard({ label, value, sub, tone = 'accent' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'accent2' | 'danger' | 'plain' }) {
  const color = { accent: 'text-accent', accent2: 'text-accent2', danger: 'text-rose-300', plain: 'text-white' }[tone];
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="panel-title">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold sm:text-3xl ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
