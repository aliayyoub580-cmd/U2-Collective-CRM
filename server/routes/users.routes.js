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
  const employeeType = role === 'Employee' ? normalizeEmployeeType(req.body.employee_type) : null;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }
  if (role === 'Employee' && employeeType === undefined) return res.status(400).json({ error: 'Invalid employee type' });
  if (role === 'Employee' && !employeeType) return res.status(400).json({ error: 'Employee type is required for Employee accounts' });

  const existing = await sb.one('users', { select: 'id', filters: [['email', 'eq', email]] });
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const user = await sb.insert('users', {
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role,
    employee_type: employeeType,
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
  const employeeType = role === 'Employee' ? normalizeEmployeeType(req.body.employee_type) : null;
  const existing = await sb.one('users', { filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (!name || !email || !role) return res.status(400).json({ error: 'Name, email, and role are required' });
  if (role === 'Employee' && employeeType === undefined) return res.status(400).json({ error: 'Invalid employee type' });
  if (role === 'Employee' && !employeeType) return res.status(400).json({ error: 'Employee type is required for Employee accounts' });

  const update = { name, email, role, status, employee_type: employeeType };
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

  // Preserve CRM records while removing every foreign-key reference to the
  // account. Assignment/history rows whose owner is required are removed;
  // nullable audit fields are retained with their user reference cleared.
  const nullableReferences = [
    ['leads', ['assigned_to', 'created_by', 'manager_id', 'lead_generator_id', 'caller_id', 'current_owner_id',
      'assigned_to_manager_by', 'assigned_to_lead_generator_by', 'assigned_to_caller_by',
      'caller_completed_by', 'manager_completed_by']],
    ['tasks', ['assigned_to', 'created_by']],
    ['followups', ['assigned_to']],
    ['communications', ['created_by']],
    ['activities', ['user_id']],
    ['lead_status_history', ['changed_by_user_id']],
    ['lead_activity', ['performed_by_user_id']],
    ['caller_outcomes', ['manager_id']]
  ];

  for (const [table, columns] of nullableReferences) {
    for (const column of columns) {
      await sb.update(table, [[column, 'eq', req.params.id]], { [column]: null });
    }
  }

  const requiredReferences = [
    ['notifications', ['user_id']],
    ['lead_assignments', ['assigned_to', 'assigned_by', 'assigned_from_user_id', 'assigned_to_user_id']],
    ['call_attempts', ['employee_id']],
    ['caller_outcomes', ['caller_id']],
    ['lead_email_followups', ['manager_id']],
    ['lead_manager_outcomes', ['manager_id']]
  ];

  for (const [table, columns] of requiredReferences) {
    for (const column of columns) {
      await sb.remove(table, [[column, 'eq', req.params.id]]);
    }
  }

  const profile = await sb.one('employees', { select: 'id', filters: [['user_id', 'eq', req.params.id]] });
  if (profile) await sb.remove('employees', [['id', 'eq', profile.id]]);
  await sb.remove('users', [['id', 'eq', req.params.id]]);
  res.json({ message: 'User deleted successfully' });
}));

module.exports = router;
