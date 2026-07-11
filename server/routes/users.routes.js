const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeRole, normalizeEmployeeType, isStaffRole, ensureEmployeeProfile } = require('../utils/employeeData');

router.get('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { data: users } = await sb.list('users', {
    select: 'id,name,email,role,employee_type,status,created_at',
    order: 'name.asc'
  });
  res.json({ users });
}));

router.post('/', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const role = normalizeRole(req.body.role);
  const employeeType = normalizeEmployeeType(req.body.employee_type);

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }
  if (employeeType === undefined) return res.status(400).json({ error: 'Invalid employee type' });
  if (isStaffRole(role) && !employeeType) return res.status(400).json({ error: 'Employee type is required for staff accounts' });

  const existing = await sb.one('users', { select: 'id', filters: [['email', 'eq', email]] });
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const user = await sb.insert('users', {
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role,
    employee_type: isStaffRole(role) ? employeeType : null,
    status: 'active'
  });

  await ensureEmployeeProfile(sb, user);

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
  const { name, email, status, password } = req.body;
  const role = normalizeRole(req.body.role);
  const employeeType = normalizeEmployeeType(req.body.employee_type);
  const existing = await sb.one('users', { filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (!name || !email || !role) return res.status(400).json({ error: 'Name, email, and role are required' });
  if (employeeType === undefined) return res.status(400).json({ error: 'Invalid employee type' });
  if (isStaffRole(role) && !employeeType) return res.status(400).json({ error: 'Employee type is required for staff accounts' });

  const update = { name, email, role, status, employee_type: isStaffRole(role) ? employeeType : null };
  if (password) update.password = bcrypt.hashSync(password, 10);

  const user = await sb.update('users', [['id', 'eq', req.params.id]], update);
  if (isStaffRole(role)) {
    await ensureEmployeeProfile(sb, user);
  } else if (isStaffRole(existing.role)) {
    const profile = await sb.one('employees', { select: 'id', filters: [['user_id', 'eq', user.id]] });
    if (profile) await sb.remove('employees', [['id', 'eq', profile.id]]);
  }
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
  const profile = await sb.one('employees', { select: 'id', filters: [['user_id', 'eq', req.params.id]] });
  if (profile) await sb.update('employees', [['id', 'eq', profile.id]], { status: 'Inactive' });
  res.json({ message: 'User deactivated' });
}));

module.exports = router;
