import { CITIES, distanceKm } from './data.js';

/**
 * All detector knobs in one object. The live detector uses one copy; the Loop
 * tunes its own candidate copy in a sandbox.
 */
export function defaultDetectorConfig() {
  return {
    threshold: 60,
    weights: {
      velocity: 40, // many tx in a short window
      velocityExtreme: 25, // ...and way over the limit
      microRepeat: 40, // repeated tiny amounts (card testing)
      newDevice: 20,
      newCity: 15,
      deviceCityCombo: 10, // new device AND new city together
      impossibleTravel: 45,
      amountSpike: 30, // amount far above account average
      newAccount: 15,
      largeTransferNewAccount: 25,
      passThrough: 30, // funds forwarded right after being received
      firstTransaction: 10,
      refundRepeat: 35,
    },
    params: {
      velocityWindowSec: 30,
      velocityCount: 5,
      microAmount: 10,
      microWindowSec: 120,
      microCount: 3,
      deviceNewForMin: 10, // a device/city counts as "new" for this long after first sighting
      spikeMultiplier: 5,
      spikeMinAmount: 2000,
      newAccountDays: 7,
      largeTransferAmount: 5000,
      passThroughSec: 120,
      travelMaxKmh: 800,
      refundWindowSec: 300,
      refundCount: 2,
      refundMinAmount: 2000,
    },
  };
}

