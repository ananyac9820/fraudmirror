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

export interface AnalysisRow {
  row: number;
  timestamp: string;
  accountId: string;
  amount: number;
  merchant: string;
  city: string;
  channel: string;
  txType: string;
  label: boolean | null;
  riskScore: number;
  flagged: boolean;
  suspectedPattern: string | null;
  reasons: string[];
}

export interface AnalysisSummary {
  rows: number;
  skipped: number;
  accounts: number;
  from: string;
  to: string;
  totalAmount: number;
  flagged: number;
  flaggedAmount: number;
  highestRisk: number;
  byPattern: Record<string, number>;
  labelled: { fraud: number; caught: number; falsePositives: number } | null;
}

export interface AnalysisListItem {
  _id: string;
  name: string;
  uploadedByName: string;
  createdAt: string;
  summary: AnalysisSummary;
  warnings: string[];
}

export interface Analysis extends AnalysisListItem {
  results: AnalysisRow[];
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
