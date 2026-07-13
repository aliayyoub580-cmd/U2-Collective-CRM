const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { notifyUsers } = require('../utils/notifications');
const { assertTransition, transitionLead, recordAssignment, eligibleUser } = require('../utils/managerWorkflow');

router.use(authenticateToken, requireRole('Manager'));

const TERMINAL = ['manager_completed', 'not_interested', 'converted', 'rejected', 'cancelled', 'archived'];
const ASSIGNED = ['assigned_to_lead_generator', 'lead_generation_in_progress', 'assigned_to_caller', 'caller_in_progress'];

async function ownedLead(id, managerId) {
  return sb.one('leads', { filters: [['id', 'eq', id], ['manager_id', 'eq', managerId]] });
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const { data } = await sb.list('leads', { filters: [['manager_id', 'eq', req.user.id]], limit: 10000 });
  const leads = data || [];
  res.json({ success: true, data: {
    totalLeads: leads.length,
    assigned: leads.filter((lead) => ASSIGNED.includes(lead.workflow_status)).length,
    pending: leads.filter((lead) => !TERMINAL.includes(lead.workflow_status)).length,
    completedByCaller: leads.filter((lead) => Boolean(lead.caller_completed_at) || ['caller_completed', 'manager_follow_up'].includes(lead.workflow_status)).length,
    completedByManager: leads.filter((lead) => Boolean(lead.manager_completed_at)).length
  } });
}));

router.get('/leads', asyncHandler(async (req, res) => {
  const { status, priority, search, page = 1, limit = 20 } = req.query;
  const { offset, page: pageNum, limit: limitNum } = pageOptions(page, limit);
  const filters = [['manager_id', 'eq', req.user.id]];
  if (status) filters.push(['workflow_status', 'eq', status]);
  if (priority) filters.push(['priority', 'eq', priority]);
  const or = search ? `(lead_id.ilike.*${search}*,company_name.ilike.*${search}*,client_clinic_name.ilike.*${search}*,clinic_email.ilike.*${search}*,clinic_phone.ilike.*${search}*,city.ilike.*${search}*,state.ilike.*${search}*)` : undefined;
  const { data, count } = await sb.list('leads', { filters, or, order: 'updated_at.desc', limit: limitNum, offset, count: true });
  const users = await mapById(sb, 'users', (data || []).flatMap((lead) => [lead.lead_generator_id, lead.caller_id]));
  const leads = (data || []).map((lead) => ({ ...lead, lead_generator_name: users.get(Number(lead.lead_generator_id))?.name || null, caller_name: users.get(Number(lead.caller_id))?.name || null }));
  res.json({ leads, total: count, page: pageNum, limit: limitNum });
}));

router.get('/leads/:id', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  assertTransition(lead.workflow_status || 'new', 'assigned_to_lead_generator');
  const [assignments, statuses, activities, callerOutcomes, emails, managerOutcome, users] = await Promise.all([
    sb.list('lead_assignments', { filters: [['lead_id', 'eq', lead.id]], order: 'assigned_at.desc', limit: 1000 }),
    sb.list('lead_status_history', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.desc', limit: 1000 }),
    sb.list('lead_activity', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.desc', limit: 1000 }),
    sb.list('caller_outcomes', { filters: [['lead_id', 'eq', lead.id]], order: 'completed_at.desc', limit: 100 }),
    sb.list('lead_email_followups', { filters: [['lead_id', 'eq', lead.id]], order: 'created_at.asc', limit: 100 }),
    sb.one('lead_manager_outcomes', { filters: [['lead_id', 'eq', lead.id]] }),
    mapById(sb, 'users', [lead.manager_id, lead.lead_generator_id, lead.caller_id])
  ]);
  const now = Date.now();
  const emailsWithDueState = (emails.data || []).map((email) => ({ ...email, due_state: ['sent','cancelled','skipped'].includes(email.status) ? email.status : email.scheduled_for && new Date(email.scheduled_for).getTime() < now ? 'overdue' : 'upcoming' }));
  res.json({ lead: { ...lead, manager_name: users.get(Number(lead.manager_id))?.name || null, lead_generator_name: users.get(Number(lead.lead_generator_id))?.name || null, caller_name: users.get(Number(lead.caller_id))?.name || null }, assignments: assignments.data || [], statusHistory: statuses.data || [], activities: activities.data || [], callerOutcomes: callerOutcomes.data || [], emails: emailsWithDueState, managerOutcome });
}));

