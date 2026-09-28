const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtINR = (n: number) => inr.format(n || 0);
export const fmtINRCompact = (n: number) => `₹${inrCompact.format(n || 0)}`;
export const fmtNum = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
export const fmtPct = (n: number) => `${Math.round((n || 0) * 100)}%`;
export const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false });

export const riskColor = (score: number) =>
  score >= 80 ? 'text-rose-300 bg-rose-500/15 border-rose-500/40'
  : score >= 60 ? 'text-orange-300 bg-orange-500/15 border-orange-500/40'
  : score >= 30 ? 'text-yellow-200 bg-yellow-500/10 border-yellow-500/30'
  : 'text-slate-400 bg-slate-500/10 border-slate-500/20';
