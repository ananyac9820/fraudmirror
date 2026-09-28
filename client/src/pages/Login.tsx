import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { login } from '../store/authSlice';

const DEMO = [
  { email: 'analyst@fraudmirror.dev', role: 'analyst', desc: 'Reviews alerts, confirms fraud' },
  { email: 'redteam@fraudmirror.dev', role: 'redteam', desc: 'Launches simulated attacks' },
  { email: 'admin@fraudmirror.dev', role: 'admin', desc: 'Sees everything' },
];

export default function Login() {
  const dispatch = useAppDispatch();
  const { token, status, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) return <Navigate to="/dashboard" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div className="grid min-h-screen place-items-center grid-bg p-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_60%)]" />
      <div className="relative grid w-full max-w-4xl gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-5 p-2">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent" style={{ boxShadow: 'var(--glow)' }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" />
                <path d="M12 2v20" stroke="#f59e0b" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Fraud<span className="text-accent">Mirror</span>
            </h1>
          </div>
          <p className="text-lg leading-relaxed text-slate-300">
            A real-time attack-and-defend platform for payment fraud. Watch transactions stream in, catch the fraud, then flip the
            mirror and see what slipped through.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {['Live stream', 'Rule-based detector', 'Analyst case review', 'Red-team attack lab', 'Adaptive loop'].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                {t}
              </span>
            ))}
          </div>
          <span className="w-fit rounded-md border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-yellow-300">
            SYNTHETIC DATA ONLY
          </span>
        </div>

        <div className="panel p-6 sm:p-8" style={{ boxShadow: 'var(--glow)' }}>
          <h2 className="text-xl font-semibold text-white">Sign in to the console</h2>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            <label className="text-xs text-slate-400">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
                placeholder="you@fraudmirror.dev"
              />
            </label>
            <label className="text-xs text-slate-400">
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
                placeholder="••••••"
              />
            </label>
            {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}
            <button
              disabled={status === 'loading'}
              className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-60"
            >
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6">
            <div className="panel-title mb-2">Demo accounts · password demo123</div>
            <div className="flex flex-col gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword('demo123');
                  }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-accent/50"
                >
                  <span>
                    <span className="block font-mono text-xs text-slate-200">{d.email}</span>
                    <span className="text-[11px] text-slate-500">{d.desc}</span>
                  </span>
                  <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">{d.role}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Click an account to fill the form.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
