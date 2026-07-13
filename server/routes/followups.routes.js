const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { isFollowUpStatus, normalizeValue, leadDisplayName } = require('../utils/leadWorkflow');
const { notifyUsers, usersByRole } = require('../utils/notifications');

function followupSnapshot(followup) {
  return [
    `Lead ID: ${followup?.lead_id || '-'}`,
    `Title: ${followup?.title || '-'}`,
    `Date: ${followup?.followup_date || '-'}`,
    `Time: ${followup?.followup_time || '-'}`,
    `Method: ${followup?.method || '-'}`,
    `Status: ${followup?.status || '-'}`,
    `Notes: ${followup?.notes || '-'}`,
    `Interest: ${followup?.interest_status || '-'}`,
    `Contract: ${followup?.contract_type || '-'}`,
    `Reason: ${followup?.not_interested_reason || '-'}`,
    `Assigned To: ${followup?.assigned_to || '-'}`,
    `Resolved At: ${followup?.resolved_at || '-'}`
  ].join(', ');
}

async function notifyFollowupAudit(actor, action, before, after) {
  const admins = await usersByRole('CEO');
  const leadId = after?.lead_id || before?.lead_id;
  const lead = leadId ? await sb.one('leads', { select: 'manager_id', filters: [['id', 'eq', leadId]] }) : null;
  await notifyUsers([...admins, lead?.manager_id].filter(Boolean), {
    lead_id: after?.lead_id || before?.lead_id || null,
    type: 'followup_audit',
    title: `Follow-up ${action} by ${actor.name}`,
    message: `Before — ${followupSnapshot(before)} | After — ${followupSnapshot(after)}`
  });
}

