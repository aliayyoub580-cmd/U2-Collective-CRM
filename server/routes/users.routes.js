const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { data: users } = await sb.list('users', {
    select: 'id,name,email,role,status,created_at',
    order: 'name.asc'
  });
  res.json({ users });
}));

router.post('/', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  const existing = await sb.one('users', { select: 'id', filters: [['email', 'eq', email]] });
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const user = await sb.insert('users', {
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role
  });

  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser });
}));

router.put('/profile/me', authenticateToken, asyncHandler(async (req, res) => {
  const { name, current_password, new_password } = req.body;
  const user = await sb.one('users', { filters: [['id', 'eq', req.user.id]] });

  const update = { name: name || user.name };
  if (new_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password required' });
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    update.password = bcrypt.hashSync(new_password, 10);
  }

  const updated = await sb.update('users', [['id', 'eq', req.user.id]], update);
  const { password: _, ...safeUser } = updated;
  res.json({ user: safeUser });
}));

router.put('/:id', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  const { name, email, role, status, password } = req.body;
  const existing = await sb.one('users', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const update = { name, email, role, status };
  if (password) update.password = bcrypt.hashSync(password, 10);

  const user = await sb.update('users', [['id', 'eq', req.params.id]], update);
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
}));

router.delete('/:id', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const existing = await sb.one('users', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  await sb.update('users', [['id', 'eq', req.params.id]], { status: 'inactive' });
  res.json({ message: 'User deactivated' });
}));

module.exports = router;
