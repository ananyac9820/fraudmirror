import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { fmtTime } from '../lib/format';
import { ATTACK_DESCRIPTIONS, ATTACK_LABELS, ATTACK_TYPES, type AttackRun } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { attackUpdate } from '../store/feedSlice';
import { Figures, PageHeader, Section, SkeletonRows } from '../components/ui';

type Intensity = 'low' | 'medium' | 'high';
const INTENSITY_NOTE: Record<Intensity, string> = {
  low: 'Slow pace, small amounts, familiar devices. Built to slip under the thresholds.',
  medium: 'Faster and larger, usually from a new device.',
  high: 'A rapid burst with obvious warning signs.',
};
const PARAM_LABEL: Record<string, string> = {
  count: 'transactions',
  amountMul: '× usual spend',
  hops: 'hops',
  newDevice: 'new device',
  newCity: 'new city',
  knownCities: 'known cities only',
};

export default function AttackLab() {
  const [type, setType] = useState<string>('card_testing');
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [presets, setPresets] = useState<Record<string, Record<Intensity, Record<string, number | boolean>>>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [latestId, setLatestId] = useState<string | null>(null);
  const runsMap = useAppSelector((s) => s.feed.attackRuns);
  const dispatch = useAppDispatch();

  useEffect(() => {
    api<{ runs: AttackRun[]; presets: typeof presets }>('/attacks').then((r) => {
      setPresets(r.presets);
      r.runs.forEach((run) => dispatch(attackUpdate(run)));
      if (r.runs[0]) setLatestId(r.runs[0]._id);
      setLoaded(true);
    });
  }, [dispatch]);

  const runs = useMemo(() => Object.values(runsMap).sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)), [runsMap]);
  const latest = latestId ? runsMap[latestId] : undefined;
  const done = latest && latest.emitted >= latest.count;

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

  const params = presets[type]?.[intensity];

  return (
    <>
      <PageHeader
        eyebrow="Red team"
        serif="Attack"
        sans="laboratory"
        description="Inject a burst of synthetic fraud into the live stream and see how much of it the detector catches. Nothing outside this simulator is touched."
      />

      <Section title="Pattern">
        <div className="grid border-t border-line md:grid-cols-2 md:gap-x-12">
          {ATTACK_TYPES.map((t, i) => {
            const active = type === t;
            return (
              <button key={t} onClick={() => setType(t)} aria-pressed={active} className={`flex gap-5 border-b border-line py-5 text-left ${active ? '' : 'hover:bg-surface'}`}>
                <span className={`font-mono text-[13px] ${active ? 'text-accent' : 'text-muted'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className={`block text-[16px] ${active ? 'display text-[22px] leading-none' : 'text-ink'}`}>{ATTACK_LABELS[t]}</span>
                  <span className="mt-1.5 block text-[13px] text-muted">{ATTACK_DESCRIPTIONS[t]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Intensity">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex border border-line-strong">
            {(['low', 'medium', 'high'] as Intensity[]).map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                aria-pressed={intensity === i}
                className={`h-10 px-5 text-[13px] capitalize ${intensity === i ? 'bg-accent font-medium text-accent-ink' : 'text-muted hover:text-ink'}`}
              >
                {i}
              </button>
            ))}
          </div>
          <p className="max-w-[44ch] text-[14px] text-muted">{INTENSITY_NOTE[intensity]}</p>
        </div>
        {params && (
          <p className="mt-5 font-mono text-[12px] text-muted">
            {Object.entries(params)
              .map(([k, v]) => {
                if (typeof v === 'boolean') return v ? PARAM_LABEL[k] : null;
                if (k === 'paceMs') return `${(v / 1000).toFixed(1)} s apart`;
                if (k === 'maxAmount') return `up to ₹${v}`;
                if (k === 'amount') return `₹${v.toLocaleString('en-IN')} each`;
                return `${v} ${PARAM_LABEL[k] || k}`;
              })
              .filter(Boolean)
              .join('   ·   ')}
          </p>
        )}
        <div className="mt-8 flex items-center gap-5">
          <button onClick={launch} disabled={busy} className="btn btn-primary">
            {busy ? 'Launching' : 'Launch simulated attack'}
          </button>
          {error && <span className="text-[13px] text-signal">{error}</span>}
        </div>
      </Section>

      <Section title="Latest run" aside={latest && `${ATTACK_LABELS[latest.attackType]}, ${latest.intensity}, ${done ? 'complete' : 'in progress'}`}>
        {latest ? (
          <>
            <Figures
              items={[
                { label: 'Launched', value: `${latest.emitted}/${latest.count}` },
                { label: 'Detected', value: latest.detectedCount, tone: 'accent' },
                { label: 'Slipped through', value: latest.emitted - latest.detectedCount, tone: 'signal' },
              ]}
            />
            {done && (
              <p className="mt-8 text-[15px] text-muted">
                {latest.detectedCount === 0
                  ? 'The detector missed the entire attack. Switch to the attacker view to see it in the feed.'
                  : `The detector flagged ${latest.detectedCount} of ${latest.count} transactions.`}
              </p>
            )}
          </>
        ) : (
          <p className="text-[14px] text-muted">Launch an attack to watch launched, detected and slipped counts update in real time.</p>
        )}
      </Section>

      <Section title="Recent runs">
        {!loaded ? (
          <SkeletonRows rows={4} cols={4} />
        ) : runs.length ? (
          <table className="data">
            <thead>
              <tr>
                <th>Started</th>
                <th>Pattern</th>
                <th>Intensity</th>
                <th className="!text-right">Detected</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r._id}>
                  <td className="font-mono text-[12px] text-muted">{fmtTime(r.startedAt)}</td>
                  <td>{ATTACK_LABELS[r.attackType]}</td>
                  <td className="capitalize text-muted">{r.intensity}</td>
                  <td className="text-right font-mono">
                    {r.detectedCount}
                    <span className="text-muted"> of {r.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[14px] text-muted">No attacks launched yet.</p>
        )}
      </Section>
    </>
  );
}
