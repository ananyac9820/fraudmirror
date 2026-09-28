import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, ATTACK_TYPES, type Alert } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { clearAlertBadge } from '../store/feedSlice';
import RiskBadge from '../components/RiskBadge';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed_fraud', label: 'Confirmed fraud' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'all', label: 'All' },
];

const STATUS_STYLE: Record<string, string> = {
  open: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  confirmed_fraud: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  false_positive: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
};

export default function Alerts() {
  const [status, setStatus] = useState('open');
  const [pattern, setPattern] = useState('all');
  const [data, setData] = useState<{ alerts: Alert[]; counts: Record<string, number> } | null>(null);
  const newAlerts = useAppSelector((s) => s.feed.newAlerts);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const load = useCallback(() => {
    api<{ alerts: Alert[]; counts: Record<string, number> }>(`/alerts?status=${status}&pattern=${pattern}`).then(setData);
    dispatch(clearAlertBadge());
  }, [status, pattern, dispatch]);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="panel-title">Analyst workflow</div>
          <h1 className="text-2xl font-semibold text-white">
            Alert queue <span className="text-accent">· sorted by risk</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Open a case, weigh the evidence, then confirm fraud or dismiss it as a false positive.</p>
        </div>
        {newAlerts > 0 && (
          <button onClick={load} className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300">
            {newAlerts} new alert{newAlerts > 1 ? 's' : ''} · refresh
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${status === s.value ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-300 hover:border-white/30'}`}
          >
            {s.label}
            {data?.counts[s.value] !== undefined && <span className="ml-1.5 font-mono opacity-70">{data.counts[s.value]}</span>}
          </button>
        ))}
        <select
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="ml-auto rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-accent"
        >
          <option value="all">All suspected types</option>
          {ATTACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {ATTACK_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-[#0b111a] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-center">Risk</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5">Merchant</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5">Suspected</th>
                <th className="px-3 py-2.5">Top reason</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.alerts.map((a) => (
                <tr key={a._id} onClick={() => navigate(`/alerts/${a._id}`)} className="cursor-pointer border-t border-white/[0.04] hover:bg-accent/5">
                  <td className="px-3 py-2.5 text-center">
                    <RiskBadge score={a.riskScore} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{fmtTime(a.timestamp)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{a.accountId}</td>
                  <td className="px-3 py-2.5 text-slate-200">{a.merchant}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-100">{fmtINR(a.amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-accent">{ATTACK_LABELS[a.suspectedPattern] || a.suspectedPattern}</td>
                  <td className="max-w-[280px] truncate px-3 py-2.5 text-xs text-slate-400" title={a.reasons.join('\n')}>
                    {a.reasons[0]}
                    {a.reasons.length > 1 && <span className="ml-1 text-slate-600">+{a.reasons.length - 1}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLE[a.status]}`}>{a.status.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
              {data && data.alerts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    No alerts match these filters.
                  </td>
                </tr>
              )}
              {!data && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    Loading alerts…
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
