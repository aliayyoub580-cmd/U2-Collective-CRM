const jwt = require('jsonwebtoken');
const sb = require('../database/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'u2collective_crm_secret_2024';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await sb.one('users', {
      select: 'id,name,email,role,status',
      filters: [['id', 'eq', decoded.id]]
    });
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const JWT_SECRET_EXPORT = JWT_SECRET;

module.exports = { authenticateToken, requireRole, JWT_SECRET: JWT_SECRET_EXPORT };
