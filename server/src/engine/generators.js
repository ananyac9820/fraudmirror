import { CITY_NAMES, CITIES, MERCHANTS, distanceKm, newDeviceId, pick, randInt, weightedPick } from './data.js';

export const ATTACK_TYPES = ['card_testing', 'account_takeover', 'velocity_burst', 'impossible_travel', 'mule_chain', 'refund_abuse'];

/**
 * Attack parameters per intensity. "low" is deliberately stealthy so the
 * detector misses it, which is what the attacker view is there to show.
 */
export const PRESETS = {
  card_testing: {
    low: { count: 5, paceMs: 12000, maxAmount: 10, newDevice: false },
    medium: { count: 7, paceMs: 3000, maxAmount: 10, newDevice: true },
    high: { count: 12, paceMs: 1500, maxAmount: 10, newDevice: true },
  },
  account_takeover: {
    low: { count: 2, paceMs: 20000, amountMul: 3, newCity: false },
    medium: { count: 2, paceMs: 8000, amountMul: 7, newCity: true },
    high: { count: 3, paceMs: 4000, amountMul: 15, newCity: true },
  },
  velocity_burst: {
    low: { count: 6, paceMs: 7000, newDevice: false },
    medium: { count: 8, paceMs: 2000, newDevice: true },
    high: { count: 12, paceMs: 900, newDevice: true },
  },
  impossible_travel: {
    low: { count: 2, paceMs: 45000, knownCities: true },
    medium: { count: 2, paceMs: 15000, knownCities: false },
    high: { count: 3, paceMs: 5000, knownCities: false },
  },
  mule_chain: {
    low: { hops: 3, amount: 4000, paceMs: 90000 },
    medium: { hops: 4, amount: 20000, paceMs: 20000 },
    high: { hops: 5, amount: 45000, paceMs: 6000 },
  },
  refund_abuse: {
    low: { count: 3, amount: 1800, paceMs: 20000 },
    medium: { count: 4, amount: 6000, paceMs: 5000 },
    high: { count: 6, amount: 12000, paceMs: 3000 },
  },
};

const jitter = (ms) => Math.round(ms * (0.8 + Math.random() * 0.4));
const merchantByName = (name) => MERCHANTS.find((m) => m.name === name);
const channelFor = (m) => (Math.random() < 0.7 ? m.channel : pick(['card', 'upi', 'netbanking']));
const baseTx = (acct, m) => ({
  accountId: acct.accountId,
  accountAgeDays: acct.ageDays,
  merchant: m.name,
  merchantCategory: m.category,
  txType: 'payment',
  counterpartyId: null,
  channel: channelFor(m),
  deviceId: acct.devices[0],
  city: acct.homeCity,
});

/** One ordinary customer payment. Occasionally a legit-but-unusual one (a traveller) to create false positives. */
export function makeNormalTx(pool) {
  const acct = pick(pool);
  const m = weightedPick(MERCHANTS, MERCHANTS.map((x) => x.weight));
  const r = Math.random() ** 2.2; // skew toward the cheap end
  let amount = Math.round((m.min + (m.max - m.min) * r) * Math.min(acct.spendMultiplier, m.max > 10000 ? 1 : 2));
  amount = Math.max(m.min, amount);
  const tx = { ...baseTx(acct, m), amount, deviceId: pick(acct.devices) };
  if (Math.random() < 0.004) {
    // Genuine customer on holiday with a new phone making a big booking -> likely false positive
    const trip = merchantByName(pick(['MakeMyTrip', 'Tanishq', 'Croma']));
    Object.assign(tx, {
      merchant: trip.name,
      merchantCategory: trip.category,
      channel: 'card',
      amount: randInt(15000, 60000),
      deviceId: newDeviceId(),
      city: pick(CITY_NAMES.filter((c) => c !== acct.homeCity && c !== acct.secondaryCity)),
    });
  }
  return tx;
}

