import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/authSlice';
import { setMode } from '../store/uiSlice';
import { useLiveSocket } from '../lib/socket';
import type { Mode } from '../lib/types';
import { NAV } from './nav';
import { Container, Footer, Wordmark } from './ui';

function ModeSwitch() {
  const mode = useAppSelector((s) => s.ui.mode);
  const dispatch = useAppDispatch();
  const option = (m: Mode, label: string) => (
    <button
      onClick={() => dispatch(setMode(m))}
      aria-pressed={mode === m}
      className={`h-8 px-3 text-[12px] tracking-wide ${mode === m ? 'bg-accent font-medium text-accent-ink' : 'text-muted hover:text-ink'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex shrink-0 border border-line-strong" title="View the same data as the defender or the attacker">
      {option('defender', 'Defender')}
      {option('attacker', 'Attacker')}
    </div>
  );
}

/** Flips the palette with a short colour transition, only when the mode actually changes. */
function useModeAttribute(mode: Mode) {
  const first = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (!first.current) {
      root.classList.add('mode-shift');
      const t = setTimeout(() => root.classList.remove('mode-shift'), 650);
      root.dataset.mode = mode;
      return () => clearTimeout(t);
    }
    first.current = false;
    root.dataset.mode = mode;
  }, [mode]);
}

export default function Layout() {
  const { user } = useAppSelector((s) => s.auth);
  const mode = useAppSelector((s) => s.ui.mode);
  const { connected, newAlerts } = useAppSelector((s) => s.feed);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useLiveSocket();
  useModeAttribute(mode);

  const items = NAV.filter((n) => user && n.roles.includes(user.role));

  const links = items.map((n) => (
    <NavLink
      key={n.to}
      to={n.to}
      className={({ isActive }) =>
        `whitespace-nowrap py-1 text-[13.5px] ${isActive ? 'text-ink underline decoration-accent underline-offset-[10px]' : 'text-muted hover:text-ink'}`
      }
    >
      {n.label}
      {n.to === '/alerts' && newAlerts > 0 && <span className="ml-1.5 font-mono text-[11px] text-signal">{newAlerts > 99 ? '99+' : newAlerts}</span>}
    </NavLink>
  ));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <Container className="flex h-16 items-center gap-6">
          <Link to="/dashboard" aria-label="FraudMirror overview">
            <Wordmark />
          </Link>
          <nav className="hidden flex-1 justify-center gap-7 lg:flex">{links}</nav>
          <div className="ml-auto flex items-center gap-4 lg:ml-0">
            <span className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted xl:flex">
              Synthetic data
              <span className={connected ? 'text-accent' : 'text-faint'}>{connected ? 'live' : 'offline'}</span>
            </span>
            <ModeSwitch />
            <div className="hidden text-right leading-tight md:block">
              <div className="text-[13px] text-ink">{user?.name}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{user?.role}</div>
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                navigate('/login');
              }}
              className="text-[13px] text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </Container>
        {/* Narrow screens: the same links as a scrollable row */}
        <Container className="flex gap-6 overflow-x-auto border-t border-line py-3 lg:hidden">{links}</Container>
      </header>

      <main className="flex-1">
        <Container>
          <Outlet />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
