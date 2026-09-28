import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { riskClass } from '../lib/format';

export const Container = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-8 ${className}`}>{children}</div>
);

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-[19px]';
  return (
    <span className={`whitespace-nowrap ${cls} leading-none`}>
      <span className="display">Fraud</span>
      <span className="font-light tracking-tight text-ink">Mirror</span>
    </span>
  );
}

/** Editorial page title: an italic serif line over a light sans line. */
export function PageHeader({
  eyebrow,
  serif,
  sans,
  description,
  actions,
}: {
  eyebrow: string;
  serif: string;
  sans: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8 pt-10 sm:pt-14">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-[40px] font-light leading-[0.95] tracking-tight sm:text-[56px]">
          <span className="display block">{serif}</span>
          <span className="block">{sans}</span>
        </h1>
        {description && <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border-b border-line py-10 ${className}`}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {aside && <div className="text-[13px] text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** A row of large light numerals separated by hairlines. */
export function Figures({ items }: { items: { label: string; value: ReactNode; note?: ReactNode; tone?: 'accent' | 'signal' }[] }) {
  return (
    <div className="grid grid-cols-2 md:flex">
      {items.map((f, i) => (
        <div key={f.label} className={`border-b border-line px-0 py-6 md:flex-1 md:border-b-0 md:px-6 md:py-2 ${i > 0 ? 'md:border-l' : 'md:pl-0'} ${i % 2 ? 'pl-5' : 'pr-5'}`}>
          <div className={`text-[36px] font-light leading-none tabular-nums tracking-tight sm:text-[44px] ${f.tone === 'accent' ? 'text-accent' : f.tone === 'signal' ? 'text-signal' : 'text-ink'}`}>{f.value}</div>
          <div className="mt-3 text-[13px] text-ink">{f.label}</div>
          {f.note && <div className="mt-1 text-[12px] text-muted">{f.note}</div>}
        </div>
      ))}
    </div>
  );
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`skeleton ${className}`} />;

export function SkeletonRows({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 border-b border-line py-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-16' : c === cols - 1 ? 'w-10' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const Risk = ({ score }: { score: number }) => <span className={`font-mono ${riskClass(score)}`}>{score}</span>;

/** Numbered list, used for detector reasons. */
export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((r, i) => (
        <li key={r} className="flex gap-4 border-b border-line py-3 text-[14px] text-ink last:border-b-0">
          <span className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, '0')}</span>
          <span>{r}</span>
        </li>
      ))}
    </ol>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <Container className="flex flex-col gap-4 py-8 text-[12.5px] text-muted md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <Wordmark />
          <span>Synthetic data only. No real payments are processed.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 whitespace-nowrap">
          <Link className="link" to="/privacy">
            Privacy Policy
          </Link>
          <Link className="link" to="/terms">
            Terms of Service
          </Link>
          <span>© 2026 FraudMirror</span>
        </nav>
      </Container>
    </footer>
  );
}
