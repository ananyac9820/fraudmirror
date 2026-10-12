import { Fragment, useEffect, useRef, useState } from 'react';
import { resultsToCsv } from '../../../server/src/engine/analyze.js';
import { api } from '../lib/api';
import { fmtDateTime, fmtFileTime, fmtINR, fmtINRCompact, fmtNum } from '../lib/format';
import { ATTACK_LABELS, type Analysis, type AnalysisListItem } from '../lib/types';
import { Figures, NumberedList, PageHeader, Risk, Section, Skeleton, SkeletonRows } from '../components/ui';

const SAMPLES = [
  { file: 'minimal-example.csv', note: '13 rows you can read and edit by hand' },
  { file: 'normal-day.csv', note: '300 ordinary payments, almost nothing to flag' },
  { file: 'card-testing-attack.csv', note: 'ordinary traffic with one card-testing burst, labelled' },
  { file: 'mixed-attacks.csv', note: 'all six attack patterns, labelled' },
  { file: 'sparkov-credit-card-slice.csv', note: 'excerpt of the public Sparkov credit-card dataset (CC0), labelled' },
];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Analyze() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<AnalysisListItem[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const loadHistory = () => api<AnalysisListItem[]>('/analysis').then(setHistory);
  useEffect(() => {
    loadHistory();
  }, []);

  const show = (a: Analysis) => {
    setOutput(a);
    setExpanded(null);
    setOnlyFlagged(a.summary.flagged > 0);
    setTimeout(() => outputRef.current?.scrollIntoView({ block: 'start' }), 0);
  };

  const choose = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (f.size > 2_000_000) return setError('That file is larger than 2 MB. Please upload at most 5,000 rows.');
    setFile({ name: f.name, text: await f.text() });
  };

  const useSample = async (name: string) => {
    setError('');
    const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
    setFile({ name, text: await res.text() });
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      show(await api<Analysis>('/analysis', { method: 'POST', body: { name: file.name, csv: file.text } }));
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    try {
      show(await api<Analysis>(`/analysis/${id}`));
    } finally {
      setBusy(false);
    }
  };

  const s = output?.summary;
  const rows = output ? (onlyFlagged ? output.results.filter((r) => r.flagged) : output.results) : [];
  const lineCount = file ? Math.max(0, file.text.trim().split(/\r?\n/).length - 1) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Custom input and output"
        serif="Analyze"
        sans="your own file"
        description="Upload a CSV of transactions. The server runs every row through the same detector that scores the live stream, saves the result, and gives you a scored file back."
      />

      <Section title="Input">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn" onClick={() => input.current?.click()}>
                Choose a CSV file
              </button>
              <button className="btn btn-primary" onClick={run} disabled={!file || busy}>
                {busy ? 'Analyzing' : 'Analyze'}
              </button>
            </div>
            <p className="mt-5 text-[14px] text-ink">
              {file ? (
                <>
                  <span className="font-mono text-[13px]">{file.name}</span>
                  <span className="text-muted">, {fmtNum(lineCount)} rows ready</span>
                </>
              ) : (
                <span className="text-muted">No file chosen yet.</span>
              )}
            </p>
            {error && <p className="mt-3 text-[14px] text-signal">{error}</p>}
            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              Required columns: <span className="font-mono text-[12px] text-ink">timestamp, accountId, amount</span>. Optional:{' '}
              <span className="font-mono text-[12px]">merchant, merchantCategory, channel, deviceId, city, txType, counterpartyId, accountAgeDays, isFraud</span>. Files in the public Sparkov
              format (<span className="font-mono text-[12px]">trans_date_trans_time, cc_num, amt, is_fraud</span>) are also accepted as they are. Up to
              5,000 rows. Use synthetic or anonymised data only.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-2">Sample input files</p>
            <ul className="border-t border-line">
              {SAMPLES.map((x) => (
                <li key={x.file} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line py-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] text-ink">{x.file}</div>
                    <div className="text-[12.5px] text-muted">{x.note}</div>
                  </div>
                  <div className="flex gap-5 text-[13px]">
                    <button className="link" onClick={() => useSample(x.file)}>
                      Use
                    </button>
                    <a className="link" href={`${import.meta.env.BASE_URL}samples/${x.file}`} download>
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <div ref={outputRef} />
      {busy && !output && (
        <div aria-label="Loading" className="py-10">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-8 h-48 w-full" />
        </div>
      )}

      {output && s && (
        <>
          <Section title={`Output for ${output.name}`} aside={`${fmtFileTime(s.from)} to ${fmtFileTime(s.to)}`}>
            <Figures
              items={[
                { label: 'Rows scored', value: fmtNum(s.rows), note: `${fmtNum(s.accounts)} accounts${s.skipped ? `, ${s.skipped} rows skipped` : ''}` },
                { label: 'Flagged', value: fmtNum(s.flagged), note: 'scored 60 or more', tone: 'signal' },
                { label: 'Value flagged', value: fmtINRCompact(s.flaggedAmount), note: `of ${fmtINRCompact(s.totalAmount)} total` },
                s.labelled
                  ? { label: 'Labelled fraud caught', value: `${s.labelled.caught}/${s.labelled.fraud}`, note: `${s.labelled.falsePositives} false positive${s.labelled.falsePositives === 1 ? '' : 's'}`, tone: 'accent' }
                  : { label: 'Highest risk', value: s.highestRisk, note: 'out of 100', tone: 'accent' },
              ]}
            />
            {Object.keys(s.byPattern).length > 0 && (
              <p className="mt-8 text-[14px] text-muted">
                Suspected patterns:{' '}
                {Object.entries(s.byPattern)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, n]) => `${ATTACK_LABELS[p] || p} (${n})`)
                  .join(', ')}
                .
              </p>
            )}
            {s.amountsConvertedFromUsd && (
              <p className="mt-3 text-[14px] text-muted">
                Recognised as the Sparkov credit-card dataset. Amounts were converted from US dollars at ₹{s.amountsConvertedFromUsd} to the dollar, and card numbers are
                shown by their last digits only.
              </p>
            )}
            {s.flagged === 0 && <p className="mt-8 text-[14px] text-muted">Nothing in this file reached the alert threshold.</p>}
            {output.warnings.length > 0 && (
              <ul className="mt-6 text-[13px] text-signal">
                {output.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={onlyFlagged ? 'Flagged rows' : 'All rows'}
            aside={
              <span className="flex gap-3">
                <button className="btn" onClick={() => setOnlyFlagged((v) => !v)}>
                  {onlyFlagged ? 'Show all rows' : 'Flagged only'}
                </button>
                <button className="btn btn-primary" onClick={() => download(`results-${output.name.replace(/\.csv$/i, '')}.csv`, resultsToCsv(output.results))}>
                  Download results CSV
                </button>
              </span>
            }
          >
            <div className="max-h-[32rem] overflow-auto">
              <table className="data min-w-[760px]">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Time</th>
                    <th>Account</th>
                    <th>Merchant</th>
                    <th>City</th>
                    <th className="!text-right">Amount</th>
                    <th className="!text-right">Risk</th>
                    <th>Suspected</th>
                    {s.labelled && <th>Label</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r) => (
                    <Fragment key={r.row}>
                      <tr onClick={() => setExpanded(expanded === r.row ? null : r.row)} className={`cursor-pointer hover:bg-surface ${r.flagged ? 'bg-signal/[0.07]' : ''}`}>
                        <td className="font-mono text-[12px] text-muted">{r.row}</td>
                        <td className="font-mono text-[12px] text-muted">{fmtFileTime(r.timestamp)}</td>
                        <td className="font-mono text-[12px]">{r.accountId}</td>
                        <td>{r.merchant}</td>
                        <td className="text-muted">{r.city}</td>
                        <td className="text-right font-mono">{fmtINR(r.amount)}</td>
                        <td className="text-right">
                          <Risk score={r.riskScore} />
                        </td>
                        <td className="text-[13px]">{r.flagged ? ATTACK_LABELS[r.suspectedPattern || ''] || r.suspectedPattern : <span className="text-faint">Clear</span>}</td>
                        {s.labelled && <td className={`text-[13px] ${r.label ? 'text-ink' : 'text-faint'}`}>{r.label ? 'Fraud' : 'Legitimate'}</td>}
                      </tr>
                      {expanded === r.row && (
                        <tr className="bg-surface">
                          <td colSpan={s.labelled ? 9 : 8} className="!whitespace-normal !py-5">
                            <p className="eyebrow mb-2">Detector reasons</p>
                            {r.reasons.length ? <NumberedList items={r.reasons} /> : <p className="text-muted">No risk signals triggered.</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-muted">
                        No flagged rows in this file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 500 && <p className="mt-4 text-[13px] text-muted">Showing the first 500 of {fmtNum(rows.length)} rows. The downloaded file contains all of them.</p>}
          </Section>
        </>
      )}

      <Section title="Saved analyses">
        {!history ? (
          <SkeletonRows rows={3} cols={4} />
        ) : history.length === 0 ? (
          <p className="text-[14px] text-muted">Nothing analyzed yet. Choose a file above, or try one of the samples.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Analyzed</th>
                <th>By</th>
                <th className="!text-right">Rows</th>
                <th className="!text-right">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id} onClick={() => open(h._id)} className="cursor-pointer hover:bg-surface">
                  <td className="font-mono text-[12.5px]">{h.name}</td>
                  <td className="text-muted">{fmtDateTime(h.createdAt)}</td>
                  <td className="text-muted">{h.uploadedByName}</td>
                  <td className="text-right font-mono">{fmtNum(h.summary.rows)}</td>
                  <td className="text-right font-mono text-signal">{fmtNum(h.summary.flagged)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
