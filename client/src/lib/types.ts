export type Role = 'analyst' | 'redteam' | 'admin';
export type Mode = 'defender' | 'attacker';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Tx {
  _id: string;
  txId: string;
  timestamp: string;
  accountId: string;
  accountAgeDays?: number;
  merchant: string;
  merchantCategory: string;
  txType: 'payment' | 'refund' | 'transfer';
  counterpartyId?: string | null;
  amount: number;
  channel: 'card' | 'upi' | 'netbanking';
  deviceId: string;
  city: string;
  // ground truth: only present for red team / admin, or after review
  isFraud?: boolean;
  attackType?: string | null;
  riskScore: number;
  flagged: boolean;
  reasons: string[];
  suspectedPattern?: string | null;
}

export interface Alert {
  _id: string;
  transactionId: string;
  txId: string;
  accountId: string;
  amount: number;
  merchant: string;
  timestamp: string;
  riskScore: number;
  reasons: string[];
  suspectedPattern: string;
  status: 'open' | 'confirmed_fraud' | 'false_positive';
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: string;
}

export interface AttackRun {
  _id: string;
  attackType: string;
  intensity: 'low' | 'medium' | 'high';
  launchedByName?: string;
  startedAt: string;
  count: number;
  emitted: number;
  detectedCount: number;
}

export interface LoopRound {
  _id: string;
  generation: number;
  attacksGenerated: number;
  detected: number;
  detectionRate: number;
  perType: Record<string, { generated: number; detected: number; rate: number }>;
  mutatedParams: { attacker: string[]; defender: string[] };
  createdAt: string;
}

export const ATTACK_TYPES = [
  'card_testing',
  'account_takeover',
  'velocity_burst',
  'impossible_travel',
  'mule_chain',
  'refund_abuse',
] as const;

export const ATTACK_LABELS: Record<string, string> = {
  card_testing: 'Card testing',
  account_takeover: 'Account takeover',
  velocity_burst: 'Velocity burst',
  impossible_travel: 'Impossible travel',
  mule_chain: 'Mule chain',
  refund_abuse: 'Refund abuse',
};

export const ATTACK_DESCRIPTIONS: Record<string, string> = {
  card_testing: 'Many tiny amounts (₹1–₹10) from one card to check if it works.',
  account_takeover: 'New device + new city + unusually large spend on an old account.',
  velocity_burst: 'A flood of transactions from one account within seconds.',
  impossible_travel: 'Same account appears in far-apart cities minutes apart.',
  mule_chain: 'Money hops quickly through a chain of freshly opened accounts.',
  refund_abuse: 'Repeated high-value refunds claimed at one merchant.',
};
