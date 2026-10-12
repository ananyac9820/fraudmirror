# FraudMirror

**A real-time attack-and-defend web platform for payment fraud.**

FraudMirror is a web platform where a fraud team watches synthetic payment transactions stream in live. A rule-based detector scores every transaction from 0 to 100 and explains each flag in plain language. Analysts review flagged cases, and a red team launches simulated fraud attacks into the stream. The same data can be viewed in two modes. **Defender** mode (cool teal and sage) shows what was caught. **Attacker** mode (warm umber and ochre) shows what slipped through. You can also **upload your own transaction file** and get a scored result back.

> **All data is synthetic.** Every transaction comes from FraudMirror's own simulator. There is no real payment data and no real attack tooling: an "attack" is just a pattern in synthetic transaction records.

---

## Features

- **Live transaction stream.** A server-side simulator generates 1–3 transactions every 800 ms. They cover Indian merchants, cities, UPI/card/netbanking and amounts in INR, and are pushed to the browser over Socket.io. New rows animate in, and the feed can be paused and resumed.
- **Explainable detector.** Weighted rules cover velocity, micro-amount repetition, new device, new city, impossible travel, amount spikes, young accounts, mule pass-through and refund repetition. Every rule that fires adds a readable reason, for example *"7 transactions in 30 seconds"* or *"New device + new city"*. A score of 60 or more flags the transaction, creates an Alert and pushes it live.
- **Six attack patterns.** Card testing, account takeover, velocity burst, impossible travel, mule chain and refund abuse. They appear as roughly 2% background fraud plus any bursts the red team launches.
- **Overview.** Headline figures (transactions today, flagged, open alerts, detection rate, ₹ protected) and live Recharts charts: transactions per minute, alerts by type and risk-score distribution.
- **Analyst case review.** The alert queue is sorted by risk and can be filtered by status and suspected type. Each case file shows the transaction, all reasons and the account's last 10 transactions. The analyst clicks **Confirm Fraud** or **False Positive** and adds a note. After review, the ground truth is revealed along with whether the analyst was right.
- **Attack Lab (red team).** Pick an attack type and intensity, then launch. A live counter shows launched vs detected vs slipped.
- **Mirror mode.** A Defender / Attacker switch in the header fades the whole app from the cool palette to the warm one and rewrites the headings ("Detected threats" becomes "Undetected paths"). In attacker mode the live feed highlights fraud that slipped past the detector.
- **Analyze your own file (custom input and output).** Upload a CSV of transactions. The server scores every row with the same detector, stores the analysis in MongoDB and returns a summary, a row-by-row table with reasons, and a downloadable results CSV. If the file has an `isFraud` column, the output also reports how much labelled fraud was caught. Sample input files are in `client/public/samples/`.
- **Legal pages.** Privacy Policy and Terms of Service, linked from every page footer.
- **Loading states.** Skeleton placeholders while data loads.
- **Role-based access.** JWT auth with three roles. The navigation hides pages a role can't use, and the API enforces the same rules. Analysts never receive ground truth over the socket or REST until they have reviewed a case.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite |
| State | Redux Toolkit (`auth`, `feed`, `ui` slices), react-redux |
| Routing | React Router |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), CSS variables for mirror-mode theming |
| Type | Instrument Serif (italic display), IBM Plex Sans, IBM Plex Mono (Google Fonts) |
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
| **MongoDB + Mongoose** | `server/src/models/*` – User, Transaction, Alert, AttackRun, Analysis; aggregation pipelines in `routes/stats.js` |
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

- `npm run dev` is for development (hot reload, two processes). `npm start` runs the built app as one server.
- The first `npm run setup` downloads a MongoDB binary for `mongodb-memory-server`, which takes a few minutes once. It is cached in `server/node_modules/.cache`.
- With no `MONGO_URI` set, the server starts an **in-memory MongoDB** and logs that it is doing so. Data resets on every restart, and 30 minutes of history is seeded each time so the charts are never empty.
- To use a real database, copy `server/.env.example` to `server/.env` and set `MONGO_URI=mongodb://localhost:27017/fraudmirror` (MongoDB 5.0+). `.env` is git-ignored.

