import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtDateTime, fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, type Alert, type Tx } from '../lib/types';
import { NumberedList, PageHeader, Risk, Section, Skeleton } from '../components/ui';

interface CaseFile {
  alert: Alert;
  transaction: Tx;
  history: Tx[];
  groundTruth: { isFraud: boolean; attackType: string | null } | null;
}

const Fact = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="border-b border-line py-3">
    <dt className="text-[12px] text-muted">{label}</dt>
    <dd className={`mt-1 ${mono ? 'font-mono text-[13px]' : 'text-[14px]'}`}>{value}</dd>
  </div>
);

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
      const r = await api<CaseFile>(`/alerts/${id}/review`, { method: 'PATCH', body: { decision, note } });
      setData((d) => (d ? { ...d, alert: r.alert, transaction: r.transaction, groundTruth: r.groundTruth } : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link to="/alerts" className="link mt-8 inline-block text-[13px]">
      Back to alert queue
    </Link>
  );

  if (error)
    return (
      <>
        {back}
        <p className="py-10 text-signal">{error}</p>
      </>
    );
  if (!data)
    return (
      <div aria-label="Loading">
        {back}
        <Skeleton className="mt-10 h-14 w-80" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    );

  const { alert, transaction: tx, history, groundTruth } = data;
  const open = alert.status === 'open';
  const right = groundTruth ? (alert.status === 'confirmed_fraud') === groundTruth.isFraud : null;

  return (
    <>
      {back}
      <PageHeader
        eyebrow={`Case ${tx.txId}, risk ${alert.riskScore}`}
        serif="Suspected"
        sans={(ATTACK_LABELS[alert.suspectedPattern] || alert.suspectedPattern).toLowerCase()}
      />

      <div className="grid gap-x-16 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Section title="Transaction">
            <dl className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
              <Fact label="Amount" value={<span className="text-[22px] text-accent">{fmtINR(tx.amount)}</span>} mono />
              <Fact label="Time" value={fmtDateTime(tx.timestamp)} />
              <Fact label="Type" value={tx.txType} />
              <Fact label="Account" value={tx.accountId} mono />
              <Fact label="Account age" value={`${tx.accountAgeDays ?? 'unknown'} days`} />
              <Fact label="Merchant" value={tx.merchant} />
              <Fact label="Channel" value={tx.channel.toUpperCase()} />
              <Fact label="Device" value={tx.deviceId} mono />
              <Fact label="City" value={tx.city} />
              {tx.counterpartyId && <Fact label="Sent to" value={tx.counterpartyId} mono />}
            </dl>
          </Section>

          <Section title={`Why it was flagged, ${alert.reasons.length} signals`}>
            <NumberedList items={alert.reasons} />
          </Section>

          <Section title={`Account history, last ${history.length}`}>
            <div className="overflow-x-auto">
              <table className="data min-w-[520px]">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Merchant</th>
                    <th>City</th>
                    <th>Device</th>
                    <th className="!text-right">Amount</th>
                    <th className="!text-right">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h._id} title={h.reasons.join('\n')}>
                      <td className="font-mono text-[12px] text-muted">{fmtTime(h.timestamp)}</td>
                      <td>{h.merchant}</td>
                      <td className={h.city !== tx.city ? 'text-accent' : 'text-muted'}>{h.city}</td>
                      <td className={`font-mono text-[12px] ${h.deviceId === tx.deviceId ? 'text-ink' : 'text-muted'}`}>{h.deviceId}</td>
                      <td className="text-right font-mono">{fmtINR(h.amount)}</td>
                      <td className="text-right">
                        <Risk score={h.riskScore} />
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted">
                        No earlier transactions. This account has no history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="py-10">
          <h2 className="eyebrow mb-6">Decision</h2>
          {open ? (
            <div className="flex flex-col gap-6">
              <label className="block text-[12px] text-muted">
                Case note
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="field mt-1 resize-none" placeholder="What convinced you?" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button disabled={busy} onClick={() => review('confirmed_fraud')} className="btn btn-primary">
                  Confirm fraud
                </button>
                <button disabled={busy} onClick={() => review('false_positive')} className="btn">
                  False positive
                </button>
              </div>
              <p className="text-[12.5px] text-muted">The ground truth stays hidden until you decide.</p>
            </div>
          ) : (
            <dl>
              <Fact label="Decision" value={alert.status === 'confirmed_fraud' ? 'Confirmed fraud' : 'False positive'} />
              <Fact label="Reviewed by" value={`${alert.reviewedByName}, ${alert.reviewedAt ? fmtDateTime(alert.reviewedAt) : ''}`} />
              {alert.reviewNote && <Fact label="Note" value={alert.reviewNote} />}
            </dl>
          )}

          {groundTruth && (
            <div className="row-in mt-10 border-t border-line-strong pt-6">
              <p className="eyebrow">Ground truth</p>
              <p className="mt-3 text-[20px] font-light leading-snug">
                {groundTruth.isFraud ? (
                  <>
                    Real fraud, <span className="display text-[24px]">{(ATTACK_LABELS[groundTruth.attackType || ''] || '').toLowerCase()}</span>
                  </>
                ) : (
                  <>
                    A <span className="display text-[24px]">legitimate</span> customer payment
                  </>
                )}
              </p>
              <p className={`mt-4 text-[14px] ${right ? 'text-accent' : 'text-signal'}`}>
                {right ? 'The analyst’s call was correct.' : 'The analyst’s call was wrong on this one.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
