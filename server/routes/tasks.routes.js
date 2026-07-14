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

router.get('/assigned-leads', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type !== 'caller') return res.status(403).json({ error: 'Only callers can view assigned leads' });
  const { data } = await sb.list('leads', {
    filters: [['assigned_to', 'eq', req.user.id]],
    order: 'created_at.desc',
    limit: 100
  });
  res.json({ leads: data || [] });
}));

router.post('/assigned-leads/:id/call', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type !== 'caller') return res.status(403).json({ error: 'Only callers can record calls' });
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['assigned_to', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Assigned lead not found' });
  if (!['Called', 'No Answer'].includes(req.body.call_status)) return res.status(400).json({ error: 'Invalid call status' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.call_date || ''))) return res.status(400).json({ error: 'Call date is required' });

  const attempt = await sb.insert('call_attempts', {
    lead_id: lead.id,
    employee_id: req.user.id,
    call_status: req.body.call_status,
    called_at: `${req.body.call_date}T12:00:00.000Z`,
    notes: req.body.notes || null
  });
  const leadUpdate = { status: req.body.call_status };
  if (req.body.call_status === 'Called') Object.assign(leadUpdate, {
    practice_manager_name: req.body.practice_manager_name || null,
    practice_manager_phone: req.body.practice_manager_phone || null,
    practice_manager_email: req.body.practice_manager_email || null,
    practice_manager_linkedin: req.body.practice_manager_linkedin || null,
    practice_manager_position: req.body.practice_manager_position || null
  });
  await sb.update('leads', [['id', 'eq', lead.id]], leadUpdate);

  let followup = null;
  if (req.body.call_status === 'Called' && req.body.followup_date) {
    followup = await sb.insert('followups', {
      lead_id: lead.id,
      title: `Follow up: ${lead.client_clinic_name || lead.company_name}`,
      followup_date: req.body.followup_date,
      followup_time: req.body.followup_time || null,
      method: 'Phone Call',
      assigned_to: req.user.id,
      status: 'Pending'
    });
    await logActivity(req.user.id, `Reminder Added for ${lead.lead_id}`, 'followups', followup.id);
  }
  await logActivity(req.user.id, `${req.body.call_status}: ${lead.lead_id}`, 'leads', lead.id);
  res.status(201).json({ attempt, followup });
}));

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
  const { title, description, assigned_to, deadline, priority, status, lead_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!assigned_to) return res.status(400).json({ error: 'Assigned employee is required' });
  if (!deadline) return res.status(400).json({ error: 'Deadline is required' });
  if (!await activeLeadGenerator(assigned_to)) return res.status(400).json({ error: 'Select an active lead generator' });
  if (lead_id) {
    const leadFilters = [['id', 'eq', lead_id]];
    if (req.user.role === 'Manager') leadFilters.push(['manager_id', 'eq', req.user.id]);
    const lead = await sb.one('leads', { select: 'id,lead_generator_id', filters: leadFilters });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (Number(lead.lead_generator_id) !== Number(assigned_to)) return res.status(400).json({ error: 'Assign this task to the Lead Generator who created the lead' });
  }

  const task = await sb.insert('tasks', {
    lead_id: lead_id || null,
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
