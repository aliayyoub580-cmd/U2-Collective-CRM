const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLES, normalizeRole, normalizeEmployeeType, ensureEmployeeProfile } = require('../utils/employeeData');

function mergeEmployee(user, profile) {
  return {
    id: profile?.id || `user-${user.id}`,
    user_id: user.id,
    name: user.name,
    full_name: user.name,
    email: user.email,
    role: user.role,
    employee_type: user.employee_type ?? profile?.employee_type ?? null,
    salary: profile?.salary ?? null,
    phone: profile?.phone ?? null,
    joined_date: profile?.joining_date || user.created_at?.slice(0, 10) || null,
    joining_date: profile?.joining_date || user.created_at?.slice(0, 10) || null,
    status: user.status === 'inactive' ? 'Inactive' : 'Active',
    performance_notes: profile?.performance_notes ?? null
  };
}

router.get('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 20, 1);
  const search = String(req.query.search || '').trim().toLowerCase();
  const [{ data: users }, { data: profiles }] = await Promise.all([
    sb.list('users', { select: 'id,name,email,role,employee_type,status,created_at', order: 'name.asc', limit: 10000 }),
    sb.list('employees', { limit: 10000 })
  ]);
  const profilesByUser = new Map((profiles || []).filter((p) => p.user_id).map((p) => [Number(p.user_id), p]));
  const merged = (users || []).map((user) => ({ ...user, role: normalizeRole(user.role) })).filter((user) => STAFF_ROLES.includes(user.role)).map((user) => mergeEmployee(user, profilesByUser.get(Number(user.id))));
  const filtered = !search ? merged : merged.filter((employee) => [
    employee.name, employee.email, employee.role, employee.employee_type,
    employee.employee_type === 'lead_generator' ? 'Lead Generator' : employee.employee_type === 'caller' ? 'Caller' : 'Not Assigned',
    employee.phone
  ].some((value) => String(value || '').toLowerCase().includes(search)));
  const offset = (page - 1) * limit;
  res.json({ employees: filtered.slice(offset, offset + limit), total: filtered.length });
}));

router.post('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { name, email, password, salary, phone, joining_date, performance_notes } = req.body;
  const role = normalizeRole(req.body.role);
  const employeeType = normalizeEmployeeType(req.body.employee_type);
  if (!name || !email || !role || role === 'CEO') return res.status(400).json({ error: 'Name, email, and a staff role are required' });
  if (!employeeType) return res.status(400).json({ error: 'Employee type is required' });

  let user = await sb.one('users', { filters: [['email', 'eq', email]] });
  if (!user) {
    if (!password) return res.status(400).json({ error: 'Password is required for a new employee account' });
    user = await sb.insert('users', { name, email, password: bcrypt.hashSync(password, 10), role, employee_type: employeeType, status: 'active' });
  } else {
    if (normalizeRole(user.role) === 'CEO') return res.status(409).json({ error: 'The CEO account cannot be converted to an employee' });
    user = await sb.update('users', [['id', 'eq', user.id]], { name, role, employee_type: employeeType, status: req.body.status === 'Inactive' ? 'inactive' : 'active' });
  }
  const profile = await ensureEmployeeProfile(sb, user, { salary: salary || 0, phone: phone || null, joining_date: joining_date || new Date().toISOString().slice(0, 10), performance_notes: performance_notes || null });
  await logActivity(req.user.id, `Created employee: ${name}`, 'employees', profile.id);
  res.status(201).json({ employee: mergeEmployee(user, profile) });
}));

router.put('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  let profile;
  if (String(req.params.id).startsWith('user-')) {
    const userId = Number(String(req.params.id).slice(5));
    const sourceUser = await sb.one('users', { filters: [['id', 'eq', userId]] });
    profile = await ensureEmployeeProfile(sb, sourceUser);
  } else {
    profile = await sb.one('employees', { filters: [['id', 'eq', req.params.id]] });
  }
  if (!profile?.user_id) return res.status(404).json({ error: 'Linked employee profile not found' });
  const role = normalizeRole(req.body.role);
  const employeeType = normalizeEmployeeType(req.body.employee_type);
  if (!req.body.name || !req.body.email || !role || role === 'CEO') return res.status(400).json({ error: 'Name, email, and a staff role are required' });
  if (!employeeType) return res.status(400).json({ error: 'Employee type is required' });
  const user = await sb.update('users', [['id', 'eq', profile.user_id]], { name: req.body.name, email: req.body.email, role, employee_type: employeeType, status: req.body.status === 'Inactive' ? 'inactive' : 'active' });
  const updated = await ensureEmployeeProfile(sb, user, { salary: req.body.salary || 0, phone: req.body.phone || null, joining_date: req.body.joining_date || null, performance_notes: req.body.performance_notes || null });
  await logActivity(req.user.id, `Updated employee: ${req.body.name}`, 'employees', profile.id);
  res.json({ employee: mergeEmployee(user, updated) });
}));

router.delete('/:id', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
  let profile;
  if (String(req.params.id).startsWith('user-')) {
    const sourceUser = await sb.one('users', { filters: [['id', 'eq', Number(String(req.params.id).slice(5))]] });
    profile = await ensureEmployeeProfile(sb, sourceUser);
  } else {
    profile = await sb.one('employees', { select: 'id,user_id,name', filters: [['id', 'eq', req.params.id]] });
  }
  if (!profile) return res.status(404).json({ error: 'Employee not found' });
  if (profile.user_id) await sb.update('users', [['id', 'eq', profile.user_id]], { status: 'inactive' });
  await sb.update('employees', [['id', 'eq', profile.id]], { status: 'Inactive' });
  await logActivity(req.user.id, `Deactivated employee: ${profile.name}`, 'employees', profile.id);
  res.json({ message: 'Employee deactivated' });
}));

router.get('/users/all', authenticateToken, asyncHandler(async (req, res) => {
  const filters = [['status', 'eq', 'active']];
  const employeeType = normalizeEmployeeType(req.query.employee_type);
  if (employeeType) filters.push(['employee_type', 'eq', employeeType]);
  const { data: users } = await sb.list('users', { select: 'id,name,email,role,employee_type', filters, order: 'name.asc' });
  res.json({ users: (users || []).map((user) => ({ ...user, role: normalizeRole(user.role) })).filter((user) => STAFF_ROLES.includes(user.role)) });
}));

router.get('/:id/tasks', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const employee = await sb.one('employees', { select: 'user_id', filters: [['id', 'eq', req.params.id]] });
  if (!employee?.user_id) return res.json({ tasks: [] });
  const { data: tasks } = await sb.list('tasks', { filters: [['assigned_to', 'eq', employee.user_id]], order: 'deadline.asc' });
  const user = await sb.one('users', { select: 'name', filters: [['id', 'eq', employee.user_id]] });
  res.json({ tasks: (tasks || []).map((task) => ({ ...task, assigned_to_name: user?.name || null })) });
}));

module.exports = router;
