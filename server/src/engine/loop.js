import { Detector, defaultDetectorConfig } from './detector.js';
import { ATTACK_TYPES, PRESETS, generateAttack, makeNormalTx } from './generators.js';

const ATTACKS_PER_TYPE = 3;
const MISS_THRESHOLD = 0.7; // a type "failed" for the defender below this per-round detection rate
const WEIGHT_CAP = 70;
const LEGIT_SAMPLE = 3000; // legit transactions scored each round to measure the false-positive cost

const round2 = (n) => Math.round(n * 100) / 100;

const ATTACK_LABELS = {
  card_testing: 'card testing',
  account_takeover: 'account takeover',
  velocity_burst: 'velocity burst',
  impossible_travel: 'impossible travel',
  mule_chain: 'mule chain',
  refund_abuse: 'refund abuse',
};

// Human-readable summary of attack parameters for the rounds table
function describeParams(p) {
  const parts = [];
  if (p.count != null) parts.push(`${p.count} tx`);
  if (p.hops != null) parts.push(`${p.hops} hops`);
  if (p.paceMs != null) parts.push(`${(p.paceMs / 1000).toFixed(1)} s apart`);
  if (p.maxAmount != null) parts.push(`up to ₹${p.maxAmount}`);
  if (p.amount != null) parts.push(`₹${p.amount.toLocaleString('en-IN')}`);
  if (p.amountMul != null) parts.push(`${p.amountMul}× usual spend`);
  if (p.newDevice === false || p.newCity === false) parts.push('familiar device or city');
  if (p.knownCities) parts.push('known cities only');
  return parts.join(', ');
}

// How the attacker evolves an attack type that was MISSED last round:
// it doubles down on stealth (slower, smaller, fewer tells).
const ATTACKER_MUTATIONS = {
  card_testing: (p) => ({ ...p, paceMs: Math.round(p.paceMs * 1.3), maxAmount: Math.round(p.maxAmount * 1.5), newDevice: false }),
  account_takeover: (p) => ({ ...p, amountMul: Math.max(1.5, round2(p.amountMul * 0.8)), newCity: false }),
  velocity_burst: (p) => ({ ...p, paceMs: Math.round(p.paceMs * 1.2), count: p.count + 1 }),
  impossible_travel: (p) => ({ ...p, paceMs: Math.round(p.paceMs * 1.3), knownCities: true }),
  mule_chain: (p) => ({ ...p, amount: Math.round(p.amount * 0.8), paceMs: Math.round(p.paceMs * 1.2) }),
  refund_abuse: (p) => ({ ...p, amount: Math.round(p.amount * 0.85), paceMs: Math.round(p.paceMs * 1.2) }),
};

// How the defender tightens the rules responsible for a pattern it failed to catch.
const DEFENDER_TIGHTENING = {
  card_testing: (c) => {
    c.weights.microRepeat += 10;
    c.params.microAmount = Math.min(250, Math.round(c.params.microAmount * 1.6));
    c.params.microCount = Math.max(2, c.params.microCount - 1);
    c.params.microWindowSec = Math.min(600, c.params.microWindowSec + 60);
    return `card testing: microRepeat ↑ ${c.weights.microRepeat}, micro ≤ ₹${c.params.microAmount}, count ≥ ${c.params.microCount}`;
  },
  account_takeover: (c) => {
    c.weights.newDevice += 10;
    c.weights.amountSpike = Math.min(40, c.weights.amountSpike + 5);
    c.params.spikeMultiplier = Math.max(3, round2(c.params.spikeMultiplier * 0.8));
    c.params.spikeMinAmount = Math.max(1500, Math.round(c.params.spikeMinAmount * 0.85));
    return `account takeover: newDevice ↑ ${c.weights.newDevice}, amountSpike ↑ ${c.weights.amountSpike}, spike > ${c.params.spikeMultiplier}×`;
  },
  velocity_burst: (c) => {
    c.weights.velocity += 10;
    c.params.velocityWindowSec = Math.min(90, c.params.velocityWindowSec + 20);
    c.params.velocityCount = Math.max(4, c.params.velocityCount - 1);
    return `velocity: weight ↑ ${c.weights.velocity}, ${c.params.velocityCount} tx / ${c.params.velocityWindowSec}s`;
  },
  impossible_travel: (c) => {
    c.weights.impossibleTravel += 10;
    return `impossible travel: weight ↑ ${c.weights.impossibleTravel}`;
  },
  mule_chain: (c) => {
    c.weights.passThrough += 8;
    c.weights.newAccount += 6;
    c.params.largeTransferAmount = Math.max(500, Math.round(c.params.largeTransferAmount * 0.6));
    c.params.passThroughSec = Math.min(900, c.params.passThroughSec + 120);
    return `mule chain: passThrough ↑ ${c.weights.passThrough}, large transfer ≥ ₹${c.params.largeTransferAmount}`;
  },
  refund_abuse: (c) => {
    c.weights.refundRepeat += 10;
    c.params.refundMinAmount = Math.max(300, Math.round(c.params.refundMinAmount * 0.6));
    c.params.refundWindowSec = Math.min(1800, c.params.refundWindowSec + 180);
    return `refund abuse: weight ↑ ${c.weights.refundRepeat}, refunds ≥ ₹${c.params.refundMinAmount}`;
  },
};

