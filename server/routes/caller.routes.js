const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUsers } = require('../utils/notifications');
const { assertTransition, transitionLead } = require('../utils/managerWorkflow');

router.use(authenticateToken, (req, res, next) => req.user.employee_type === 'caller' ? next() : res.status(403).json({ error: 'Caller access required' }));

router.get('/leads', asyncHandler(async (req, res) => {
  const { data } = await sb.list('leads', { filters: [['caller_id', 'eq', req.user.id]], order: 'updated_at.desc', limit: 1000 });
  const managerIds = [...new Set((data || []).map((lead) => lead.manager_id).filter(Boolean))];
  const managers = managerIds.length ? await sb.list('users', { select: 'id,name,email', in: [['id', managerIds]] }) : { data: [] };
  const profiles = managerIds.length ? await sb.list('employees', { select: 'user_id,phone', in: [['user_id', managerIds]] }) : { data: [] };
  const leadIds = (data || []).map((lead) => lead.id);
  const assignments = leadIds.length ? await sb.list('lead_assignments', { select: 'lead_id,assigned_at', filters: [['assignment_type', 'eq', 'caller'], ['status', 'eq', 'active']], in: [['lead_id', leadIds]] }) : { data: [] };
  const profileMap = new Map((profiles.data || []).map((profile) => [Number(profile.user_id), profile]));
  const assignmentMap = new Map((assignments.data || []).map((assignment) => [Number(assignment.lead_id), assignment]));
  const managerMap = new Map((managers.data || []).map((manager) => [Number(manager.id), { ...manager, work_phone: profileMap.get(Number(manager.id))?.phone || null }]));
  res.json({ leads: (data || []).map((lead) => ({ ...lead, manager: managerMap.get(Number(lead.manager_id)) || null, assigned_at: assignmentMap.get(Number(lead.id))?.assigned_at || null })) });
}));

router.get('/leads/:id', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['caller_id', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Assigned lead not found' });
  const manager = lead.manager_id ? await sb.one('users', { select: 'id,name,email', filters: [['id', 'eq', lead.manager_id]] }) : null;
  const managerProfile = lead.manager_id ? await sb.one('employees', { select: 'phone', filters: [['user_id', 'eq', lead.manager_id]] }) : null;
  const { data: outcomes } = await sb.list('caller_outcomes', { filters: [['lead_id', 'eq', lead.id], ['caller_id', 'eq', req.user.id]], order: 'completed_at.desc', limit: 100 });
  res.json({ lead: { ...lead, manager: manager ? { ...manager, work_phone: managerProfile?.phone || null } : null }, outcomes: outcomes || [] });
}));

router.post('/leads/:id/start', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['caller_id', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Assigned lead not found' });
  const updated = await transitionLead(lead, 'caller_in_progress', req.user, 'Caller started outreach');
  res.json({ lead: updated });
}));

router.post('/leads/:id/complete', asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['caller_id', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Assigned lead not found' });
  if (!['assigned_to_caller', 'caller_in_progress'].includes(lead.workflow_status)) return res.status(409).json({ error: 'This caller outcome has already been submitted or is no longer actionable' });
  assertTransition(lead.workflow_status, 'caller_completed');
  const allowedCall = ['Connected', 'No Answer', 'Busy', 'Voicemail', 'Wrong Number', 'Call Back Requested', 'Not Reachable', 'Completed'];
  const allowedInterest = ['Interested', 'Maybe Interested', 'Not Interested', 'Needs Follow-Up', 'Decision Maker Not Reached', 'Unknown'];
  if (!allowedCall.includes(req.body.call_status)) return res.status(400).json({ error: 'Select a valid call status' });
  if (!allowedInterest.includes(req.body.interest_status)) return res.status(400).json({ error: 'Select an interest status' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.call_date || ''))) return res.status(400).json({ error: 'Call date is required' });
  if (req.body.follow_up_required === true && !req.body.follow_up_date) return res.status(400).json({ error: 'Follow-up date is required' });
  const completedAt = new Date().toISOString();
  const outcome = await sb.insert('caller_outcomes', { lead_id: lead.id, caller_id: req.user.id, manager_id: lead.manager_id || null, call_status: req.body.call_status, contact_result: req.body.contact_result || null, contact_person_name: req.body.contact_person_name || null, contact_person_role: req.body.contact_person_role || null, phone_number_used: req.body.phone_number_used || lead.clinic_phone || null, call_date: req.body.call_date, call_time: req.body.call_time || null, call_duration: req.body.call_duration || null, interest_status: req.body.interest_status, follow_up_required: req.body.follow_up_required === true, follow_up_date: req.body.follow_up_date || null, additional_contact_information: req.body.additional_contact_information || null, notes: req.body.notes || null, completed_at: completedAt });
  await sb.insert('call_attempts', { lead_id: lead.id, employee_id: req.user.id, call_status: req.body.call_status === 'No Answer' ? 'No Answer' : 'Called', called_at: `${req.body.call_date}T${req.body.call_time || '12:00'}:00.000Z`, notes: req.body.notes || null });
  if (req.body.follow_up_required === true) await sb.insert('followups', { lead_id: lead.id, title: `Follow up: ${lead.client_clinic_name || lead.company_name}`, followup_date: req.body.follow_up_date, method: 'Phone Call', assigned_to: req.user.id, notes: req.body.notes || null, status: 'Pending' });
  const updated = await transitionLead(lead, 'caller_completed', req.user, 'Caller completed outcome', { outcome_id: outcome.id }, { caller_completed_at: completedAt, caller_completed_by: req.user.id, current_owner_id: lead.manager_id || null, status: 'Called', caller_notes: req.body.notes || null });
  const recipients = [lead.manager_id].filter(Boolean);
  const admins = await sb.list('users', { select: 'id', filters: [['role', 'eq', 'CEO'], ['status', 'eq', 'active']] });
  await notifyUsers([...recipients, ...(admins.data || [])], { lead_id: lead.id, type: 'caller_completed', title: 'Caller completed lead outcome', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}: ${req.body.call_status}` });
  res.status(201).json({ lead: updated, outcome });
}));

module.exports = router;
