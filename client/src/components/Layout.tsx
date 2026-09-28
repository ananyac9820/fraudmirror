import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/authSlice';
import { toggleMode } from '../store/uiSlice';
import { NAV } from './nav';
import { useLiveSocket } from '../lib/socket';

function ModeToggle() {
  const mode = useAppSelector((s) => s.ui.mode);
  const dispatch = useAppDispatch();
  const attacker = mode === 'attacker';
  return (
    <button
      onClick={() => dispatch(toggleMode())}
      title="Flip the mirror: view the same data as defender or attacker"
      className="relative flex h-9 w-[190px] sm:w-[220px] items-center rounded-full border border-white/10 bg-black/40 p-1 text-[10px] sm:text-[11px] font-semibold tracking-[0.14em]"
    >
      <span
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-all duration-500"
        style={{
          left: attacker ? 'calc(50% + 2px)' : '4px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
          boxShadow: 'var(--glow)',
        }}
      />
      <span className={`relative z-10 flex-1 text-center ${!attacker ? 'text-slate-950' : 'text-slate-400'}`}>DEFENDER</span>
      <span className={`relative z-10 flex-1 text-center ${attacker ? 'text-slate-950' : 'text-slate-400'}`}>ATTACKER</span>
    </button>
  );
}

export default function Layout() {
  const { user } = useAppSelector((s) => s.auth);
  const { mode, sweepKey } = useAppSelector((s) => s.ui);
  const { connected, newAlerts } = useAppSelector((s) => s.feed);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useLiveSocket();

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const items = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <div className="min-h-screen grid-bg">
      {sweepKey > 0 && <div key={sweepKey} className="mirror-sweep" />}

      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/5 bg-[#05080d]/85 px-3 sm:px-5 backdrop-blur">
        <button className="rounded-lg p-2 text-slate-300 hover:bg-white/5 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-accent" style={{ boxShadow: 'var(--glow)' }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" />
              <path d="M12 2v20" className="text-accent2" stroke="var(--accent-2)" />
            </svg>
          </div>
          <span className="hidden text-lg font-bold tracking-tight text-white sm:inline">
            Fraud<span className="text-accent">Mirror</span>
          </span>
        </div>
        <span className="hidden rounded-md border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest text-yellow-300 md:inline">
          SYNTHETIC DATA
        </span>
        <span className={`hidden items-center gap-1.5 text-xs md:flex ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 pulse-dot' : 'bg-slate-600'}`} />
          {connected ? 'LIVE' : 'offline'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <ModeToggle />
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-white">{user?.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{user?.role}</div>
          </div>
          <button
            onClick={() => {
              dispatch(logout());
              navigate('/login');
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-400/50 hover:text-rose-300"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-30 w-60 border-r border-white/5 bg-[#070b12]/95 p-3 backdrop-blur transition-transform lg:sticky lg:h-[calc(100vh-4rem)] lg:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="panel-title px-3 pb-2 pt-2">{mode === 'defender' ? 'Defence console' : 'Red-team console'}</div>
          <nav className="flex flex-col gap-1">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                    isActive ? 'bg-accent/10 text-accent shadow-[inset_2px_0_0_var(--accent)]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                {n.icon}
                <span>{n.label}</span>
                {n.to === '/alerts' && newAlerts > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">{newAlerts > 99 ? '99+' : newAlerts}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="absolute bottom-4 left-3 right-3 rounded-lg border border-white/5 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-500">
            All transactions are generated by the FraudMirror simulator. No real payment data.
          </div>
        </aside>
        {menuOpen && <div className="fixed inset-0 top-16 z-20 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}

        <main className="min-w-0 flex-1 p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