## Run as one full-stack server

```powershell
npm start         # builds the React app, then one Node process serves UI + API + sockets
```

Open **http://localhost:4000**. This is the production shape: a single origin, no dev proxy.

## Deploy the full stack (Render + MongoDB Atlas)

`render.yaml` describes one free web service that runs everything. A hosted server needs a real database, because the in-memory MongoDB is a development-only dependency.

1. Create a free cluster at MongoDB Atlas, add a database user, allow access from anywhere (0.0.0.0/0), and copy the connection string.
2. On Render choose **New > Blueprint**, connect the GitHub repository, and paste the connection string as `MONGO_URI` when asked. `JWT_SECRET` is generated for you.
3. Wait for the first deploy. The app is then at the `onrender.com` address Render shows. Free instances sleep after 15 minutes without traffic and take about a minute to wake.

## Input file format

CSV with a header row, up to 5,000 rows. Column names are not case-sensitive.

| Column | Required | Notes |
|---|---|---|
| `timestamp` | yes | For example `2026-10-10 09:00:00`. A time without a zone is used as written, on any server |
| `accountId` | yes | |
| `amount` | yes | INR, a positive number |
| `merchant`, `merchantCategory`, `city`, `deviceId` | no | Used by the new-device, new-city, travel and refund rules |
| `channel` | no | `card`, `upi` or `netbanking` |
| `txType` | no | `payment` (default), `refund` or `transfer` |
| `counterpartyId`, `accountAgeDays` | no | Used by the mule-chain rules |
| `isFraud` | no | `true`/`false` label; enables the caught and false-positive counts |

Sample files (regenerate with `npm run samples`): `minimal-example.csv` (13 hand-editable rows), `normal-day.csv`, `card-testing-attack.csv`, `mixed-attacks.csv`.

## Public dataset: Sparkov credit-card transactions

The Analyze page also accepts the public **Credit Card Transactions Fraud Detection Dataset** (Kaggle, `kartik2112/fraud-detection`, licence CC0 public domain). It is synthetic, generated with the Sparkov simulator: 1.85 million card payments by about 1,000 US customers, each labelled fraud or not.

- `client/public/samples/sparkov-credit-card-slice.csv` is a 4,335-row excerpt of its `fraudTest.csv`, ready to upload.
- Files in the original Sparkov format are recognised automatically. Card numbers are reduced to `CARD-` plus their last 8 digits, amounts are converted from US dollars at a fixed ₹83, and the `fraud_` prefix is dropped from merchant names.
- To cut a fresh excerpt, download `fraudTest.csv` from Kaggle and run `npm run dataset -- "C:\path\to\fraudTest.csv"`.

**The excerpt is not a random sample.** It keeps 5 weeks of history for 30 defrauded cards and 14 clean ones, because the detector needs a card's earlier payments to judge later ones. Fraud is 0.39% of the full file and 6.8% of the excerpt.

### What the data showed, and the rule it led to

In `fraudTest.csv`, 82% of fraud happens between 22:00 and 04:00, the median fraud payment is $372 against $47 for normal payments, and a stolen card is typically used about 10 times over two days. Two rules were added for file analysis (`fileAnalysisConfig()` in `server/src/engine/detector.js`):

- **Large payment late at night:** at least 3 times the card's typical payment and at least ₹20,000, between 22:00 and 04:00. On its own this is only a signal (25 points).
- **Repeated within 24 hours:** a second such payment on the same card adds 35 points, which crosses the alert threshold of 60.

### Measured result

