// Static reference data for the synthetic payment world.

export const CITIES = {
  Mumbai: [19.076, 72.878],
  Delhi: [28.614, 77.209],
  Bengaluru: [12.972, 77.594],
  Hyderabad: [17.385, 78.487],
  Chennai: [13.083, 80.271],
  Kolkata: [22.573, 88.364],
  Pune: [18.52, 73.857],
  Ahmedabad: [23.023, 72.571],
  Jaipur: [26.912, 75.787],
  Lucknow: [26.847, 80.947],
  Kochi: [9.931, 76.267],
  Chandigarh: [30.734, 76.779],
  Indore: [22.72, 75.858],
  Guwahati: [26.145, 91.736],
  Bhopal: [23.26, 77.413],
  Nagpur: [21.146, 79.088],
};
export const CITY_NAMES = Object.keys(CITIES);
// Population-ish weights so metros dominate
export const CITY_WEIGHTS = [16, 15, 14, 10, 9, 8, 7, 5, 4, 3, 3, 2, 2, 1, 1, 1];

export function distanceKm(a, b) {
  const [lat1, lon1] = CITIES[a];
  const [lat2, lon2] = CITIES[b];
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// name, category, min, max (INR), relative frequency, preferred channel
export const MERCHANTS = [
  ['Swiggy', 'Food delivery', 150, 900, 14, 'upi'],
  ['Zomato', 'Food delivery', 150, 1000, 13, 'upi'],
  ['Local Kirana Store', 'Grocery', 50, 800, 12, 'upi'],
  ['Chai Point', 'Food & beverage', 50, 300, 6, 'upi'],
  ['BigBasket', 'Grocery', 300, 3000, 7, 'upi'],
  ['Blinkit', 'Grocery', 100, 1500, 8, 'upi'],
  ['DMart', 'Grocery', 500, 4000, 5, 'card'],
  ['Amazon India', 'E-commerce', 200, 8000, 9, 'card'],
  ['Flipkart', 'E-commerce', 200, 9000, 8, 'card'],
  ['Myntra', 'Fashion', 500, 4000, 4, 'card'],
  ['Tata CLiQ', 'E-commerce', 500, 6000, 2, 'card'],
  ['Reliance Digital', 'Electronics', 1500, 45000, 1.2, 'card'],
  ['Croma', 'Electronics', 1000, 40000, 1.2, 'card'],
  ['IRCTC', 'Travel', 300, 4000, 4, 'netbanking'],
  ['MakeMyTrip', 'Travel', 2000, 25000, 1.5, 'card'],
  ['Uber', 'Transport', 80, 700, 7, 'upi'],
  ['Ola', 'Transport', 80, 600, 5, 'upi'],
  ['Indian Oil', 'Fuel', 300, 3000, 4, 'card'],
  ['HP Petrol', 'Fuel', 300, 3000, 3, 'upi'],
  ['Jio Recharge', 'Telecom', 199, 999, 5, 'upi'],
  ['Airtel Payments', 'Telecom', 199, 1499, 3, 'netbanking'],
  ['Apollo Pharmacy', 'Health', 100, 2500, 4, 'upi'],
  ['BookMyShow', 'Entertainment', 200, 1500, 3, 'upi'],
  ['Tanishq', 'Jewellery', 5000, 80000, 0.4, 'card'],
].map(([name, category, min, max, weight, channel]) => ({ name, category, min, max, weight, channel }));

// Deterministic PRNG so the account pool is identical across restarts
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedPick(items, weights, rnd = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
export const randInt = (min, max, rnd = Math.random) => Math.floor(min + rnd() * (max - min + 1));
const hex = (rnd, n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('').toUpperCase();
export const newDeviceId = (rnd = Math.random) => `DEV-${hex(rnd, 6)}`;

/** Build the pool of synthetic customer accounts. */
export function buildAccountPool(size = 400) {
  const rnd = mulberry32(20260928);
  const accounts = [];
  for (let i = 0; i < size; i++) {
    const homeCity = weightedPick(CITY_NAMES, CITY_WEIGHTS, rnd);
    let secondaryCity = null;
    if (rnd() < 0.35) {
      do secondaryCity = weightedPick(CITY_NAMES, CITY_WEIGHTS, rnd);
      while (secondaryCity === homeCity);
    }
    const devices = [newDeviceId(rnd)];
    if (rnd() < 0.25) devices.push(newDeviceId(rnd));
    accounts.push({
      accountId: `ACC${String(100000 + Math.floor(rnd() * 899999))}`,
      homeCity,
      secondaryCity,
      devices,
      ageDays: randInt(45, 2800, rnd),
      spendMultiplier: 0.5 + rnd() * 1.4,
    });
  }
  return accounts;
}
