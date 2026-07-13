const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUsers } = require('../utils/notifications');
const { assertTransition, transitionLead, recordAssignment, eligibleUser } = require('../utils/managerWorkflow');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { listFallbackDrafts } = require('../utils/emailDraftFallback');

router.use(authenticateToken, requireRole('CEO'));

router.post('/leads/:id/assign-manager', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const manager = await eligibleUser(req.body.manager_id, { role: 'Manager' });
  if (!manager) return res.status(400).json({ error: 'Select an active Manager' });
  if ((lead.workflow_status || 'new') !== 'assigned_to_manager') assertTransition(lead.workflow_status || 'new', 'assigned_to_manager');
  await recordAssignment({ lead, type: 'manager', fromUserId: req.user.id, toUserId: manager.id, instructions: req.body.instructions, priority: req.body.priority, dueDate: req.body.due_date });
  let updated;
  if ((lead.workflow_status || 'new') === 'assigned_to_manager') {
    updated = await sb.update('leads', [['id', 'eq', lead.id]], { manager_id: manager.id, current_owner_id: manager.id, priority: req.body.priority || 'Normal', manager_due_date: req.body.due_date || null, manager_assignment_notes: req.body.instructions || null, assigned_to_manager_at: new Date().toISOString(), assigned_to_manager_by: req.user.id, updated_at: new Date().toISOString() });
    await sb.insert('lead_activity', { lead_id: lead.id, event_type: 'manager_reassigned', performed_by_user_id: req.user.id, previous_status: 'assigned_to_manager', new_status: 'assigned_to_manager', metadata: { manager_id: manager.id } });
  } else {
    updated = await transitionLead(lead, 'assigned_to_manager', req.user, 'Admin assigned Manager', { manager_id: manager.id }, { manager_id: manager.id, current_owner_id: manager.id, priority: req.body.priority || 'Normal', manager_due_date: req.body.due_date || null, manager_assignment_notes: req.body.instructions || null, assigned_to_manager_at: new Date().toISOString(), assigned_to_manager_by: req.user.id });
  }
  await notifyUsers([manager.id], { lead_id: lead.id, type: 'manager_assignment', title: 'Lead assigned for management', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.delete('/leads/:id/manager', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.manager_id) return res.status(409).json({ error: 'This lead has no Manager assignment' });
  if (!['assigned_to_manager', 'new'].includes(lead.workflow_status || 'new')) return res.status(409).json({ error: 'Manager assignment cannot be removed after downstream work has started' });
  await sb.update('lead_assignments', [['lead_id', 'eq', lead.id], ['assignment_type', 'eq', 'manager'], ['status', 'eq', 'active']], { active: false, status: 'cancelled', completed_at: new Date().toISOString() });
  const previousManager = lead.manager_id;
  const updated = (lead.workflow_status || 'new') === 'assigned_to_manager'
    ? await transitionLead(lead, 'new', req.user, 'Admin removed Manager assignment', { manager_id: previousManager }, { manager_id: null, current_owner_id: null, manager_due_date: null, manager_assignment_notes: null })
    : await sb.update('leads', [['id', 'eq', lead.id]], { manager_id: null, current_owner_id: null, manager_due_date: null, manager_assignment_notes: null, updated_at: new Date().toISOString() });
  await notifyUsers([previousManager], { lead_id: lead.id, type: 'manager_assignment_removed', title: 'Lead assignment removed', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.get('/leads/completed-by-manager', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, interest_status } = req.query;
  const { offset, page: pageNum, limit: limitNum } = pageOptions(page, limit);
  const filters = [['manager_completed_at', 'not', 'is.null']];
  if (interest_status) filters.push(['interest_status', 'eq', interest_status]);
  const or = search ? `(lead_id.ilike.*${search}*,company_name.ilike.*${search}*,client_clinic_name.ilike.*${search}*,clinic_email.ilike.*${search}*)` : undefined;
  const { data, count } = await sb.list('leads', { filters, or, order: 'manager_completed_at.desc', limit: limitNum, offset, count: true });
  const users = await mapById(sb, 'users', (data || []).flatMap((lead) => [lead.manager_id, lead.lead_generator_id, lead.caller_id]));
  const leads = (data || []).map((lead) => ({ ...lead, manager_name: users.get(Number(lead.manager_id))?.name || null, lead_generator_name: users.get(Number(lead.lead_generator_id))?.name || null, caller_name: users.get(Number(lead.caller_id))?.name || null }));
  res.json({ leads, total: count, page: pageNum, limit: limitNum });
}));

router.get('/leads/:id/full-history', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const [assignments, statuses, activities, calls, emails, outcome] = await Promise.all([
    sb.list('lead_assignments', { filters: [['lead_id', 'eq', lead.id]], order: 'assigned_at.asc', limit: 1000 }),
    sb.list('lead_status_history', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.asc', limit: 1000 }),
    sb.list('lead_activity', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.asc', limit: 1000 }),
    sb.list('caller_outcomes', { filters: [['lead_id', 'eq', lead.id]], order: 'completed_at.asc', limit: 100 }),
    sb.list('lead_email_followups', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.asc', limit: 100 }),
    sb.one('lead_manager_outcomes', { filters: [['lead_id', 'eq', lead.id]] })
  ]);
  const fallbackEmails = await listFallbackDrafts(lead.id);
  const stages = new Set((emails.data || []).map((email) => `${email.manager_id}:${email.email_stage}`));
  const allEmails = [...(emails.data || []), ...fallbackEmails.filter((email) => !stages.has(`${email.manager_id}:${email.email_stage}`))];
  res.json({ lead, assignments: assignments.data || [], statusHistory: statuses.data || [], activities: activities.data || [], callerOutcomes: calls.data || [], emails: allEmails, managerOutcome: outcome });
}));

module.exports = router;
