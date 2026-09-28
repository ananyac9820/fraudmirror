import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { fmtPct } from '../lib/format';
import { usePalette, useTooltipStyle } from '../lib/theme';
import { ATTACK_LABELS, ATTACK_TYPES, type LoopRound } from '../lib/types';
import { useAppSelector } from '../store';
import { Figures, PageHeader, Section, Skeleton } from '../components/ui';

export default function Loop() {
  const [rounds, setRounds] = useState<LoopRound[] | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = useAppSelector((s) => s.ui.mode);
  const c = usePalette();
  const tip = useTooltipStyle();
  const attacker = mode === 'attacker';

  const load = () => api<{ rounds: LoopRound[] }>('/loop/rounds').then((r) => setRounds(r.rounds));
  useEffect(() => {
    load();
  }, []);

  const act = async (path: string) => {
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const list = rounds || [];
  const latest = list[list.length - 1];
  const chartData = list.map((r) => ({
    gen: `G${r.generation}`,
    rate: Math.round((attacker ? 1 - r.detectionRate : r.detectionRate) * 100),
    fp: Math.round((r.falsePositiveRate || 0) * 1000) / 10,
  }));
  const axis = { stroke: c.faint, fontSize: 11, tickLine: false, axisLine: false };

  return (
    <>
      <PageHeader
        eyebrow="Attack and defend"
        serif={attacker ? 'The attacker' : 'The defender'}
        sans={attacker ? 'evolves' : 'adapts'}
        description="Each generation the attacker reworks whatever slipped through last time, making it slower, smaller and quieter. The defender then tightens the rules that failed. This runs on a sandbox copy of the detector, so the live stream is unaffected."
        actions={
          <>
            <button onClick={() => act('/loop/reset')} disabled={busy || list.length === 0} className="btn">
              Reset
            </button>
            <button onClick={() => act('/loop/round')} disabled={busy} className="btn btn-primary">
              {busy ? 'Running' : list.length ? `Run generation ${list.length + 1}` : 'Run generation 1'}
            </button>
          </>
        }
      />

      {!rounds ? (
        <div aria-label="Loading">
          <Skeleton className="mt-10 h-72 w-full" />
        </div>
      ) : list.length === 0 ? (
        <section className="border-b border-line py-16">
          <p className="max-w-[52ch] text-[17px] font-light leading-relaxed">
            No generations yet. The attacker starts with the stealthy low-intensity presets, which the baseline detector misses entirely.
          </p>
        </section>
      ) : (
        <>
          <section className="border-b border-line py-10">
            <Figures
              items={[
                { label: 'Generation', value: latest.generation },
                { label: attacker ? 'Evasion rate' : 'Detection rate', value: fmtPct(attacker ? 1 - latest.detectionRate : latest.detectionRate), tone: 'accent' },
                { label: 'Attack transactions', value: latest.attacksGenerated },
                { label: 'False positives', value: `${((latest.falsePositiveRate || 0) * 100).toFixed(1)}%`, note: 'on 3,000 legitimate payments', tone: 'signal' },
              ]}
            />
          </section>

          <Section title={`${attacker ? 'Evasion' : 'Detection'} rate per generation`} aside="Dashed: false-positive rate">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="gen" {...axis} />
                  <YAxis domain={[0, 100]} {...axis} unit="%" />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="rate" name={attacker ? 'Evasion %' : 'Detection %'} stroke={c.accent} strokeWidth={2} dot={{ r: 3, fill: c.accent, strokeWidth: 0 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="fp" name="False positives %" stroke={c.signal} strokeWidth={1.25} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title={`Generation ${latest.generation} by pattern`}>
            <div className="grid gap-x-12 md:grid-cols-2">
              {ATTACK_TYPES.map((t) => {
                const rate = latest.perType[t]?.rate || 0;
                return (
                  <div key={t} className="flex items-center gap-4 border-b border-line py-3">
                    <span className="w-36 shrink-0 text-[14px]">{ATTACK_LABELS[t]}</span>
                    <div className="h-px flex-1 bg-line-strong">
                      <div className="h-[3px] -translate-y-px bg-accent" style={{ width: `${rate * 100}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono text-[13px] text-muted">{fmtPct(rate)}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="History">
            <div className="overflow-x-auto">
              <table className="data min-w-[860px]">
                <thead>
                  <tr>
                    <th>Gen</th>
                    <th className="!text-right">Detected</th>
                    <th className="!text-right">False pos.</th>
                    <th>Attacker reworked</th>
                    <th>Defender tightened</th>
                  </tr>
                </thead>
                <tbody>
                  {[...list].reverse().map((r) => (
                    <tr key={r._id} className="align-top">
                      <td className="font-mono text-accent">G{r.generation}</td>
                      <td className="text-right font-mono">
                        {fmtPct(r.detectionRate)}
                        <span className="block text-[11px] text-muted">
                          {r.detected} of {r.attacksGenerated}
                        </span>
                      </td>
                      <td className="text-right font-mono text-muted">{((r.falsePositiveRate || 0) * 100).toFixed(1)}%</td>
                      <td className="!whitespace-normal text-[12.5px] text-muted">
                        {r.mutatedParams.attacker.length ? r.mutatedParams.attacker.map((a) => <div key={a}>{a}</div>) : 'Baseline low-intensity presets'}
                      </td>
                      <td className="!whitespace-normal text-[12.5px] text-muted">
                        {r.mutatedParams.defender.length ? r.mutatedParams.defender.map((d) => <div key={d}>{d}</div>) : 'No change needed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