/**
 * Attack-and-defend loop. The attacker starts from stealthy "low" attacks.
 * Each round: attacker mutates the types that were missed last round -> batch is scored in a
 * sandbox detector -> defender tightens rules for types it missed.
 * The loop tunes its own candidate copy of the detector config, so the live stream stays stable;
 * each round also scores legit traffic so the false-positive cost of tightening is visible.
 */
export class AttackDefendLoop {
  constructor(pool) {
    this.pool = pool;
    this.reset();
  }

  reset() {
    this.config = defaultDetectorConfig();
    this.attackerParams = Object.fromEntries(ATTACK_TYPES.map((t) => [t, { ...PRESETS[t].low }]));
    this.missedLastRound = [];
    this.generation = 0;
  }

  runRound() {
    this.generation += 1;

    // 1. Attacker mutates what was missed last round (it evolves the paths that work)
    const attackerChanges = [];
    for (const t of this.missedLastRound) {
      this.attackerParams[t] = ATTACKER_MUTATIONS[t](this.attackerParams[t]);
      attackerChanges.push(`${ATTACK_LABELS[t]}: ${describeParams(this.attackerParams[t])}`);
    }

    // 2. Generate and score a batch in a sandbox detector using the current candidate config
    const sandbox = new Detector(this.config);
    sandbox.warm(this.pool);
    const perType = {};
    let base = Date.now();
    for (const t of ATTACK_TYPES) {
      perType[t] = { generated: 0, detected: 0, rate: 0 };
      for (let i = 0; i < ATTACKS_PER_TYPE; i++) {
        for (const { offsetMs, tx } of generateAttack(t, this.attackerParams[t], this.pool)) {
          const r = sandbox.score({ ...tx, timestamp: base + offsetMs });
          perType[t].generated += 1;
          if (r.flagged) perType[t].detected += 1;
        }
        base += 60 * 60000; // space attacks an hour apart so they do not interfere
      }
      perType[t].rate = perType[t].generated ? round2(perType[t].detected / perType[t].generated) : 0;
    }
    const attacksGenerated = Object.values(perType).reduce((s, x) => s + x.generated, 0);
    const detected = Object.values(perType).reduce((s, x) => s + x.detected, 0);

    // False-positive cost: score ordinary customer traffic with the same config
    let falsePositives = 0;
    for (let i = 0; i < LEGIT_SAMPLE; i++) {
      base += 400;
      if (sandbox.score({ ...makeNormalTx(this.pool), timestamp: base }).flagged) falsePositives += 1;
    }

    // 3. Defender tightens the rules behind the patterns it failed on
    const failed = ATTACK_TYPES.filter((t) => perType[t].rate < MISS_THRESHOLD);
    const defenderChanges = failed.map((t) => DEFENDER_TIGHTENING[t](this.config));
    for (const k of Object.keys(this.config.weights)) this.config.weights[k] = Math.min(WEIGHT_CAP, this.config.weights[k]);
    this.missedLastRound = failed;

    return {
      generation: this.generation,
      attacksGenerated,
      detected,
      detectionRate: attacksGenerated ? round2(detected / attacksGenerated) : 0,
      falsePositiveRate: Math.round((falsePositives / LEGIT_SAMPLE) * 10000) / 10000,
      perType,
      mutatedParams: { attacker: attackerChanges, defender: defenderChanges },
    };
  }
}