async function managerCanAccessFollowup(user, followup) {
  if (user.role !== 'Manager') return true;
  if (!followup?.lead_id) return false;
  return Boolean(await sb.one('leads', { select: 'id', filters: [['id', 'eq', followup.lead_id], ['manager_id', 'eq', user.id]] }));
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { date, assigned_to, status, page = 1, limit = 20, today, overdue } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const todayDate = new Date().toISOString().split('T')[0];
  const filters = [];

  if (req.user.employee_type === 'caller') filters.push(['assigned_to', 'eq', req.user.id]);
  if (today === 'true') filters.push(['followup_date', 'eq', todayDate]);
  if (overdue === 'true') {
    filters.push(['followup_date', 'lt', todayDate]);
    filters.push(['status', 'eq', 'Pending']);
  }
  if (date) filters.push(['followup_date', 'eq', date]);
  if (assigned_to) filters.push(['assigned_to', 'eq', assigned_to]);
  if (status) filters.push(['status', 'eq', status]);

  const { data } = await sb.list('followups', {
    filters,
    order: 'followup_date.asc,followup_time.asc',
    limit: 10000
  });

  const [leadMap, userMap] = await Promise.all([
    mapById(sb, 'leads', (data || []).map((f) => f.lead_id), 'id,lead_id,company_name,client_clinic_name,clinic_email,clinic_phone,source,service_interested,status,assigned_to,manager_id'),
    mapById(sb, 'users', [
      ...(data || []).map((f) => f.assigned_to)
    ])
  ]);

  const leadFilters = [];
  if (req.user.role === 'Manager') {
    leadFilters.push(['manager_id', 'eq', req.user.id]);
  } else if (req.user.role === 'Sales Representative' || req.user.role === 'Employee') {
    leadFilters.push(['assigned_to', 'eq', req.user.id]);
  } else if (assigned_to) {
    leadFilters.push(['assigned_to', 'eq', assigned_to]);
  }

  const leadRows = await sb.list('leads', {
    filters: leadFilters,
    order: 'created_at.desc',
    limit: 10000
  });
  const followUpLeads = (leadRows.data || []).filter((lead) => {
    if (!isFollowUpStatus(lead.status)) return false;
    if (status && normalizeValue(status) !== normalizeValue(lead.status)) return false;
    if (today === 'true' || overdue === 'true' || date) return false;
    return true;
  });
  const callLeadIds = [...new Set([
    ...(data || []).map((followup) => Number(followup.lead_id)).filter(Boolean),
    ...followUpLeads.map((lead) => Number(lead.id)).filter(Boolean)
  ])];
  const callAttempts = callLeadIds.length
    ? await sb.list('call_attempts', { select: 'lead_id,called_at', in: [['lead_id', callLeadIds]], order: 'called_at.desc', limit: 10000 })
    : { data: [] };
  const callDateByLead = new Map();
  (callAttempts.data || []).forEach((attempt) => {
    const leadId = Number(attempt.lead_id);
    if (!callDateByLead.has(leadId)) callDateByLead.set(leadId, String(attempt.called_at || '').slice(0, 10) || null);
  });
  let followups = (data || []).filter((followup) => req.user.role !== 'Manager' || Number(leadMap.get(Number(followup.lead_id))?.manager_id) === Number(req.user.id)).map((followup) => {
    const lead = leadMap.get(Number(followup.lead_id));
    return {
      ...followup,
      call_date: callDateByLead.get(Number(followup.lead_id)) || null,
      lead_public_id: lead?.lead_id || null,
      lead_name: leadDisplayName(lead),
      client_clinic_name: leadDisplayName(lead),
      clinic_email: lead?.clinic_email || null,
      clinic_phone: lead?.clinic_phone || null,
      source: lead?.source || null,
      service_interested: lead?.service_interested || null,
      assigned_to_name: userMap.get(Number(followup.assigned_to))?.name || null
    };
  });
  const leadAssigneeMap = await mapById(sb, 'users', followUpLeads.map((lead) => lead.assigned_to));
  const virtualFollowups = followUpLeads.map((lead) => ({
    id: `lead-${lead.id}`,
    lead_id: lead.id,
    lead_public_id: lead.lead_id || null,
    title: leadDisplayName(lead),
    call_date: callDateByLead.get(Number(lead.id)) || null,
    followup_date: null,
    followup_time: null,
    method: lead.source || null,
    notes: lead.notes || null,
    status: lead.status || 'Follow up',
    assigned_to: lead.assigned_to,
    assigned_to_name: leadAssigneeMap.get(Number(lead.assigned_to))?.name || null,
    lead_name: leadDisplayName(lead),
    client_clinic_name: leadDisplayName(lead),
    clinic_email: lead.clinic_email || null,
    clinic_phone: lead.clinic_phone || null,
    source: lead.source || null,
    service_interested: lead.service_interested || null,
    created_at: lead.created_at,
    is_lead_followup: true
  }));

  followups = [...virtualFollowups, ...followups];
  const counts = {
    all: followups.length,
    today: followups.filter((f) => f.followup_date === todayDate && f.status === 'Pending').length,
    overdue: followups.filter((f) => f.followup_date && f.followup_date < todayDate && f.status === 'Pending').length,
    completed: followups.filter((f) => f.status === 'Completed').length
  };
  const total = followups.length;
  const paged = followups.slice(offset, offset + limitNum);

  res.json({ followups: paged, total, counts });
}));

router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { lead_id, title, followup_date, followup_time, method, notes, assigned_to } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (req.user.role === 'Manager' && !await managerCanAccessFollowup(req.user, { lead_id })) return res.status(404).json({ error: 'Lead not found' });

  const followup = await sb.insert('followups', {
    lead_id: lead_id || null,
    title,
    followup_date,
    followup_time,
    method,
    notes,
    assigned_to: assigned_to || req.user.id
  });

  await logActivity(req.user.id, 'Created follow-up: ' + title, 'followups', followup.id);
  res.status(201).json({ followup });
}));

