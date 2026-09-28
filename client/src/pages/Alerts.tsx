import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, ATTACK_TYPES, type Alert } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { clearAlertBadge } from '../store/feedSlice';
import { PageHeader, Risk, SkeletonRows } from '../components/ui';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed_fraud', label: 'Confirmed fraud' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'all', label: 'All' },
];

const STATUS_LABEL: Record<string, string> = { open: 'Open', confirmed_fraud: 'Confirmed fraud', false_positive: 'False positive' };

export default function Alerts() {
  const [status, setStatus] = useState('open');
  const [pattern, setPattern] = useState('all');
  const [data, setData] = useState<{ alerts: Alert[]; counts: Record<string, number> } | null>(null);
  const newAlerts = useAppSelector((s) => s.feed.newAlerts);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const load = useCallback(() => {
    setData(null);
    api<{ alerts: Alert[]; counts: Record<string, number> }>(`/alerts?status=${status}&pattern=${pattern}`).then(setData);
    dispatch(clearAlertBadge());
  }, [status, pattern, dispatch]);

  useEffect(load, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Analyst workflow"
        serif="Alert"
        sans="queue"
        description="Highest risk first. Open a case, weigh the evidence and decide: confirmed fraud or false positive."
        actions={
          newAlerts > 0 && (
            <button onClick={load} className="btn">
              Load {newAlerts} new
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line py-5">
        <div className="flex flex-wrap gap-6">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`text-[13.5px] ${status === s.value ? 'text-ink underline decoration-accent underline-offset-8' : 'text-muted hover:text-ink'}`}
            >
              {s.label}
              {data?.counts[s.value] !== undefined && <span className="ml-1.5 font-mono text-[12px] text-muted">{data.counts[s.value]}</span>}
            </button>
          ))}
        </div>
        <label className="w-56 text-[12px] text-muted">
          Suspected type
          <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="field mt-1 text-[14px]">
            <option value="all">All types</option>
            {ATTACK_TYPES.map((t) => (
              <option key={t} value={t}>
                {ATTACK_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="max-h-[calc(100vh-20rem)] overflow-auto">
        {!data ? (
          <SkeletonRows rows={10} cols={6} />
        ) : (
          <table className="data min-w-[720px]">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Time</th>
                <th>Account</th>
                <th>Merchant</th>
                <th className="!text-right">Amount</th>
                <th>Suspected</th>
                <th>Signals</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.map((a) => (
                <tr key={a._id} onClick={() => navigate(`/alerts/${a._id}`)} className="cursor-pointer hover:bg-surface" title={a.reasons.join('\n')}>
                  <td>
                    <Risk score={a.riskScore} />
                  </td>
                  <td className="font-mono text-[12px] text-muted">{fmtTime(a.timestamp)}</td>
                  <td className="font-mono text-[12px]">{a.accountId}</td>
                  <td>{a.merchant}</td>
                  <td className="text-right font-mono">{fmtINR(a.amount)}</td>
                  <td>{ATTACK_LABELS[a.suspectedPattern] || a.suspectedPattern}</td>
                  <td className="font-mono text-[12px] text-muted">{a.reasons.length}</td>
                  <td className={`text-[13px] ${a.status === 'open' ? 'text-ink' : a.status === 'confirmed_fraud' ? 'text-signal' : 'text-muted'}`}>
                    {STATUS_LABEL[a.status]}
                  </td>
                </tr>
              ))}
              {data.alerts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No alerts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
