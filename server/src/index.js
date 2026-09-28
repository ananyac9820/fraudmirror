import 'dotenv/config';
import http from 'http';
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
import loopRoutes from './routes/loop.js';

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) console.log('[auth] JWT_SECRET not set - using the built-in development secret');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/loop', loopRoutes);

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

server.listen(PORT, () => console.log(`[api] FraudMirror server on http://localhost:${PORT}`));
