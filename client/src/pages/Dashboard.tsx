import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { fmtINRCompact, fmtNum, fmtPct } from '../lib/format';
import { usePalette, useTooltipStyle } from '../lib/theme';
import { ATTACK_LABELS } from '../lib/types';
import { useAppSelector } from '../store';
import { Figures, PageHeader, Section, Skeleton } from '../components/ui';

export interface Stats {
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

function DashboardSkeleton() {
  return (
    <div aria-label="Loading">
      <div className="grid grid-cols-2 gap-8 border-b border-line py-10 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-10 h-64 w-full" />
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const mode = useAppSelector((s) => s.ui.mode);
  const c = usePalette();
  const tip = useTooltipStyle();
  const attacker = mode === 'attacker';

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Stats>('/stats')
        .then((s) => {
          if (alive) {
            setStats(s);
            setError('');
          }
        })
        .catch((e) => alive && setError(e.message));
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const header = (
    <PageHeader
      eyebrow={attacker ? 'Attacker view, today' : 'Defender view, today'}
      serif={attacker ? 'Undetected' : 'Detected'}
      sans={attacker ? 'paths through the stream' : 'threats in the stream'}
      description={
        attacker
          ? 'The same traffic, read from the other side: how much fraud went unflagged and which patterns got through.'
          : 'Every synthetic payment is scored from 0 to 100 as it arrives. Scores of 60 or more raise an alert for an analyst.'
      }
    />
  );

  if (!stats)
    return (
      <>
        {header}
        {error ? <p className="py-10 text-signal">{error}</p> : <DashboardSkeleton />}
      </>
    );

  const k = stats.kpis;
  const perMinute = stats.perMinute.map((m) => ({
    ...m,
    label: new Date(m.minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
  }));
  const axis = { stroke: c.faint, fontSize: 11, tickLine: false, axisLine: false };

  const figures = attacker
    ? [
        { label: 'Transactions', value: fmtNum(k.transactionsToday), note: `${fmtINRCompact(k.volumeToday)} volume` },
        { label: 'Undetected paths', value: fmtNum(k.slippedToday), note: 'fraud not flagged', tone: 'accent' as const },
        { label: 'Fraud attempts', value: fmtNum(k.fraudToday), note: `${fmtNum(k.caughtToday)} caught` },
        { label: 'Evasion rate', value: fmtPct(k.fraudToday ? 1 - k.detectionRate : 0), note: 'share that slipped' },
        { label: 'Value slipped', value: fmtINRCompact(k.amountSlipped), note: 'not stopped' },
      ]
    : [
        { label: 'Transactions', value: fmtNum(k.transactionsToday), note: `${fmtINRCompact(k.volumeToday)} volume` },
        { label: 'Flagged', value: fmtNum(k.flaggedToday), note: 'scored 60 or more', tone: 'signal' as const },
        { label: 'Open alerts', value: fmtNum(k.openAlerts), note: 'awaiting review' },
        { label: 'Detection rate', value: fmtPct(k.detectionRate), note: `${fmtNum(k.caughtToday)} of ${fmtNum(k.fraudToday)} fraud`, tone: 'accent' as const },
        { label: 'Value protected', value: fmtINRCompact(k.amountProtected), note: 'fraud flagged' },
      ];

  const byType = attacker
    ? stats.byAttackType.map((d) => ({ name: ATTACK_LABELS[d.type] || d.type, value: d.missed, rest: d.caught }))
    : stats.alertsByPattern.map((d) => ({ name: ATTACK_LABELS[d.pattern] || d.pattern, value: d.count, rest: 0 }));

  return (
    <>
      {header}
      <section className="border-b border-line py-10">
        <Figures items={figures} />
      </section>

      <Section title="Transactions per minute, last 30 minutes" aside={attacker ? 'Line: slipped fraud' : 'Line: flagged'}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={perMinute} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={32} />
              <YAxis {...axis} yAxisId="l" />
              <YAxis {...axis} yAxisId="r" orientation="right" allowDecimals={false} />
              <Tooltip {...tip} />
              <Line yAxisId="l" type="monotone" dataKey="total" name="All transactions" stroke={c.muted} strokeWidth={1.25} dot={false} isAnimationActive={false} />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey={attacker ? 'slipped' : 'flagged'}
                name={attacker ? 'Slipped fraud' : 'Flagged'}
                stroke={attacker ? c.accent : c.signal}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 lg:gap-12">
        <Section title={attacker ? 'Slipped fraud by attack type' : 'Alerts by suspected type'}>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} horizontal={false} />
                <XAxis type="number" {...axis} allowDecimals={false} />
                <YAxis type="category" dataKey="name" {...axis} width={120} fontSize={12} stroke={c.muted} />
                <Tooltip {...tip} />
                <Bar dataKey="value" name={attacker ? 'Slipped' : 'Alerts'} fill={c.accent} barSize={10} isAnimationActive={false} />
                {attacker && <Bar dataKey="rest" name="Caught" fill={c.faint} barSize={10} isAnimationActive={false} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Risk score distribution" aside="Square-root scale">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={stats.riskDistribution} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="bucket" {...axis} fontSize={10} />
                <YAxis {...axis} scale="sqrt" domain={[0, 'auto']} allowDecimals={false} />
                <Tooltip {...tip} />
                <Bar dataKey="count" name="Transactions" isAnimationActive={false}>
                  {stats.riskDistribution.map((d, i) => (
                    <Cell key={d.bucket} fill={i >= 6 ? c.signal : c.muted} fillOpacity={i >= 6 ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </>
  );
}
