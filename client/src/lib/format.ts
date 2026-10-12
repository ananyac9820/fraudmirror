const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtINR = (n: number) => inr.format(n || 0);
export const fmtINRCompact = (n: number) => `₹${inrCompact.format(n || 0)}`;
export const fmtNum = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
export const fmtPct = (n: number) => `${Math.round((n || 0) * 100)}%`;
export const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
/** For uploaded files: show the clock time exactly as written in the file, whatever the viewer's time zone. */
export const fmtFileTime = (s: string) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false, timeZone: 'UTC' });
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false });

/** Risk is shown as a plain number; only the colour of the digits changes. */
export const riskClass = (score: number) => (score >= 60 ? 'text-signal' : score >= 30 ? 'text-ink' : 'text-faint');
