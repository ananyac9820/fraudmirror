import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'fraudmirror-dev-secret';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), name: user.name, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '12h',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = verifyToken(token);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Analysts never see ground truth (isFraud / attackType) in the stream; red team and admin do.
export const canSeeTruth = (user) => !!user && (user.role === 'redteam' || user.role === 'admin');