/** Generate a burst for one attack. Returns [{ offsetMs, tx }] sorted by offset. */
export function generateAttack(type, params, pool) {
  const P = params;
  const out = [];
  const push = (offsetMs, tx) => out.push({ offsetMs, tx: { ...tx, isFraud: true, attackType: type } });
  const acct = pick(pool);
  let t = 0;

  switch (type) {
    case 'card_testing': {
      const m = merchantByName(pick(['Jio Recharge', 'Amazon India', 'BookMyShow', 'Chai Point']));
      const device = P.newDevice ? newDeviceId() : acct.devices[0];
      for (let i = 0; i < P.count; i++) {
        push(t, { ...baseTx(acct, m), channel: 'card', deviceId: device, amount: randInt(1, Math.max(1, Math.round(P.maxAmount))) });
        t += jitter(P.paceMs);
      }
      break;
    }
    case 'account_takeover': {
      const device = newDeviceId();
      const city = P.newCity ? pick(CITY_NAMES.filter((c) => c !== acct.homeCity && c !== acct.secondaryCity)) : acct.homeCity;
      const avg = 900 * acct.spendMultiplier;
      for (let i = 0; i < P.count; i++) {
        const m = merchantByName(pick(['Reliance Digital', 'Croma', 'Tanishq', 'Amazon India', 'Flipkart']));
        push(t, { ...baseTx(acct, m), channel: 'card', deviceId: device, city, amount: Math.round(avg * P.amountMul * (0.85 + Math.random() * 0.3)) });
        t += jitter(P.paceMs);
      }
      break;
    }
    case 'velocity_burst': {
      const device = P.newDevice ? newDeviceId() : acct.devices[0];
      for (let i = 0; i < P.count; i++) {
        const m = merchantByName(pick(['Amazon India', 'Flipkart', 'Myntra', 'Blinkit', 'Swiggy']));
        push(t, { ...baseTx(acct, m), deviceId: device, amount: randInt(300, 2500) });
        t += jitter(P.paceMs);
      }
      break;
    }
    case 'impossible_travel': {
      // Low intensity hops between the account's two known cities; otherwise uses far-away unknown cities
      const candidates = pool.filter((a) => a.secondaryCity && distanceKm(a.homeCity, a.secondaryCity) > 300);
      const known = P.knownCities && candidates.length > 0;
      const travelAcct = known ? pick(candidates) : acct;
      const far = CITY_NAMES.filter((c) => CITIES[c] && distanceKm(travelAcct.homeCity, c) > 900).sort(() => Math.random() - 0.5);
      const cities = known ? [travelAcct.homeCity, travelAcct.secondaryCity] : [travelAcct.homeCity, ...far];
      for (let i = 0; i < P.count; i++) {
        const m = merchantByName(pick(['Uber', 'Swiggy', 'Amazon India', 'Indian Oil']));
        const city = cities[i % cities.length];
        push(t, { ...baseTx(travelAcct, m), city, deviceId: travelAcct.devices[0], amount: randInt(400, 3500) });
        t += jitter(P.paceMs);
      }
      break;
    }
    case 'mule_chain': {
      const mules = Array.from({ length: P.hops }, () => ({
        accountId: `MULE${randInt(10000, 99999)}`,
        ageDays: randInt(1, 5),
        city: pick(CITY_NAMES),
        device: newDeviceId(),
      }));
      const p2p = { name: 'UPI P2P Transfer', category: 'Transfer', channel: 'upi' };
      let amount = P.amount;
      // Victim -> mule1
      push(t, {
        ...baseTx(acct, p2p), channel: 'upi', txType: 'transfer', counterpartyId: mules[0].accountId, deviceId: newDeviceId(), amount,
      });
      for (let i = 0; i < mules.length - 1; i++) {
        t += jitter(P.paceMs);
        amount = Math.round(amount * (0.93 + Math.random() * 0.05)); // each mule keeps a cut
        push(t, {
          accountId: mules[i].accountId, accountAgeDays: mules[i].ageDays, merchant: p2p.name, merchantCategory: p2p.category,
          txType: 'transfer', counterpartyId: mules[i + 1].accountId, channel: 'upi', deviceId: mules[i].device, city: mules[i].city, amount,
        });
      }
      break;
    }
    case 'refund_abuse': {
      const m = merchantByName(pick(['Flipkart', 'Myntra', 'Croma', 'Reliance Digital']));
      for (let i = 0; i < P.count; i++) {
        push(t, { ...baseTx(acct, m), txType: 'refund', channel: 'card', amount: Math.round(P.amount * (0.9 + Math.random() * 0.2)) });
        t += jitter(P.paceMs);
      }
      break;
    }
    default:
      throw new Error(`Unknown attack type ${type}`);
  }
  return out;
}
