# FraudMirror

**A real-time attack-and-defend web platform for payment fraud.**

FraudMirror is a web platform where a fraud team watches synthetic payment transactions stream in live. A rule-based detector scores every transaction from 0 to 100 and explains each flag in plain language. Analysts review flagged cases, and a red team launches simulated fraud attacks into the stream. The same data can be viewed in two modes. **Defender** mode (green/cyan) shows what was caught. **Attacker** mode (amber/magenta) shows what slipped through. An attack-and-defend **Loop** evolves attacks and detector rules against each other, round after round.

> **All data is synthetic.** Every transaction comes from FraudMirror's own simulator. There is no real payment data and no real attack tooling: an "attack" is just a pattern in synthetic transaction records.

---

## Features

- **Live transaction stream.** A server-side simulator generates 1–3 transactions every 800 ms. They cover Indian merchants, cities, UPI/card/netbanking and amounts in INR, and are pushed to the browser over Socket.io. New rows animate in, and the feed can be paused and resumed.
- **Explainable detector.** Weighted rules cover velocity, micro-amount repetition, new device, new city, impossible travel, amount spikes, young accounts, mule pass-through and refund repetition. Every rule that fires adds a readable reason, for example *"7 transactions in 30 seconds"* or *"New device + new city"*. A score of 60 or more flags the transaction, creates an Alert and pushes it live.
- **Six attack patterns.** Card testing, account takeover, velocity burst, impossible travel, mule chain and refund abuse. They appear as roughly 2% background fraud plus any bursts the red team launches.
- **Dashboard.** KPI cards (transactions today, detected threats, open alerts, detection rate, ₹ protected) and live Recharts charts: transactions per minute, alerts by type and risk-score distribution.
- **Analyst case review.** The alert queue is sorted by risk and can be filtered by status and suspected type. Each case file shows the transaction, all reasons and the account's last 10 transactions. The analyst clicks **Confirm Fraud** or **False Positive** and adds a note. After review, the ground truth is revealed along with whether the analyst was right.
- **Attack Lab (red team).** Pick an attack type and intensity, then launch. A live counter shows launched vs detected vs slipped.
- **Mirror mode.** A global DEFENDER / ATTACKER toggle re-themes the whole app with an animated sweep and relabels the KPIs ("Detected threats" becomes "Undetected paths"). In attacker mode the live feed highlights fraud that slipped past the detector.
- **Attack-and-defend Loop.** Each generation, the attacker mutates the attacks that were missed last round (slower, smaller, fewer tells). The defender then tightens the weights and thresholds of the rules that failed. The page charts detection rate per generation, alongside the false-positive cost measured on a sample of legitimate traffic.
- **Role-based access.** JWT auth with three roles. The sidebar hides pages a role can't use, and the API enforces the same rules. Analysts never receive ground truth over the socket or REST until they have reviewed a case.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite |
| State | Redux Toolkit (`auth`, `feed`, `ui` slices), react-redux |
| Routing | React Router |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), CSS variables for mirror-mode theming |
| Charts | Recharts |
| Realtime | Socket.io (server) + socket.io-client |
| Backend | Node.js + Express (JavaScript, ES modules) |
| Database | MongoDB + Mongoose; automatic `mongodb-memory-server` fallback |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` password hashing |
| API testing | Postman collection in `/postman` |
| Tooling | npm scripts + `concurrently` (works from PowerShell / cmd) |

## Syllabus mapping

| Syllabus topic | Where it is used |
|---|---|
| **React + TypeScript** | `client/src` – typed components, pages and API models (`lib/types.ts`) |
| **Redux** | `client/src/store` – `authSlice` (JWT login thunk + localStorage), `feedSlice` (live stream, pause buffer, alert badge, attack runs), `uiSlice` (mirror mode) |
| **React Router** | `client/src/App.tsx` – protected routes, role-gated pages, `/alerts/:id` case view |
| **Node.js + Express** | `server/src/index.js`, `server/src/routes/*` – REST API with auth and role middleware |
| **MongoDB + Mongoose** | `server/src/models/*` – User, Transaction, Alert, AttackRun, LoopRound; aggregation pipelines in `routes/stats.js` |
| **REST + Postman** | `postman/FraudMirror.postman_collection.json` |
| **WebSockets** | Socket.io with JWT handshake; rooms by clearance (`truth` / `analyst`) |
| **Security** | bcrypt password hashes, JWT, role-based authorisation, data hiding per role |

## Setup (Windows: PowerShell or cmd)

Requirements: **Node.js 20+** (Vite 8 needs Node 20.19+) and Git. MongoDB is **not** required.

```powershell
git clone <your-repo-url> fraudmirror
cd fraudmirror
npm run setup     # installs root, server and client dependencies
npm run dev       # starts API (http://localhost:4000) + web app (http://localhost:5173)
```

Open **http://localhost:5173**.

- The first `npm run setup` downloads a MongoDB binary for `mongodb-memory-server`, which takes a few minutes once. It is cached in `server/node_modules/.cache`.
- With no `MONGO_URI` set, the server starts an **in-memory MongoDB** and logs that it is doing so. Data resets on every restart, and 30 minutes of history is seeded each time so the charts are never empty.
- To use a real database, copy `server/.env.example` to `server/.env` and set `MONGO_URI=mongodb://localhost:27017/fraudmirror` (MongoDB 5.0+). `.env` is git-ignored.

## Demo accounts

Password for all accounts: **`demo123`**. They are also shown on the login page, where clicking one fills the form.

| Email | Role | Can see |
|---|---|---|
| `analyst@fraudmirror.dev` | analyst | Dashboard, Live Feed, Alerts (review), Loop. No ground truth until a case is reviewed |
| `redteam@fraudmirror.dev` | redteam | Dashboard, Live Feed (with ground truth), Attack Lab, Loop |
| `admin@fraudmirror.dev` | admin | Everything |

## Demo script (about 5 minutes)

1. **Login page.** Point out the demo accounts. Sign in as **admin**.
2. **Dashboard (Defender).** Walk through the KPIs, then the transactions-per-minute chart as it updates live, alerts by attack type and the risk distribution.
3. **Live Feed.** Rows stream in. Click a red flagged row to show the detector's reasons. Press **Pause**, show the buffered counter, then **Resume**.
4. **Alerts.** Open the highest-risk alert. Show the reasons and account history, write a note and click **Confirm Fraud**. The ground truth is revealed with "the analyst was right". Open a MakeMyTrip/Tanishq alert: these are often a legitimate traveller, so mark it **False Positive**.
5. **Attack Lab.** Launch **Card testing · high** and watch the counter: most transactions are detected. Then launch **Card testing · low**: 0 detected, so the attack slips through.
6. **Flip the mirror.** Click **ATTACKER** in the top bar. The theme sweeps to amber/magenta and the labels change to "Undetected paths". On the Live Feed, click **Fraud only**: the magenta rows are the low-intensity attack that slipped through.
7. **Loop.** Press **Run round 1**, then press it 4–5 more times. Detection climbs from about 0% to about 75%, while the attacker keeps mutating. Point out the false-positive line: tighter rules cost some legitimate customers.
8. *(Optional)* Show the Postman collection: run **Login (admin)**, then **Get stats** and **Launch attack**.

## Design decisions / notes

- **Detector config in one object.** `server/src/engine/detector.js → defaultDetectorConfig()` holds every weight and threshold. The live detector uses one instance. The Loop tunes its **own candidate copy** in a sandbox, so repeated rounds cannot flood the live alert queue with false positives. Each round reports that false-positive cost.
- **Deliberate blind spots.** Low-intensity presets (slow pace, amounts just under thresholds, known devices/cities) score below 60 against the baseline detector. This gives the Loop and the attacker view something to show.
- **Ground truth hiding.** Socket.io clients join a `truth` room (red team/admin) or an `analyst` room. Analysts receive transactions with `isFraud`/`attackType` stripped. The case-file API reveals the truth only after review, for every role, so the reveal also works when demoing as admin.
- **Suspected pattern.** Alerts carry the detector's *suspected* pattern, based on which rules contributed the most points, rather than the hidden ground truth. The "alerts by attack type" chart and the alert filter use it.
- **Deterministic account pool.** 400 synthetic accounts are generated from a seeded PRNG, so account IDs are stable across restarts.
- **Extra fields.** `Transaction` also stores `txType` (payment/refund/transfer), `counterpartyId`, `accountAgeDays`, `attackRunId` and `suspectedPattern`, which the refund and mule rules need.
- `cross-env` was not needed: no npm script sets environment variables inline, and `.env` is read with `dotenv`.

## Project structure

```
fraudmirror/
├─ package.json            # setup / dev scripts (concurrently)
├─ server/
│  └─ src/
│     ├─ index.js          # Express + Socket.io bootstrap
│     ├─ db.js             # MONGO_URI or in-memory MongoDB
│     ├─ seed.js           # demo users
│     ├─ middleware/auth.js
│     ├─ models/           # User, Transaction, Alert, AttackRun, LoopRound
│     ├─ routes/           # auth, transactions, stats, alerts, attacks, loop
│     └─ engine/           # data, generators (simulator), detector, engine (live loop), loop
├─ client/
│  └─ src/
│     ├─ store/            # Redux Toolkit slices
│     ├─ lib/              # api, socket, types, formatting, theme
│     ├─ components/       # Layout (top bar + sidebar), KpiCard, RiskBadge
│     └─ pages/            # Login, Dashboard, LiveFeed, Alerts, CaseDetail, AttackLab, Loop
└─ postman/FraudMirror.postman_collection.json
```

## REST API

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Returns JWT + user |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/transactions?limit&flagged&accountId&slipped` | any | Recent transactions (truth stripped for analysts) |
| GET | `/api/stats` | any | KPIs + chart series |
| GET | `/api/alerts?status&pattern` | analyst, admin | Alert queue sorted by risk |
| GET | `/api/alerts/:id` | analyst, admin | Case file + account history |
| PATCH | `/api/alerts/:id/review` | analyst, admin | `{ decision, note }` → reveals ground truth |
| GET | `/api/attacks` | redteam, admin | Recent runs + presets |
| POST | `/api/attacks/launch` | redteam, admin | `{ attackType, intensity }` |
| POST | `/api/loop/round` | any | Run the next generation |
| GET | `/api/loop/rounds` | any | All rounds + candidate config |
| POST | `/api/loop/reset` | any | Restart the loop |

Socket.io events (server → client): `tx` (batch of transactions), `alert`, `alert:reviewed`, `attack:update`.

## Not yet implemented

- Machine-learning detector (the Python ML engine from ai-defense-lab). The current detector is rule-based with weighted scoring.
- 3D / WebGL visualisations (account network graph, threat constellation)
- Account network / mule-graph visual explorer
- PDF / CSV report export
- Email / SMS alert notifications
- Admin user-management screen (users are seeded)
- Spring Boot microservice
- Deployment to a live URL
- Automated test suite
- Real bank or card data integration