router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { lead_id, title, followup_date, followup_time, method, notes, status, assigned_to } = req.body;
  const existing = await sb.one('followups', { filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Follow-up not found' });
  if (!await managerCanAccessFollowup(req.user, existing)) return res.status(404).json({ error: 'Follow-up not found' });
  if (req.user.employee_type === 'caller' && Number(existing.assigned_to) !== Number(req.user.id)) return res.status(403).json({ error: 'This follow-up is not assigned to you' });

  const updates = {
    title,
    followup_date,
    followup_time,
    notes,
    status
  };
  if (req.user.employee_type !== 'caller') Object.assign(updates, {
    lead_id: lead_id || null,
    method,
    assigned_to
  });
  const followup = await sb.update('followups', [['id', 'eq', req.params.id]], updates);
  if (req.user.employee_type === 'caller') await notifyFollowupAudit(req.user, 'edited', existing, followup);
  res.json({ followup });
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const existing = await sb.one('followups', { select: 'id,lead_id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Follow-up not found' });
  if (!await managerCanAccessFollowup(req.user, existing)) return res.status(404).json({ error: 'Follow-up not found' });
  await sb.remove('followups', [['id', 'eq', req.params.id]]);
  res.json({ message: 'Follow-up deleted' });
}));

router.patch('/:id/complete', authenticateToken, asyncHandler(async (req, res) => {
  const existing = await sb.one('followups', { filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Follow-up not found' });
  if (!await managerCanAccessFollowup(req.user, existing)) return res.status(404).json({ error: 'Follow-up not found' });
  if (req.user.employee_type === 'caller' && Number(existing.assigned_to) !== Number(req.user.id)) return res.status(403).json({ error: 'This follow-up is not assigned to you' });
  const completed = await sb.update('followups', [['id', 'eq', req.params.id]], { status: 'Completed' });
  await logActivity(req.user.id, 'Completed follow-up', 'followups', req.params.id);
  if (req.user.employee_type === 'caller') await notifyFollowupAudit(req.user, 'completed', existing, completed);
  res.json({ message: 'Follow-up marked as completed' });
}));

router.patch('/:id/resolve', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type !== 'caller') return res.status(403).json({ error: 'Only Callers can resolve reminders' });
  const followup = await sb.one('followups', { filters: [['id', 'eq', req.params.id], ['assigned_to', 'eq', req.user.id]] });
  if (!followup) return res.status(404).json({ error: 'Reminder not found' });
  const interestStatus = req.body.interest_status;
  if (!['Interested', 'Not Interested'].includes(interestStatus)) return res.status(400).json({ error: 'Select an interest status' });
  if (interestStatus === 'Interested' && !['Outsource', 'In-House Billing', 'Freelancer'].includes(req.body.contract_type)) return res.status(400).json({ error: 'Select a contract type' });
  if (interestStatus === 'Not Interested' && !req.body.not_interested_reason?.trim()) return res.status(400).json({ error: 'A reason is required' });
  const resolved = await sb.update('followups', [['id', 'eq', followup.id]], {
    interest_status: interestStatus,
    contract_type: interestStatus === 'Interested' ? req.body.contract_type : null,
    not_interested_reason: interestStatus === 'Not Interested' ? req.body.not_interested_reason.trim() : null,
    status: 'Completed',
    resolved_at: new Date().toISOString()
  });
  const lead = await sb.one('leads', { filters: [['id', 'eq', followup.lead_id]] });
  if (interestStatus === 'Interested') {
    await sb.update('leads', [['id', 'eq', lead.id]], { status: 'Interested' });
    const admins = await usersByRole('CEO');
    await notifyUsers(admins, { lead_id: lead.id, type: 'interested_lead', title: 'New Interested Lead', message: `${lead.lead_id} - ${leadDisplayName(lead)}` });
  } else {
    const managers = await usersByRole('Manager');
    const manager = managers[0];
    await sb.update('leads', [['id', 'eq', lead.id]], { status: 'Not Interested', assigned_to: manager?.id || null });
    await notifyUsers(managers, { lead_id: lead.id, type: 'manager_review', title: 'Lead Needs Manager Review', message: `${lead.lead_id} - ${leadDisplayName(lead)}` });
  }
  await logActivity(req.user.id, `${interestStatus}: ${lead.lead_id}`, 'leads', lead.id);
  await notifyFollowupAudit(req.user, 'resolved', followup, resolved);
  res.json({ message: `Lead marked ${interestStatus}` });
}));

module.exports = router;
