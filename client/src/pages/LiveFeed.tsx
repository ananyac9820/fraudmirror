import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtINR, fmtTime } from '../lib/format';
import { ATTACK_LABELS, type Tx } from '../lib/types';
import { useAppDispatch, useAppSelector } from '../store';
import { setInitial, togglePause } from '../store/feedSlice';
import { NumberedList, PageHeader, Risk, SkeletonRows } from '../components/ui';

const slipped = (t: Tx) => t.isFraud === true && !t.flagged;

export default function LiveFeed() {
  const dispatch = useAppDispatch();
  const { items, paused, buffered } = useAppSelector((s) => s.feed);
  const mode = useAppSelector((s) => s.ui.mode);
  const role = useAppSelector((s) => s.auth.user?.role);
  const [onlyInteresting, setOnlyInteresting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<Tx[]>([]);
  const mountedAt = useRef(Date.now());
  const attacker = mode === 'attacker';

  useEffect(() => {
    api<Tx[]>('/transactions?limit=150').then((txs) => {
      dispatch(setInitial(txs));
      setLoaded(true);
    });
  }, [dispatch]);

  // The filtered view also pulls older flagged / slipped rows, so it is never empty for long
  useEffect(() => {
    if (!onlyInteresting) return;
    const paths = attacker ? ['/transactions?flagged=true&limit=100', '/transactions?slipped=true&limit=100'] : ['/transactions?flagged=true&limit=150'];
    Promise.all(paths.map((p) => api<Tx[]>(p))).then((lists) => setHistory(lists.flat()));
  }, [onlyInteresting, attacker]);

  const rows = useMemo(() => {
    if (!onlyInteresting) return items;
    const seen = new Set<string>();
    return [...items, ...history]
      .filter((t) => (attacker ? t.isFraud : t.flagged) && !seen.has(t._id) && seen.add(t._id))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [items, history, onlyInteresting, attacker]);

  const status = (t: Tx) => {
    if (attacker && t.isFraud !== undefined) {
      if (slipped(t)) return <span className="text-accent">Slipped, {ATTACK_LABELS[t.attackType || '']?.toLowerCase()}</span>;
      if (t.isFraud) return <span className="text-muted">Caught</span>;
      return <span className="text-faint">Legitimate</span>;
    }
    return t.flagged ? <span className="text-signal">Flagged</span> : <span className="text-faint">Clear</span>;
  };

  const tint = (t: Tx) => (attacker ? (slipped(t) ? 'bg-accent/[0.08]' : '') : t.flagged ? 'bg-signal/[0.07]' : '');

  return (
    <>
      <PageHeader
        eyebrow={attacker ? 'Attacker view' : 'Defender view'}
        serif="Live"
        sans="transaction feed"
        description={
          attacker
            ? 'Highlighted rows are fraud the detector let through. Fraud that was caught is shown in grey.'
            : 'New payments arrive every 800 ms. Highlighted rows scored 60 or more. Select a row to read the detector’s reasons.'
        }
        actions={
          <>
            <button onClick={() => setOnlyInteresting((v) => !v)} className="btn" aria-pressed={onlyInteresting}>
              {onlyInteresting ? 'Show all' : attacker ? 'Fraud only' : 'Flagged only'}
            </button>
            <button onClick={() => dispatch(togglePause())} className={`btn ${paused ? 'btn-primary' : ''}`}>
              {paused ? `Resume${buffered.length ? ` (${buffered.length} waiting)` : ''}` : 'Pause'}
            </button>
          </>
        }
      />

      {attacker && role === 'analyst' && (
        <p className="border-b border-line py-4 text-[14px] text-muted">
          Analysts do not receive ground truth, so slipped fraud cannot be highlighted here. Sign in as red team or admin for the attacker view.
        </p>
      )}

      <div className="max-h-[calc(100vh-18rem)] overflow-auto">
        {!loaded ? (
          <SkeletonRows rows={10} cols={7} />
        ) : (
          <table className="data min-w-[760px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Account</th>
                <th>Merchant</th>
                <th>City</th>
                <th>Channel</th>
                <th className="!text-right">Amount</th>
                <th className="!text-right">Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const isNew = new Date(t.timestamp).getTime() > mountedAt.current;
                const open = expanded === t._id;
                return (
                  <Fragment key={t._id}>
                    <tr onClick={() => setExpanded(open ? null : t._id)} className={`cursor-pointer hover:bg-surface ${tint(t)} ${isNew ? 'row-in' : ''}`}>
                      <td className="whitespace-nowrap font-mono text-[12px] text-muted">{fmtTime(t.timestamp)}</td>
                      <td className="font-mono text-[12px]">{t.accountId}</td>
                      <td>
                        {t.merchant}
                        {t.txType !== 'payment' && <span className="ml-2 text-[11px] uppercase tracking-wider text-muted">{t.txType}</span>}
                      </td>
                      <td className="text-muted">{t.city}</td>
                      <td className="text-[12px] uppercase tracking-wider text-muted">{t.channel}</td>
                      <td className="text-right font-mono">{fmtINR(t.amount)}</td>
                      <td className="text-right">
                        <Risk score={t.riskScore} />
                      </td>
                      <td className="whitespace-nowrap text-[13px]">{status(t)}</td>
                    </tr>
                    {open && (
                      <tr className="bg-surface">
                        <td colSpan={8} className="!py-5">
                          <div className="grid gap-6 md:grid-cols-[1fr_240px]">
                            <div>
                              <p className="eyebrow mb-2">Detector reasons</p>
                              {t.reasons.length ? <NumberedList items={t.reasons} /> : <p className="text-muted">No risk signals triggered.</p>}
                            </div>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] md:grid-cols-1">
                              <div>
                                <dt className="text-muted">Transaction</dt>
                                <dd className="font-mono">{t.txId}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Device</dt>
                                <dd className="font-mono">{t.deviceId}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Account age</dt>
                                <dd>{t.accountAgeDays ?? 'unknown'} days</dd>
                              </div>
                              {t.counterpartyId && (
                                <div>
                                  <dt className="text-muted">Sent to</dt>
                                  <dd className="font-mono">{t.counterpartyId}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    {onlyInteresting ? 'No matching transactions yet. They will appear here as they arrive.' : 'Nothing to show yet. New transactions will appear here.'}
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
