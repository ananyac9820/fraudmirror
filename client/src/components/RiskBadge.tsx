import { riskColor } from '../lib/format';

export default function RiskBadge({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span className={`inline-flex min-w-[42px] justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold ${riskColor(score)} ${className}`}>
      {score}
    </span>
  );
}