// Which fraud pattern each rule is evidence for (used for the detector's "suspected pattern")
export const RULE_PATTERN = {
  velocity: 'velocity_burst',
  velocityExtreme: 'velocity_burst',
  microRepeat: 'card_testing',
  newDevice: 'account_takeover',
  newCity: 'account_takeover',
  deviceCityCombo: 'account_takeover',
  amountSpike: 'account_takeover',
  impossibleTravel: 'impossible_travel',
  newAccount: 'mule_chain',
  largeTransferNewAccount: 'mule_chain',
  passThrough: 'mule_chain',
  firstTransaction: 'mule_chain',
  refundRepeat: 'refund_abuse',
};

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const secs = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`);

export class Detector {
  constructor(config) {
    this.config = config;
    this.profiles = new Map(); // accountId -> profile (small in-memory history)
    this.refundsByMerchant = new Map(); // merchant -> [{ts, amount}]
    this.inbound = new Map(); // accountId -> {ts, amount} last incoming transfer
  }

  /** Pre-load known devices/cities/averages for the account pool (as if from history). */
  warm(pool) {
    for (const a of pool) {
      const p = this.profile(a.accountId);
      a.devices.forEach((d) => p.devices.set(d, 0));
      p.cities.set(a.homeCity, 0);
      if (a.secondaryCity) p.cities.set(a.secondaryCity, 0);
      p.avg = 900 * a.spendMultiplier;
      p.n = 20;
    }
  }

  profile(accountId) {
    let p = this.profiles.get(accountId);
    if (!p) {
      p = { devices: new Map(), cities: new Map(), avg: 0, n: 0, recent: [], last: null };
      this.profiles.set(accountId, p);
    }
    return p;
  }

  /** Score one transaction. Returns { riskScore, reasons, flagged, suspectedPattern }. */
  score(tx) {
    const { weights: w, params: P, threshold } = this.config;
    const ts = new Date(tx.timestamp).getTime();
    const p = this.profile(tx.accountId);
    const hits = []; // [rule, points, reason]
    const hit = (rule, reason, factor = 1) => hits.push([rule, Math.round(w[rule] * factor), reason]);

    // 1. Velocity
    const windowMs = P.velocityWindowSec * 1000;
    const inWindow = p.recent.filter((r) => ts - r.ts <= windowMs).length + 1;
    if (inWindow >= P.velocityCount) {
      hit('velocity', `${inWindow} transactions in ${P.velocityWindowSec} seconds`);
      if (inWindow >= P.velocityCount * 2) hit('velocityExtreme', `Burst is ${Math.floor(inWindow / P.velocityCount)}× the normal velocity limit`);
    }

    // 2. Repeated micro-amounts (card testing)
    if (tx.amount <= P.microAmount) {
      const micro = p.recent.filter((r) => r.amount <= P.microAmount && ts - r.ts <= P.microWindowSec * 1000).length + 1;
      if (micro >= P.microCount) hit('microRepeat', `${micro} micro-payments (≤ ${inr(P.microAmount)}) in ${secs(P.microWindowSec * 1000)}, a card-testing pattern`);
    }

    // 3. New device / new city (only meaningful once the account has history)
    const newForMs = P.deviceNewForMin * 60000;
    const isNew = (map, key) => !map.has(key) || ts - map.get(key) < newForMs;
    if (p.n > 0) {
      const newDev = isNew(p.devices, tx.deviceId);
      const newCity = isNew(p.cities, tx.city);
      if (newDev) hit('newDevice', `New device ${tx.deviceId}`);
      if (newCity) hit('newCity', `New city for this account: ${tx.city}`);
      if (newDev && newCity) hit('deviceCityCombo', 'New device + new city');
    } else {
      hit('firstTransaction', 'First transaction ever seen on this account');
    }

    // 4. Impossible travel
    if (p.last && p.last.city !== tx.city && CITIES[p.last.city] && CITIES[tx.city]) {
      const km = distanceKm(p.last.city, tx.city);
      const hours = Math.max(ts - p.last.ts, 1000) / 3600000;
      if (km > 100 && km / hours > P.travelMaxKmh) {
        hit('impossibleTravel', `${p.last.city} to ${tx.city}: ${Math.round(km).toLocaleString('en-IN')} km in ${secs(ts - p.last.ts)}`);
      }
    }

    // 5. Amount spike vs account average
    if (p.avg > 0 && tx.amount >= P.spikeMinAmount && tx.amount > P.spikeMultiplier * p.avg) {
      hit('amountSpike', `Amount ${inr(tx.amount)} is ${Math.round(tx.amount / p.avg)}× the account average (${inr(p.avg)})`);
    }

    // 6. Young accounts moving money (mule behaviour)
    if (tx.accountAgeDays != null && tx.accountAgeDays < P.newAccountDays) {
      hit('newAccount', `Account is only ${tx.accountAgeDays} day${tx.accountAgeDays === 1 ? '' : 's'} old`);
      if (tx.txType === 'transfer' && tx.amount >= P.largeTransferAmount) {
        hit('largeTransferNewAccount', `Large transfer ${inr(tx.amount)} from a new account`);
      }
    }
    const inb = this.inbound.get(tx.accountId);
    if (tx.txType === 'transfer' && inb && ts - inb.ts <= P.passThroughSec * 1000) {
      hit('passThrough', `Forwarded funds ${secs(ts - inb.ts)} after receiving ${inr(inb.amount)}`);
    }

    // 7. Refund abuse at one merchant
    if (tx.txType === 'refund' && tx.amount >= P.refundMinAmount) {
      const list = (this.refundsByMerchant.get(tx.merchant) || []).filter((r) => ts - r.ts <= P.refundWindowSec * 1000);
      const n = list.filter((r) => r.amount >= P.refundMinAmount).length + 1;
      if (n >= P.refundCount) hit('refundRepeat', `${n} high-value refunds at ${tx.merchant} in ${secs(P.refundWindowSec * 1000)}`);
    }

    const riskScore = Math.min(100, hits.reduce((s, h) => s + h[1], 0));
    const flagged = riskScore >= threshold;

    // Suspected pattern = the pattern with the most evidence
    let suspectedPattern = null;
    if (hits.length) {
      const byPattern = {};
      for (const [rule, pts] of hits) byPattern[RULE_PATTERN[rule]] = (byPattern[RULE_PATTERN[rule]] || 0) + pts;
      suspectedPattern = Object.entries(byPattern).sort((a, b) => b[1] - a[1])[0][0];
    }

    this.learn(tx, ts, p, flagged);
    return { riskScore, reasons: hits.map((h) => h[2]), flagged, suspectedPattern };
  }

  /** Update the in-memory history after scoring. */
  learn(tx, ts, p, flagged) {
    p.recent.push({ ts, amount: tx.amount });
    p.recent = p.recent.filter((r) => ts - r.ts <= 10 * 60000).slice(-60);
    if (!p.devices.has(tx.deviceId)) p.devices.set(tx.deviceId, ts);
    if (!p.cities.has(tx.city)) p.cities.set(tx.city, ts);
    p.last = { ts, city: tx.city };
    if (!flagged && tx.txType === 'payment') {
      p.avg = p.n === 0 ? tx.amount : p.avg * 0.9 + tx.amount * 0.1;
    }
    p.n += 1;
    if (tx.txType === 'refund') {
      const list = this.refundsByMerchant.get(tx.merchant) || [];
      list.push({ ts, amount: tx.amount });
      this.refundsByMerchant.set(tx.merchant, list.slice(-30));
    }
    if (tx.txType === 'transfer' && tx.counterpartyId) {
      this.inbound.set(tx.counterpartyId, { ts, amount: tx.amount });
    }
  }
}
