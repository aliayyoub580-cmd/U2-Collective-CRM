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
      select: 'id,name,email,role,employee_type,status',
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

function requireModule(module) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.role === 'CEO') return next();
    const employeeAccess = user.employee_type === 'lead_generator'
      ? ['dashboard', 'leads', 'tasks', 'profile']
      : user.employee_type === 'caller'
        ? ['dashboard', 'tasks', 'followups', 'profile']
        : null;
    const roleAccess = { Manager: ['dashboard', 'leads', 'followups', 'profile'], 'Sales Representative': ['dashboard', 'leads', 'followups', 'communications', 'proposals'], Marketing: ['dashboard', 'leads', 'reports'], Accountant: ['dashboard', 'clients', 'reports'], Employee: ['dashboard', 'tasks'] };
    const allowed = employeeAccess || roleAccess[user.role] || [];
    if (!allowed.includes(module)) return res.status(403).json({ error: 'Insufficient module permissions' });
    next();
  };
}

const JWT_SECRET_EXPORT = JWT_SECRET;

module.exports = { authenticateToken, requireRole, requireModule, JWT_SECRET: JWT_SECRET_EXPORT };