router.post('/leads/:id/assign-lead-generator', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  assertTransition(lead.workflow_status || 'new', 'lead_generation_in_progress');
  const generator = await eligibleUser(req.body.lead_generator_id, { role: 'Employee', employeeType: 'lead_generator' });
  if (!generator) return res.status(400).json({ error: 'Select an active Lead Generator' });
  await recordAssignment({ lead, type: 'lead_generator', fromUserId: req.user.id, toUserId: generator.id, instructions: req.body.instructions, priority: req.body.priority, dueDate: req.body.due_date });
  const updated = await transitionLead(lead, 'assigned_to_lead_generator', req.user, 'Assigned to Lead Generator', { assignee: generator.id }, { lead_generator_id: generator.id, current_owner_id: generator.id, priority: req.body.priority || 'Normal', lead_generation_due_date: req.body.due_date || null, lead_generation_instructions: req.body.instructions || null, assigned_to_lead_generator_at: new Date().toISOString(), assigned_to_lead_generator_by: req.user.id });
  await notifyUsers([generator.id], { lead_id: lead.id, type: 'lead_generator_assignment', title: 'Lead generation work assigned', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.post('/leads/:id/return-to-lead-generator', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  assertTransition(lead.workflow_status || 'new', 'approved_for_caller');
  if (!lead.lead_generator_id) return res.status(409).json({ error: 'No Lead Generator is assigned' });
  if (!req.body.review_notes?.trim()) return res.status(400).json({ error: 'Review notes are required' });
  const updated = await transitionLead(lead, 'lead_generation_in_progress', req.user, 'Returned for correction', { review_notes: req.body.review_notes }, { current_owner_id: lead.lead_generator_id, review_notes: req.body.review_notes.trim() });
  await notifyUsers([lead.lead_generator_id], { lead_id: lead.id, type: 'lead_returned', title: 'Lead returned for correction', message: `${lead.lead_id}: ${req.body.review_notes.trim()}` });
  res.json({ lead: updated });
}));

router.post('/leads/:id/approve', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  assertTransition(lead.workflow_status || 'new', 'rejected');
  const updated = await transitionLead(lead, 'approved_for_caller', req.user, 'Approved for Caller', { review_notes: req.body.review_notes || null }, { current_owner_id: req.user.id, review_notes: req.body.review_notes || null });
  res.json({ lead: updated });
}));

router.post('/leads/:id/reject', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  assertTransition(lead.workflow_status || 'new', 'assigned_to_caller');
  if (!req.body.review_notes?.trim()) return res.status(400).json({ error: 'A rejection reason is required' });
  const updated = await transitionLead(lead, 'rejected', req.user, 'Rejected by Manager', { review_notes: req.body.review_notes.trim() }, { current_owner_id: req.user.id, review_notes: req.body.review_notes.trim(), status: 'Rejected' });
  if (lead.lead_generator_id) await notifyUsers([lead.lead_generator_id], { lead_id: lead.id, type: 'lead_rejected', title: 'Lead rejected by Manager', message: `${lead.lead_id}: ${req.body.review_notes.trim()}` });
  res.json({ lead: updated });
}));

router.post('/leads/:id/assign-caller', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.workflow_status !== 'manager_follow_up') assertTransition(lead.workflow_status || 'new', 'manager_follow_up');
  const caller = await eligibleUser(req.body.caller_id, { role: 'Employee', employeeType: 'caller' });
  if (!caller) return res.status(400).json({ error: 'Select an active Caller' });
  await recordAssignment({ lead, type: 'caller', fromUserId: req.user.id, toUserId: caller.id, instructions: req.body.instructions, priority: req.body.priority, dueDate: req.body.due_date });
  const updated = await transitionLead(lead, 'assigned_to_caller', req.user, 'Assigned to Caller', { assignee: caller.id }, { caller_id: caller.id, assigned_to: caller.id, current_owner_id: caller.id, priority: req.body.priority || lead.priority || 'Normal', caller_due_date: req.body.due_date || null, caller_instructions: req.body.instructions || null, assigned_to_caller_at: new Date().toISOString(), assigned_to_caller_by: req.user.id, status: 'Assigned' });
  await notifyUsers([caller.id], { lead_id: lead.id, type: 'lead_assigned', title: 'New lead assigned by Manager', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.post('/leads/:id/email', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const stage = req.body.email_stage;
  if (!['initial', 'day_3', 'day_7', 'day_14'].includes(stage)) return res.status(400).json({ error: 'Invalid email stage' });
  if (!req.body.subject?.trim() || !req.body.message_body?.trim()) return res.status(400).json({ error: 'Subject and message are required' });
  const recipient = req.body.recipient_email || lead.clinic_email;
  if (!recipient) return res.status(400).json({ error: 'Clinic email is required' });
  const existing = await sb.one('lead_email_followups', { filters: [['lead_id', 'eq', lead.id], ['manager_id', 'eq', req.user.id], ['email_stage', 'eq', stage]] });
  if (existing) return res.status(409).json({ error: 'This email stage already exists' });
  let scheduledFor = req.body.scheduled_for || new Date().toISOString();
  if (stage !== 'initial') {
    const initial = await sb.one('lead_email_followups', { filters: [['lead_id', 'eq', lead.id], ['manager_id', 'eq', req.user.id], ['email_stage', 'eq', 'initial']] });
    if (!initial) return res.status(409).json({ error: 'Create the Initial Email first' });
    const days = { day_3: 3, day_7: 7, day_14: 14 }[stage];
    const base = new Date(initial.sent_at || initial.created_at);
    base.setUTCDate(base.getUTCDate() + days);
    scheduledFor = base.toISOString();
  }
  const email = await sb.insert('lead_email_followups', { lead_id: lead.id, manager_id: req.user.id, recipient_email: recipient, cc: req.body.cc || null, subject: req.body.subject.trim(), message_body: req.body.message_body.trim(), email_stage: stage, scheduled_for: scheduledFor, status: 'draft' });
  if (!['manager_follow_up'].includes(lead.workflow_status)) await transitionLead(lead, 'manager_follow_up', req.user, 'Manager email follow-up started', { email_stage: stage });
  res.status(201).json({ email, delivery: 'draft', message: 'Saved as draft because no verified mail provider is configured' });
}));

