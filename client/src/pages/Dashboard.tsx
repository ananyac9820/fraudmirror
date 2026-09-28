import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { fmtINRCompact, fmtNum, fmtPct } from '../lib/format';
import { tooltipStyle, usePalette } from '../lib/theme';
import { ATTACK_LABELS } from '../lib/types';
import { useAppSelector } from '../store';
import KpiCard from '../components/KpiCard';

interface Stats {
  kpis: {
    transactionsToday: number;
    flaggedToday: number;
    openAlerts: number;
    fraudToday: number;
    caughtToday: number;
    slippedToday: number;
    detectionRate: number;
    amountProtected: number;
    amountSlipped: number;
    volumeToday: number;
  };
  perMinute: { minute: string; total: number; flagged: number; slipped: number }[];
  alertsByPattern: { pattern: string; count: number }[];
  riskDistribution: { bucket: string; count: number }[];
  byAttackType: { type: string; caught: number; missed: number }[];
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="panel-title mb-3">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const mode = useAppSelector((s) => s.ui.mode);
  const c = usePalette();
  const attacker = mode === 'attacker';

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Stats>('/stats')
        .then((s) => alive && (setStats(s), setError('')))
        .catch((e) => alive && setError(e.message));
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!stats) return <div className="panel p-6 text-slate-400">{error || 'Loading live statistics…'}</div>;
  const k = stats.kpis;
  const perMinute = stats.perMinute.map((m) => ({
    ...m,
    label: new Date(m.minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }));
  const axis = { stroke: c.axis, fontSize: 11, tickLine: false };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="panel-title">{attacker ? 'Red-team scoreboard' : 'Security operations overview'}</div>
        <h1 className="text-2xl font-semibold text-white">
          Dashboard <span className="text-accent">{attacker ? '· What got through' : '· What we caught'}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Transactions today" value={fmtNum(k.transactionsToday)} sub={`${fmtINRCompact(k.volumeToday)} volume`} tone="plain" />
        {attacker ? (
          <>
            <KpiCard label="Undetected paths" value={fmtNum(k.slippedToday)} sub="fraud not flagged" tone="accent2" />
            <KpiCard label="Fraud attempts" value={fmtNum(k.fraudToday)} sub={`${fmtNum(k.caughtToday)} were caught`} />
            <KpiCard label="Evasion rate" value={fmtPct(k.fraudToday ? 1 - k.detectionRate : 0)} sub="share of fraud that slipped" tone="accent2" />
            <KpiCard label="Amount slipped" value={fmtINRCompact(k.amountSlipped)} sub="fraud value not stopped" />
          </>
        ) : (
          <>
            <KpiCard label="Detected threats" value={fmtNum(k.flaggedToday)} sub="flagged transactions" tone="danger" />
            <KpiCard label="Open alerts" value={fmtNum(k.openAlerts)} sub="awaiting analyst review" />
            <KpiCard label="Detection rate" value={fmtPct(k.detectionRate)} sub={`${fmtNum(k.caughtToday)} of ${fmtNum(k.fraudToday)} fraud caught`} tone="accent2" />
            <KpiCard label="Amount protected" value={fmtINRCompact(k.amountProtected)} sub="fraud value flagged" />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Transactions per minute · last 30 min">
          <ResponsiveContainer>
            <LineChart data={perMinute} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} yAxisId="l" />
              <YAxis {...axis} yAxisId="r" orientation="right" allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="l" type="monotone" dataKey="total" name="All transactions" stroke={c.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey={attacker ? 'slipped' : 'flagged'}
                name={attacker ? 'Slipped fraud' : 'Flagged'}
                stroke={attacker ? c.accent2 : c.danger}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        {attacker ? (
          <ChartPanel title="Caught vs slipped by attack type · today">
            <ResponsiveContainer>
              <BarChart data={stats.byAttackType.map((d) => ({ ...d, name: ATTACK_LABELS[d.type] || d.type }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} interval={0} fontSize={10} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="missed" name="Slipped through" stackId="a" fill={c.accent2} />
                <Bar dataKey="caught" name="Caught" stackId="a" fill={c.muted} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        ) : (
          <ChartPanel title="Alerts by suspected attack type · today">
            <ResponsiveContainer>
              <BarChart data={stats.alertsByPattern.map((d) => ({ ...d, name: ATTACK_LABELS[d.pattern] || d.pattern }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} interval={0} fontSize={10} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="Alerts" fill={c.accent} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="Risk score distribution · today (√ scale)">
          <ResponsiveContainer>
            <BarChart data={stats.riskDistribution} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="bucket" {...axis} fontSize={10} />
              <YAxis {...axis} scale="sqrt" domain={[0, 'auto']} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {stats.riskDistribution.map((d, i) => (
                  <Cell key={d.bucket} fill={i >= 6 ? c.danger : c.accent} fillOpacity={i >= 6 ? 0.9 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="panel flex flex-col justify-center gap-3 p-5">
          <div className="panel-title">{attacker ? 'Attacker briefing' : 'Defender briefing'}</div>
          {attacker ? (
            <p className="text-sm leading-relaxed text-slate-300">
              <span className="font-mono text-2xl text-accent2">{fmtNum(k.slippedToday)}</span> fraudulent transactions worth{' '}
              <span className="text-accent">{fmtINRCompact(k.amountSlipped)}</span> went unflagged today. Low-intensity attacks — slower pace, smaller amounts,
              familiar devices — are the undetected paths. Use the Attack Lab to probe them, and the Loop to see the defender adapt.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              The detector has flagged <span className="font-mono text-2xl text-rose-300">{fmtNum(k.flaggedToday)}</span> transactions today and caught{' '}
              <span className="text-accent2">{fmtPct(k.detectionRate)}</span> of synthetic fraud, protecting <span className="text-accent">{fmtINRCompact(k.amountProtected)}</span>.{' '}
              {k.openAlerts} alerts are waiting in the analyst queue.
            </p>
          )}
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((attacker ? 1 - k.detectionRate : k.detectionRate) * 100)}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{attacker ? 'Evasion' : 'Detection'}</span>
            <span>{fmtPct(attacker ? 1 - k.detectionRate : k.detectionRate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
