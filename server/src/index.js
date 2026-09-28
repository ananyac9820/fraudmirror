import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectDB } from './db.js';
import { seedUsers } from './seed.js';
import authRoutes from './routes/auth.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

await connectDB();
await seedUsers();

server.listen(PORT, () => console.log(`[api] FraudMirror server on http://localhost:${PORT}`));
