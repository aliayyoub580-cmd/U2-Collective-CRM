const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');

router.get('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const filters = [];
  if (status) filters.push(['status', 'eq', status]);
  const or = search ? `(name.ilike.*${search}*,email.ilike.*${search}*)` : undefined;

  const { data, count: total } = await sb.list('employees', {
    filters,
    or,
    order: 'created_at.desc',
    limit: limitNum,
    offset,
    count: true
  });

  const users = await mapById(sb, 'users', (data || []).map((e) => e.user_id), 'id,email,role');
  const employees = (data || []).map((e) => ({
    ...e,
    user_email: users.get(Number(e.user_id))?.email || null,
    user_role: users.get(Number(e.user_id))?.role || null
  }));
  res.json({ employees, total });
}));

router.post('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { name, role, salary, phone, email, status, joining_date, performance_notes, create_user, password, user_role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  let userId = null;
  if (create_user && password) {
    let user = await sb.one('users', { select: 'id', filters: [['email', 'eq', email]] });
    if (!user) {
      user = await sb.insert('users', {
        name,
        email,
        password: bcrypt.hashSync(password, 10),
        role: user_role || 'Employee',
        status: 'active'
      });
    }
    userId = user.id;
  }

  const employee = await sb.insert('employees', {
    user_id: userId,
    name,
    role,
    salary: salary || 0,
    phone,
    email,
    status: status || 'Active',
    joining_date,
    performance_notes
  });
  await logActivity(req.user.id, 'Created employee: ' + name, 'employees', employee.id);
  res.status(201).json({ employee });
}));

router.put('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { name, role, salary, phone, email, status, joining_date, performance_notes } = req.body;
  const existing = await sb.one('employees', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  const employee = await sb.update('employees', [['id', 'eq', req.params.id]], {
    name,
    role,
    salary: salary || 0,
    phone,
    email,
    status,
    joining_date,
    performance_notes
  });
  await logActivity(req.user.id, 'Updated employee: ' + name, 'employees', req.params.id);
  res.json({ employee });
}));

router.delete('/:id', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  const existing = await sb.one('employees', { select: 'id,name', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  await sb.remove('employees', [['id', 'eq', req.params.id]]);
  await logActivity(req.user.id, 'Deleted employee: ' + existing.name, 'employees', req.params.id);
  res.json({ message: 'Employee deleted' });
}));

router.get('/:id/tasks', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const employee = await sb.one('employees', { select: 'user_id', filters: [['id', 'eq', req.params.id]] });
  if (!employee?.user_id) return res.json({ tasks: [] });

  const { data } = await sb.list('tasks', {
    filters: [['assigned_to', 'eq', employee.user_id]],
    order: 'deadline.asc'
  });
  const users = await mapById(sb, 'users', (data || []).map((t) => t.assigned_to));
  const tasks = (data || []).map((t) => ({ ...t, assigned_to_name: users.get(Number(t.assigned_to))?.name || null }));
  res.json({ tasks });
}));

router.get('/users/all', authenticateToken, asyncHandler(async (req, res) => {
  const { data: users } = await sb.list('users', {
    select: 'id,name,email,role',
    filters: [['status', 'eq', 'active']],
    order: 'name.asc'
  });
  res.json({ users });
}));

module.exports = router;
