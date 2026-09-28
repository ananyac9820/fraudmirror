import bcrypt from 'bcryptjs';
import User from './models/User.js';

const DEMO_USERS = [
  { name: 'Asha (Analyst)', email: 'analyst@fraudmirror.dev', role: 'analyst' },
  { name: 'Rohan (Red Team)', email: 'redteam@fraudmirror.dev', role: 'redteam' },
  { name: 'Admin', email: 'admin@fraudmirror.dev', role: 'admin' },
];

export async function seedUsers() {
  if ((await User.countDocuments()) > 0) return;
  const passwordHash = await bcrypt.hash('demo123', 10);
  await User.insertMany(DEMO_USERS.map((u) => ({ ...u, passwordHash })));
  console.log('[seed] Created demo users (password: demo123)');
}
