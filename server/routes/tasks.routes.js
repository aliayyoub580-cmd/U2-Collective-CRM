const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');

function priorityRank(priority) {
  return { Urgent: 1, High: 2, Medium: 3, Low: 4 }[priority] || 5;
}

async function activeLeadGenerator(userId) {
  return sb.one('users', {
    select: 'id,name',
    filters: [['id', 'eq', userId], ['employee_type', 'eq', 'lead_generator'], ['status', 'eq', 'active']]
  });
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, priority, assigned_to, page = 1, limit = 20 } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const filters = [];

  if (req.user.role === 'Employee') filters.push(['assigned_to', 'eq', req.user.id]);
  else if (assigned_to) filters.push(['assigned_to', 'eq', assigned_to]);
  if (status) filters.push(['status', 'eq', status]);
  if (priority) filters.push(['priority', 'eq', priority]);

  const { data, count: total } = await sb.list('tasks', {
    filters,
    order: 'deadline.asc',
    limit: limitNum,
    offset,
    count: true
  });

  const userMap = await mapById(sb, 'users', [
    ...(data || []).map((t) => t.assigned_to),
    ...(data || []).map((t) => t.created_by)
  ]);
  const tasks = (data || [])
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .map((task) => ({
      ...task,
      assigned_to_name: userMap.get(Number(task.assigned_to))?.name || null,
      created_by_name: userMap.get(Number(task.created_by))?.name || null
    }));

  res.json({ tasks, total });
}));

router.post('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { title, description, assigned_to, deadline, priority, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!assigned_to) return res.status(400).json({ error: 'Assigned employee is required' });
  if (!deadline) return res.status(400).json({ error: 'Deadline is required' });
  if (!await activeLeadGenerator(assigned_to)) return res.status(400).json({ error: 'Select an active lead generator' });

  const task = await sb.insert('tasks', {
    title,
    description,
    assigned_to,
    created_by: req.user.id,
    deadline,
    priority: priority || 'Medium',
    status: status || 'Pending'
  });

  await logActivity(req.user.id, 'Created task: ' + title, 'tasks', task.id);
  res.status(201).json({ task });
}));

router.put('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { title, description, assigned_to, deadline, priority, status } = req.body;
  const existing = await sb.one('tasks', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!await activeLeadGenerator(assigned_to)) return res.status(400).json({ error: 'Select an active lead generator' });

  const task = await sb.update('tasks', [['id', 'eq', req.params.id]], {
    title,
    description,
    assigned_to,
    deadline,
    priority,
    status
  });
  res.json({ task });
}));

router.delete('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const existing = await sb.one('tasks', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  await sb.remove('tasks', [['id', 'eq', req.params.id]]);
  res.json({ message: 'Task deleted' });
}));

router.patch('/:id/status', authenticateToken, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const task = await sb.one('tasks', { filters: [['id', 'eq', req.params.id]] });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role === 'Employee' && Number(task.assigned_to) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Cannot update this task' });
  }

  await sb.update('tasks', [['id', 'eq', req.params.id]], { status });
  await logActivity(req.user.id, `Updated task status to ${status}`, 'tasks', req.params.id);
  res.json({ message: 'Status updated', status });
}));

module.exports = router;