router.post('/leads/:id/complete', asyncHandler(async (req, res) => {
  const lead = await ownedLead(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.manager_completed_at) return res.status(409).json({ error: 'This lead has already been completed by the Manager' });
  const interest = req.body.interest_status;
  const allowed = ['interested', 'maybe_interested', 'not_interested', 'needs_more_information', 'follow_up_required', 'converted', 'no_response', 'invalid_lead'];
  if (!allowed.includes(interest)) return res.status(400).json({ error: 'Select a final interest status' });
  if (!req.body.manager_notes?.trim() || !req.body.communication_summary?.trim() || !req.body.closure_reason?.trim() || req.body.confirmed !== true) return res.status(400).json({ error: 'Manager notes, communication summary, closure reason and confirmation are required' });
  if (interest === 'not_interested' && !req.body.reason_not_interested?.trim()) return res.status(400).json({ error: 'Reason Not Interested is required' });
  if (interest === 'follow_up_required' && !req.body.next_follow_up_at) return res.status(400).json({ error: 'Next follow-up date is required' });
  if (interest === 'converted' && !req.body.conversion_details?.trim()) return res.status(400).json({ error: 'Conversion details are required' });
  if (interest === 'invalid_lead' && !req.body.closure_reason?.trim()) return res.status(400).json({ error: 'Invalid lead reason is required' });
  const completedAt = new Date().toISOString();
  const terminalStatus = interest === 'converted' ? 'converted' : interest === 'not_interested' || interest === 'invalid_lead' ? 'not_interested' : 'manager_completed';
  assertTransition(lead.workflow_status || 'new', terminalStatus);
  const outcome = await sb.upsert('lead_manager_outcomes', [{ lead_id: lead.id, manager_id: req.user.id, interest_status: interest, decision_maker_name: req.body.decision_maker_name || null, decision_maker_role: req.body.decision_maker_role || null, preferred_contact_method: req.body.preferred_contact_method || null, next_step: req.body.next_step || null, next_follow_up_at: req.body.next_follow_up_at || null, reason_not_interested: req.body.reason_not_interested || null, conversion_details: req.body.conversion_details || null, manager_notes: req.body.manager_notes.trim(), communication_summary: req.body.communication_summary.trim(), closure_reason: req.body.closure_reason.trim(), completed_at: completedAt }], 'lead_id');
  const updated = await transitionLead(lead, terminalStatus, req.user, 'Manager completed lead', { interest_status: interest }, { interest_status: interest, manager_notes: req.body.manager_notes.trim(), closure_reason: req.body.closure_reason.trim(), conversion_details: req.body.conversion_details || null, next_follow_up_at: req.body.next_follow_up_at || null, manager_completed_at: completedAt, manager_completed_by: req.user.id, current_owner_id: req.user.id, status: terminalStatus === 'converted' ? 'Contracted' : terminalStatus === 'not_interested' ? 'Not Interested' : 'Completed' });
  const admins = await sb.list('users', { select: 'id', filters: [['role', 'eq', 'CEO'], ['status', 'eq', 'active']] });
  await notifyUsers(admins.data || [], { lead_id: lead.id, type: 'manager_completed', title: 'Manager completed a lead', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name} (${interest})` });
  res.json({ lead: updated, outcome: outcome[0] });
}));

module.exports = router;
