import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB } from './db.js';
import { seedUsers } from './seed.js';
import { canSeeTruth, verifyToken } from './middleware/auth.js';
import { engine } from './engine/engine.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import statsRoutes from './routes/stats.js';
import alertRoutes from './routes/alerts.js';
import attackRoutes from './routes/attacks.js';
import analysisRoutes from './routes/analysis.js';

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.log('[auth] JWT_SECRET not set - using the built-in development secret');

const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' })); // uploaded CSVs arrive as JSON text

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

// Full-stack single-service mode: `npm start` (or NODE_ENV=production) also serves the built React app,
// so the UI, the REST API and Socket.io all share one origin.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const serveClient = process.argv.includes('--serve-client') || process.env.NODE_ENV === 'production';
if (serveClient && fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  console.log('[web] Serving the built client from client/dist');
} else if (serveClient) {
  console.log('[web] client/dist not found. Run `npm run build` first.');
}

app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Socket.io: authenticate with the same JWT, then join a room by clearance
io.use((socket, next) => {
  try {
    socket.data.user = verifyToken(socket.handshake.auth?.token);
    next();
  } catch (e) {
    next(new Error('unauthorized'));
  }
});
io.on('connection', (socket) => {
  socket.join(canSeeTruth(socket.data.user) ? 'truth' : 'analyst');
});

await connectDB();
await seedUsers();
await engine.start(io);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
[api] Port ${PORT} is already in use. Another copy of the server is probably still running.`);
    console.error('      Close that terminal (or end its node.exe in Task Manager), then run the command again.
');
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => console.log(`[api] FraudMirror server on http://localhost:${PORT}`));
