import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { fmtPct } from '../lib/format';
import { tooltipStyle, usePalette } from '../lib/theme';
import { ATTACK_LABELS, ATTACK_TYPES, type LoopRound } from '../lib/types';
import { useAppSelector } from '../store';

interface LoopState {
  rounds: LoopRound[];
  config: { threshold: number; weights: Record<string, number>; params: Record<string, number> };
}

const rateCell = (r: number) =>
  r >= 0.7 ? 'bg-emerald-500/20 text-emerald-300' : r >= 0.4 ? 'bg-yellow-500/15 text-yellow-200' : 'bg-fuchsia-500/15 text-fuchsia-300';

export default function Loop() {
  const [state, setState] = useState<LoopState | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = useAppSelector((s) => s.ui.mode);
  const c = usePalette();
  const attacker = mode === 'attacker';

  const load = () => api<LoopState>('/loop/rounds').then(setState);
  useEffect(() => {
    load();
  }, []);

  const runRound = async () => {
    setBusy(true);
    try {
      await api('/loop/round', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await api('/loop/reset', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const rounds = state?.rounds || [];
  const latest = rounds[rounds.length - 1];
  const chartData = rounds.map((r) => ({
    gen: `G${r.generation}`,
    detection: Math.round(r.detectionRate * 100),
    evasion: Math.round((1 - r.detectionRate) * 100),
    fp: Math.round((r.falsePositiveRate || 0) * 1000) / 10,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="panel-title">Attack-and-defend loop</div>
          <h1 className="text-2xl font-semibold text-white">
            Loop <span className="text-accent">· {attacker ? 'the attacker evolves' : 'the defender adapts'}</span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Each generation the attacker mutates the attacks that slipped through last round (slower, smaller, fewer tells), then the defender tightens
            the rules that failed. Runs in a sandbox copy of the detector, so the live stream is not affected.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} disabled={busy || rounds.length === 0} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/30 disabled:opacity-40">
            Reset
          </button>
          <button
            onClick={runRound}
            disabled={busy}
            className="rounded-lg px-5 py-2 text-sm font-bold uppercase tracking-wider text-slate-950 hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', boxShadow: 'var(--glow)' }}
          >
            {busy ? 'Running…' : `▶ Run ${rounds.length ? 'next round' : 'round 1'}`}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel p-4">
          <div className="panel-title mb-3">{attacker ? 'Evasion rate' : 'Detection rate'} per generation (%)</div>
          <div className="h-72">
            {rounds.length ? (
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="gen" stroke={c.axis} fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke={c.axis} fontSize={11} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey={attacker ? 'evasion' : 'detection'}
                    name={attacker ? 'Evasion %' : 'Detection %'}
                    stroke={c.accent}
                    strokeWidth={3}
                    dot={{ r: 4, fill: c.accent }}
                  />
                  <Line type="monotone" dataKey="fp" name="False positives % (legit sample)" stroke={c.accent2} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                No rounds yet. Press “Run round 1” — the attacker starts with stealthy low-intensity attacks
                <br />
                that the baseline detector misses.
              </div>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <div className="panel-title mb-3">Latest generation by attack type</div>
          {latest ? (
            <div className="flex flex-col gap-1.5">
              {ATTACK_TYPES.map((t) => {
                const p = latest.perType[t];
                return (
                  <div key={t} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-slate-300">{ATTACK_LABELS[t]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${(p?.rate || 0) * 100}%` }} />
                    </div>
                    <span className={`w-14 rounded px-1.5 py-0.5 text-center font-mono text-xs ${rateCell(p?.rate || 0)}`}>{fmtPct(p?.rate || 0)}</span>
                  </div>
                );
              })}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/30 p-2">
                  <div className="font-mono text-xl text-white">G{latest.generation}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">generation</div>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                  <div className="font-mono text-xl text-accent">{fmtPct(latest.detectionRate)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">detected</div>
                </div>
                <div className="rounded-lg bg-black/30 p-2">
                  <div className="font-mono text-xl text-accent2">{((latest.falsePositiveRate || 0) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">false pos.</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Per-type detection appears after the first round.</p>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-title px-4 pt-4">Rounds</div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[900px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Gen</th>
                <th className="px-4 py-2 text-right">Attacks</th>
                <th className="px-4 py-2 text-right">Detected</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">False pos.</th>
                <th className="px-4 py-2">Attacker mutated</th>
                <th className="px-4 py-2">Defender tightened</th>
              </tr>
            </thead>
            <tbody>
              {[...rounds].reverse().map((r) => (
                <tr key={r._id} className="border-t border-white/[0.04] align-top">
                  <td className="px-4 py-2 font-mono text-accent">G{r.generation}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.attacksGenerated}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.detected}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${rateCell(r.detectionRate)}`}>{fmtPct(r.detectionRate)}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">{((r.falsePositiveRate || 0) * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-xs text-fuchsia-200/80">
                    {r.mutatedParams.attacker.length ? r.mutatedParams.attacker.map((a) => <div key={a} className="font-mono">{a}</div>) : <span className="text-slate-600">baseline (low-intensity presets)</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-emerald-200/80">
                    {r.mutatedParams.defender.length ? r.mutatedParams.defender.map((d) => <div key={d}>{d}</div>) : <span className="text-slate-600">no change needed</span>}
                  </td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No rounds run yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