Scored over all 555,719 rows of `fraudTest.csv` (every card's full history, not the excerpt):

| | |
|---|---|
| Fraud rows caught | 1,007 of 2,145 (46.9%) |
| Fraud value caught | 63.4% |
| Flags that were real fraud | 90.2% (110 false alarms among 553,574 normal payments) |

Limits of this result, stated plainly:

- The thresholds were chosen by looking at this same file, so the figures are optimistic. Splitting the cards into two halves gave 49.8% / 91.9% and 44.0% / 88.2%, which suggests they are stable, but they were not checked on the separate `fraudTrain.csv`.
- The first fraudulent payment on a card is never flagged, because the rule needs a second one.
- Fraud that is small or happens in the daytime (about half of it) is missed. Catching it would need more than two hand-written rules, for example a model trained on the labelled data.
- The dataset is itself simulated, so this says nothing certain about real card fraud.

## Defender and attacker views

The two views show the same transactions and answer opposite questions.

| | Defender | Attacker |
|---|---|---|
| Question | What did we catch? | What got past us? |
| Headline numbers | Flagged, open alerts, detection rate, value protected | Undetected fraud, evasion rate, value lost |
| Live feed highlights | Payments the detector flagged | Fraud the detector did not flag |
| Who it is for | Analysts working the alert queue | Red team, or anyone reviewing the detector's blind spots |

A detector looks good from the defender's side, because it only shows its successes. The attacker view uses the simulator's ground truth to show the failures, which is where improvement comes from. A typical use: launch a low-intensity attack in the Attack lab, switch to Attacker, see exactly which fraudulent payments were missed and what they scored, then decide which rule or threshold would have caught them.

The attacker view needs ground truth, which only exists for simulated data and is only sent to the red-team and admin roles. An analyst never sees it, because a real analyst would not know which payments are fraud. It applies to the Overview and Live feed pages. The Analyze page shows the same idea differently: when a file has an `isFraud` column, the output reports fraud caught and missed.

## Public demo on GitHub Pages

GitHub Pages can only host static files, so it cannot run the Express, MongoDB and Socket.io backend. The Pages build (`npm run build:pages`, Vite mode `pages`) swaps the network layer for an in-browser copy of the backend (`client/src/demo/backend.ts`). It imports the **same** simulator, detector and file-analysis modules from `server/src/engine` and answers the same REST paths. Each visitor gets a private simulation that resets on reload. The full client/server version is what `npm run dev` runs.

Deployment is automated by `.github/workflows/pages.yml`: every push to `main` builds the demo and publishes it.

1. Create an empty **public** repository named `fraudmirror` on GitHub (no README).
2. Push this project:
   ```powershell
   git remote add origin https://github.com/<your-username>/fraudmirror.git
   git push -u origin main
   ```
3. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. Open the **Actions** tab and wait for "Deploy static demo to GitHub Pages" to finish (re-run it if it started before step 3). The site is then at `https://<your-username>.github.io/fraudmirror/`.

To check the static build locally: `npm run build:pages --prefix client` then `npx vite preview --mode pages` inside `client/`, and open http://localhost:4173/fraudmirror/.

## Design system

The interface takes its mood from misty mountain landscapes: flat teal surfaces, hairline dividers, generous spacing, an italic serif for headlines over a light sans, and large light numerals. Deliberate constraints:

- Square corners, no drop shadows, no glass or blur effects on UI surfaces, no icons or emoji.
- One muted accent per mode; risk is shown as plain numbers whose colour changes above 60.
- No hover animations. The only motion is new feed rows fading in, skeleton loaders, and the palette fade when the mirror flips.
- The landscape is an inline SVG drawn from the same palette tokens, so it changes with the mode.

## Demo accounts

Password for all accounts: **`demo123`**. They are also shown on the login page, where clicking one fills the form.

| Email | Role | Can see |
|---|---|---|
| `analyst@fraudmirror.dev` | analyst | Overview, Live feed, Alerts (review), Analyze file. No ground truth until a case is reviewed |
| `redteam@fraudmirror.dev` | redteam | Overview, Live feed (with ground truth), Attack lab, Analyze file |
| `admin@fraudmirror.dev` | admin | Everything |

## Demo script (about 5 minutes)

1. **Sign-in page.** Point out the demo accounts. Sign in as **admin**.
2. **Overview (Defender).** Walk through the headline figures, then the transactions-per-minute chart as it updates live, alerts by attack type and the risk distribution.
3. **Live Feed.** Rows stream in. Click a red flagged row to show the detector's reasons. Press **Pause**, show the buffered counter, then **Resume**.
4. **Alerts.** Open the highest-risk alert. Show the reasons and account history, write a note and click **Confirm Fraud**. The ground truth is revealed with "the analyst was right". Open a MakeMyTrip/Tanishq alert: these are often a legitimate traveller, so mark it **False Positive**.
5. **Attack Lab.** Launch **Card testing · high** and watch the counter: most transactions are detected. Then launch **Card testing · low**: 0 detected, so the attack slips through.
6. **Flip the mirror.** Click **Attacker** in the header. The palette fades from teal to warm umber and the headings change to "Undetected paths". On the Live feed, click **Fraud only**: the highlighted rows are the low-intensity attack that slipped through.
7. **Analyze file.** Click **Use** next to `minimal-example.csv`, then **Analyze**. Three rows are flagged, with reasons. Then run `mixed-attacks.csv` to show labelled fraud caught, and **Download results CSV** for the output file. The run appears under Saved analyses.
8. *(Optional)* Show the Postman collection: run **Login (admin)**, then **Get stats** and **Launch attack**.

## Design decisions / notes

- **Detector config in one object.** `server/src/engine/detector.js → defaultDetectorConfig()` holds every weight and threshold, shared by the live stream and by file analysis.
- **Deliberate blind spots.** Low-intensity presets (slow pace, amounts just under thresholds, known devices/cities) score below 60 against the baseline detector. This gives the attacker view something to show.
- **Ground truth hiding.** Socket.io clients join a `truth` room (red team/admin) or an `analyst` room. Analysts receive transactions with `isFraud`/`attackType` stripped. The case-file API reveals the truth only after review, for every role, so the reveal also works when demoing as admin.
- **Suspected pattern.** Alerts carry the detector's *suspected* pattern, based on which rules contributed the most points, rather than the hidden ground truth. The "alerts by attack type" chart and the alert filter use it.
- **Deterministic account pool.** 400 synthetic accounts are generated from a seeded PRNG, so account IDs are stable across restarts.
- **File analysis starts cold.** An uploaded file is scored in time order by a fresh detector with no prior history. An account's first row sets its baseline device, city and spend, so each account needs a few earlier rows before unusual behaviour stands out.
- **Stream data expires.** Transactions and alerts carry a 24-hour TTL index so a persistent database does not grow without bound. Saved analyses are kept.
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
│     ├─ models/           # User, Transaction, Alert, AttackRun, Analysis
│     ├─ routes/           # auth, transactions, stats, alerts, attacks, analysis
│     └─ engine/           # data, generators (simulator), detector, engine (live stream), analyze (CSV scoring)
├─ client/
│  └─ src/
│     ├─ store/            # Redux Toolkit slices
│     ├─ lib/              # api, socket, types, formatting, theme
│     ├─ components/       # Layout (header + footer), ui primitives, Mountains (SVG landscape)
│     ├─ demo/             # in-browser backend used by the GitHub Pages build
│     └─ pages/            # Login, Dashboard, LiveFeed, Alerts, CaseDetail, AttackLab, Analyze, Legal
├─ .github/workflows/pages.yml   # GitHub Pages deployment
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
| POST | `/api/analysis` | any | `{ name, csv }` → scores the file, saves and returns the output |
| GET | `/api/analysis` | any | Saved analyses (without row data) |
| GET | `/api/analysis/:id` and `/api/analysis/:id/export` | any | Full output as JSON, or as a CSV download |

Socket.io events (server → client): `tx` (batch of transactions), `alert`, `alert:reviewed`, `attack:update`.

## Not yet implemented

- Machine-learning detector (the Python ML engine from ai-defense-lab). The current detector is rule-based with weighted scoring.
- 3D / WebGL visualisations (account network graph, threat constellation)
- Account network / mule-graph visual explorer
- PDF report export (analysis results download as CSV)
- Email / SMS alert notifications
- Admin user-management screen (users are seeded)
- Spring Boot microservice
- An attack-and-defend loop that auto-tunes the detector (built earlier, then removed to keep the app focused; it is in the git history)
- Automated test suite
- Real bank or card data integration (the Sparkov dataset is public and synthetic)
