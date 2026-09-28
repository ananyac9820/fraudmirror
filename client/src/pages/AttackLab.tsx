import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { fmtTime } from '../lib/format';
import { ATTACK_DESCRIPTIONS, ATTACK_LABELS, ATTACK_TYPES, type AttackRun } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { attackUpdate } from '../store/feedSlice';

type Intensity = 'low' | 'medium' | 'high';
const INTENSITY_NOTE: Record<Intensity, string> = {
  low: 'Stealthy: slow pace, small amounts, familiar devices. Built to slip through.',
  medium: 'Noticeable: faster, bigger, often a new device.',
  high: 'Loud: rapid-fire burst with obvious red flags.',
};

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-black/30 p-4 text-center">
      <div className={`font-mono text-4xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}

export default function AttackLab() {
  const [type, setType] = useState<string>('card_testing');
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [presets, setPresets] = useState<Record<string, Record<Intensity, Record<string, number | boolean>>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [latestId, setLatestId] = useState<string | null>(null);
  const runsMap = useAppSelector((s) => s.feed.attackRuns);
  const mode = useAppSelector((s) => s.ui.mode);
  const dispatch = useAppDispatch();

  useEffect(() => {
    api<{ runs: AttackRun[]; presets: typeof presets }>('/attacks').then((r) => {
      setPresets(r.presets);
      r.runs.forEach((run) => dispatch(attackUpdate(run)));
      if (r.runs[0]) setLatestId(r.runs[0]._id);
    });
  }, [dispatch]);

  const runs = useMemo(() => Object.values(runsMap).sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)), [runsMap]);
  const latest = latestId ? runsMap[latestId] : undefined;

  const launch = async () => {
    setBusy(true);
    setError('');
    try {
      const run = await api<AttackRun>('/attacks/launch', { method: 'POST', body: { attackType: type, intensity } });
      dispatch(attackUpdate(run));
      setLatestId(run._id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const slipped = latest ? latest.emitted - latest.detectedCount : 0;
  const done = latest && latest.emitted >= latest.count;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="panel-title">Red team</div>
        <h1 className="text-2xl font-semibold text-white">
          Attack Lab <span className="text-accent">· inject simulated fraud</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Attacks are synthetic transaction patterns injected into the live stream — no real systems are touched. Watch whether the detector catches them.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="panel p-5">
          <div className="panel-title mb-3">1 · Choose an attack pattern</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ATTACK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl border p-3 text-left ${type === t ? 'border-accent bg-accent/10' : 'border-white/10 bg-black/20 hover:border-white/25'}`}
                style={{ boxShadow: type === t ? 'var(--glow)' : undefined }}
              >
                <div className={`font-semibold ${type === t ? 'text-accent' : 'text-slate-100'}`}>{ATTACK_LABELS[t]}</div>
                <div className="mt-1 text-xs leading-snug text-slate-400">{ATTACK_DESCRIPTIONS[t]}</div>
              </button>
            ))}
          </div>

          <div className="panel-title mb-2 mt-5">2 · Intensity</div>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as Intensity[]).map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={`rounded-lg border py-2 text-sm font-semibold uppercase tracking-wider ${
                  intensity === i ? 'border-accent2 bg-accent2/15 text-accent2' : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">{INTENSITY_NOTE[intensity]}</p>
          {presets[type] && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(presets[type][intensity]).map(([k, v]) => (
                <span key={k} className="rounded bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                  {k}={String(v)}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={launch}
            disabled={busy}
            className="mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-950 hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', boxShadow: 'var(--glow)' }}
          >
            {busy ? 'Launching…' : '⚡ Launch simulated attack'}
          </button>
          {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-5">
            <div className="panel-title mb-3 flex items-center gap-2">
              Live counter
              {latest && !done && <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />}
            </div>
            {latest ? (
              <>
                <div className="mb-3 text-sm text-slate-300">
                  <span className="font-semibold text-white">{ATTACK_LABELS[latest.attackType]}</span> · {latest.intensity} ·{' '}
                  <span className="text-slate-500">{done ? 'complete' : 'in progress'}</span>
                </div>
                <div className="flex gap-3">
                  <Counter label={`launched / ${latest.count}`} value={latest.emitted} tone="text-white" />
                  <Counter label="detected" value={latest.detectedCount} tone="text-emerald-300" />
                  <Counter label="slipped" value={slipped} tone="text-fuchsia-300" />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-slate-400/60 transition-all" style={{ width: `${(latest.emitted / Math.max(1, latest.count)) * 100}%` }} />
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {done
                    ? latest.detectedCount === 0
                      ? mode === 'attacker'
                        ? 'Clean run — nothing was flagged. An undetected path.'
                        : 'The detector missed this entire attack. Try the Loop to tighten the rules.'
                      : `The detector flagged ${latest.detectedCount} of ${latest.count} transactions.`
                    : 'Transactions are being injected into the live stream…'}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Launch an attack to see launched vs detected counts update in real time.</p>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-title px-5 pt-4">Recent runs</div>
            <div className="max-h-72 overflow-auto">
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {runs.map((r) => (
                    <tr key={r._id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{fmtTime(r.startedAt)}</td>
                      <td className="px-4 py-2 text-slate-200">{ATTACK_LABELS[r.attackType]}</td>
                      <td className="px-4 py-2 text-xs uppercase text-slate-400">{r.intensity}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        <span className="text-emerald-300">{r.detectedCount}</span>
                        <span className="text-slate-600"> / {r.count}</span>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500">No attacks launched yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
