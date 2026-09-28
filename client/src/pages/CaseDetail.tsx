import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtDateTime, fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, type Alert, type Tx } from '../lib/types';
import RiskBadge from '../components/RiskBadge';

interface CaseFile {
  alert: Alert;
  transaction: Tx;
  history: Tx[];
  groundTruth: { isFraud: boolean; attackType: string | null } | null;
  correct?: boolean;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-slate-100 ${mono ? 'font-mono text-sm' : ''}`}>{value}</div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const [data, setData] = useState<CaseFile | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<CaseFile>(`/alerts/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  const review = async (decision: 'confirmed_fraud' | 'false_positive') => {
    setBusy(true);
    try {
      const r = await api<CaseFile & { correct: boolean }>(`/alerts/${id}/review`, { method: 'PATCH', body: { decision, note } });
      setData((d) => (d ? { ...d, alert: r.alert, transaction: r.transaction, groundTruth: r.groundTruth, correct: r.correct } : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="panel p-6 text-rose-300">{error}</div>;
  if (!data) return <div className="panel p-6 text-slate-400">Loading case file…</div>;
  const { alert, transaction: tx, history, groundTruth } = data;
  const open = alert.status === 'open';

  return (
    <div className="flex flex-col gap-4">
      <Link to="/alerts" className="w-fit text-sm text-slate-400 hover:text-accent">
        ← Back to alert queue
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge score={alert.riskScore} className="!text-lg !px-3" />
        <div>
          <div className="panel-title">Case file · {tx.txId}</div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            Suspected <span className="text-accent">{ATTACK_LABELS[alert.suspectedPattern] || alert.suspectedPattern}</span>
          </h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <Field label="Amount" value={<span className="text-xl text-accent">{fmtINR(tx.amount)}</span>} mono />
            <Field label="Time" value={fmtDateTime(tx.timestamp)} />
            <Field label="Type" value={tx.txType} />
            <Field label="Account" value={tx.accountId} mono />
            <Field label="Account age" value={`${tx.accountAgeDays ?? '–'} days`} />
            <Field label="Merchant" value={`${tx.merchant} · ${tx.merchantCategory}`} />
            <Field label="Channel" value={tx.channel.toUpperCase()} />
            <Field label="Device" value={tx.deviceId} mono />
            <Field label="City" value={tx.city} />
            {tx.counterpartyId && <Field label="Sent to" value={tx.counterpartyId} mono />}
          </div>

          <div className="panel p-5">
            <div className="panel-title mb-3">Why the detector flagged this ({alert.reasons.length} signals)</div>
            <ul className="flex flex-col gap-2">
              {alert.reasons.map((r) => (
                <li key={r} className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-slate-200">
                  <span className="mt-0.5 text-accent">▸</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-title px-5 pt-4">Account history · last {history.length} transactions</div>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[560px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Merchant</th>
                    <th className="px-4 py-2">City</th>
                    <th className="px-4 py-2">Device</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h._id} className="border-t border-white/[0.04]" title={h.reasons.join('\n')}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-400">{fmtTime(h.timestamp)}</td>
                      <td className="px-4 py-2 text-slate-200">{h.merchant}</td>
                      <td className={`px-4 py-2 ${h.city !== tx.city ? 'text-amber-300' : 'text-slate-300'}`}>{h.city}</td>
                      <td className={`px-4 py-2 font-mono text-xs ${h.deviceId !== tx.deviceId ? 'text-slate-500' : 'text-accent'}`}>{h.deviceId}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-100">{fmtINR(h.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <RiskBadge score={h.riskScore} />
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No earlier transactions — this account has no history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-5" style={{ boxShadow: open ? 'var(--glow)' : undefined }}>
            <div className="panel-title mb-3">Analyst decision</div>
            {open ? (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Case note: what convinced you?"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    disabled={busy}
                    onClick={() => review('confirmed_fraud')}
                    className="rounded-lg bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
                  >
                    Confirm fraud
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => review('false_positive')}
                    className="rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    False positive
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">Ground truth stays hidden until you decide.</p>
              </>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <div>
                  Decision:{' '}
                  <span className={alert.status === 'confirmed_fraud' ? 'font-semibold text-rose-300' : 'font-semibold text-slate-200'}>
                    {alert.status === 'confirmed_fraud' ? 'Confirmed fraud' : 'False positive'}
                  </span>
                </div>
                <div className="text-slate-400">
                  by {alert.reviewedByName} · {alert.reviewedAt && fmtDateTime(alert.reviewedAt)}
                </div>
                {alert.reviewNote && <div className="rounded-lg bg-black/30 px-3 py-2 text-slate-300">“{alert.reviewNote}”</div>}
              </div>
            )}
          </div>

          {groundTruth && (
            <div
              className={`panel row-in p-5 ${
                (alert.status === 'confirmed_fraud') === groundTruth.isFraud ? 'border-emerald-400/40' : 'border-amber-400/40'
              }`}
            >
              <div className="panel-title mb-2">Ground truth revealed</div>
              <div className="text-lg font-semibold text-white">
                {groundTruth.isFraud ? (
                  <>
                    Real fraud: <span className="text-rose-300">{ATTACK_LABELS[groundTruth.attackType || ''] || groundTruth.attackType}</span>
                  </>
                ) : (
                  <span className="text-emerald-300">Legitimate customer transaction</span>
                )}
              </div>
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  (alert.status === 'confirmed_fraud') === groundTruth.isFraud ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {(alert.status === 'confirmed_fraud') === groundTruth.isFraud ? '✓ The analyst was right' : '✗ The analyst got this one wrong'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
