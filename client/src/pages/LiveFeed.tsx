import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, type Tx } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { setInitial, togglePause } from '../store/feedSlice';
import RiskBadge from '../components/RiskBadge';

const CHANNEL_STYLE: Record<string, string> = {
  upi: 'text-emerald-300 bg-emerald-500/10',
  card: 'text-sky-300 bg-sky-500/10',
  netbanking: 'text-violet-300 bg-violet-500/10',
};

export default function LiveFeed() {
  const dispatch = useAppDispatch();
  const { items, paused, buffered } = useAppSelector((s) => s.feed);
  const mode = useAppSelector((s) => s.ui.mode);
  const role = useAppSelector((s) => s.auth.user?.role);
  const [onlyInteresting, setOnlyInteresting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const mountedAt = useRef(Date.now());
  const attacker = mode === 'attacker';
  const truthHidden = role === 'analyst';

  useEffect(() => {
    api<Tx[]>('/transactions?limit=150').then((txs) => dispatch(setInitial(txs)));
  }, [dispatch]);

  const slipped = (t: Tx) => t.isFraud === true && !t.flagged;

  const rows = useMemo(() => {
    if (!onlyInteresting) return items;
    return items.filter((t) => (attacker ? slipped(t) || (t.isFraud && t.flagged) : t.flagged));
  }, [items, onlyInteresting, attacker]);

  const counts = useMemo(
    () => ({
      flagged: items.filter((t) => t.flagged).length,
      slipped: items.filter(slipped).length,
      fraud: items.filter((t) => t.isFraud).length,
    }),
    [items]
  );

  const rowClass = (t: Tx) => {
    if (attacker) {
      if (slipped(t)) return 'bg-fuchsia-500/10 shadow-[inset_3px_0_0_#e879f9]';
      if (t.isFraud && t.flagged) return 'opacity-60 shadow-[inset_3px_0_0_#64748b]';
      return '';
    }
    if (t.flagged) return 'bg-rose-500/[0.07] shadow-[inset_3px_0_0_#f43f5e]';
    return '';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="panel-title">{attacker ? 'Attacker view' : 'Defender view'}</div>
          <h1 className="text-2xl font-semibold text-white">
            Live Feed <span className="text-accent">{attacker ? '· Undetected paths' : '· Detected threats'}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {attacker
              ? 'Magenta rows are fraud that slipped past the detector. Grey rows were caught.'
              : 'Every synthetic payment is scored 0–100 as it arrives. Scores of 60+ are flagged and raise an alert.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 font-mono text-xs">
            {attacker ? (
              <>
                <span className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1.5 text-fuchsia-300">slipped {counts.slipped}</span>
                <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-400">fraud {counts.fraud}</span>
              </>
            ) : (
              <span className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-rose-300">flagged {counts.flagged}</span>
            )}
            <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-400">rows {items.length}</span>
          </div>
          <button
            onClick={() => setOnlyInteresting((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${onlyInteresting ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-300 hover:border-white/30'}`}
          >
            {attacker ? 'Fraud only' : 'Flagged only'}
          </button>
          <button
            onClick={() => dispatch(togglePause())}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${paused ? 'bg-accent text-slate-950' : 'border border-white/10 text-slate-200 hover:border-white/30'}`}
          >
            {paused ? `▶ Resume${buffered.length ? ` (+${buffered.length})` : ''}` : '❚❚ Pause'}
          </button>
        </div>
      </div>

      {attacker && truthHidden && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          Ground truth is hidden for the analyst role, so slipped fraud can't be shown here. Sign in as red team or admin to see the attacker's view.
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 z-10 bg-[#0b111a] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Transaction</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5">Merchant</th>
                <th className="px-3 py-2.5">City</th>
                <th className="px-3 py-2.5">Channel</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-center">Risk</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const isNew = new Date(t.timestamp).getTime() > mountedAt.current;
                const open = expanded === t._id;
                return (
                  <Fragment key={t._id}>
                    <tr
                      onClick={() => setExpanded(open ? null : t._id)}
                      title={t.reasons.length ? t.reasons.join('\n') : 'No risk signals'}
                      className={`cursor-pointer border-t border-white/[0.04] hover:bg-white/[0.03] ${rowClass(t)} ${isNew ? 'row-in' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{fmtTime(t.timestamp)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{t.txId}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{t.accountId}</td>
                      <td className="px-3 py-2">
                        <div className="text-slate-200">{t.merchant}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.merchantCategory}
                          {t.txType !== 'payment' && <span className="ml-1 uppercase text-amber-300">· {t.txType}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{t.city}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${CHANNEL_STYLE[t.channel]}`}>{t.channel}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-100">{fmtINR(t.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <RiskBadge score={t.riskScore} />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {attacker && t.isFraud !== undefined ? (
                          slipped(t) ? (
                            <span className="font-semibold text-fuchsia-300">SLIPPED · {ATTACK_LABELS[t.attackType || ''] || t.attackType}</span>
                          ) : t.isFraud ? (
                            <span className="text-slate-400">caught · {ATTACK_LABELS[t.attackType || '']}</span>
                          ) : (
                            <span className="text-slate-600">legit</span>
                          )
                        ) : t.flagged ? (
                          <span className="font-semibold text-rose-300">FLAGGED</span>
                        ) : (
                          <span className="text-slate-600">clear</span>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-black/30">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="grid gap-3 text-xs sm:grid-cols-[1fr_auto]">
                            <div>
                              <div className="panel-title mb-1.5">Detector reasons</div>
                              {t.reasons.length ? (
                                <ul className="flex flex-col gap-1">
                                  {t.reasons.map((r) => (
                                    <li key={r} className="flex gap-2 text-slate-200">
                                      <span className="text-accent">▸</span>
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-slate-500">No risk signals triggered.</span>
                              )}
                            </div>
                            <div className="font-mono text-slate-400">
                              <div>device {t.deviceId}</div>
                              <div>account age {t.accountAgeDays ?? '–'} days</div>
                              {t.counterpartyId && <div>to {t.counterpartyId}</div>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    Waiting for transactions…
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
