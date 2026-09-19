const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'scambot-dev-secret-change-in-production';

const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9]{4,15}$/;

function validateUsername(username) {
  if (typeof username !== 'string') {
    return 'Username is required';
  }
  if (username.length < 5 || username.length > 16) {
    return 'Username must be 5–16 characters long';
  }
  if (/\s/.test(username)) {
    return 'Username cannot contain spaces';
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username must start with a letter and contain only letters and numbers';
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 1) {
    return 'Password is required';
  }
  return null;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT id, username, role, status FROM users WHERE id = ?
    `).get(payload.id);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function approvedRequired(req, res, next) {
  if (req.user.status !== 'approved') {
    return res.status(403).json({
      error: 'Your account is pending administrator approval',
      status: req.user.status,
    });
  }
  next();
}

function adminRequired(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

module.exports = {
  validateUsername,
  validatePassword,
  signToken,
  authRequired,
  approvedRequired,
  adminRequired,
};
