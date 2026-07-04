const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sb = require('../database/supabaseClient');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await sb.one('users', {
    filters: [
      ['email', 'eq', email],
      ['status', 'eq', 'active']
    ]
  });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
}));

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
