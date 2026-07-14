const sb = require('../database/supabaseClient');
const { logActivity } = require('./activity');

const WORKFLOW_STATUSES = [
  'new', 'assigned_to_manager', 'assigned_to_lead_generator', 'lead_generation_in_progress',
  'submitted_by_lead_generator', 'under_manager_review', 'approved_for_caller',
  'assigned_to_caller', 'caller_in_progress', 'caller_completed', 'manager_follow_up',
  'manager_completed', 'not_interested', 'converted', 'rejected', 'cancelled', 'archived'
];

const TRANSITIONS = {
  new: ['assigned_to_manager', 'assigned_to_caller', 'submitted_by_lead_generator', 'cancelled'],
  assigned_to_manager: ['new', 'assigned_to_caller', 'submitted_by_lead_generator', 'under_manager_review', 'approved_for_caller', 'cancelled'],
  assigned_to_lead_generator: ['lead_generation_in_progress', 'submitted_by_lead_generator', 'cancelled'],
  lead_generation_in_progress: ['submitted_by_lead_generator', 'cancelled'],
  submitted_by_lead_generator: ['under_manager_review', 'approved_for_caller', 'lead_generation_in_progress', 'rejected'],
  under_manager_review: ['approved_for_caller', 'lead_generation_in_progress', 'rejected'],
  approved_for_caller: ['assigned_to_caller', 'manager_follow_up', 'rejected'],
  assigned_to_caller: ['caller_in_progress', 'caller_completed', 'cancelled'],
  caller_in_progress: ['caller_completed', 'assigned_to_caller'],
  caller_completed: ['manager_follow_up', 'assigned_to_caller', 'manager_completed', 'not_interested', 'converted'],
  manager_follow_up: ['assigned_to_caller', 'manager_completed', 'not_interested', 'converted'],
  manager_completed: [], not_interested: [], converted: [], rejected: [], cancelled: [], archived: []
};

function assertTransition(from, to) {
  if (!WORKFLOW_STATUSES.includes(to)) throw Object.assign(new Error('Invalid workflow status'), { statusCode: 400 });
  if (from === to) return;
  if (!(TRANSITIONS[from || 'new'] || []).includes(to)) {
    throw Object.assign(new Error(`Invalid workflow transition: ${from || 'new'} → ${to}`), { statusCode: 409 });
  }
}

async function transitionLead(lead, to, user, reason, metadata = {}, extra = {}) {
  const from = lead.workflow_status || 'new';
  assertTransition(from, to);
  const updated = await sb.update('leads', [['id', 'eq', lead.id]], { workflow_status: to, updated_at: new Date().toISOString(), ...extra });
  try {
    await Promise.all([
      sb.insert('lead_status_history', { lead_id: lead.id, previous_status: from, new_status: to, changed_by_user_id: user.id, reason: reason || null, metadata }),
      sb.insert('lead_activity', { lead_id: lead.id, event_type: to, performed_by_user_id: user.id, previous_status: from, new_status: to, metadata })
    ]);
  } catch (error) {
    console.warn('Workflow audit tables unavailable, using legacy activity log:', error.message);
    await logActivity(user.id, `${reason || 'Lead workflow updated'} (${from} -> ${to})`, 'leads', lead.id);
  }
  return updated;
}

async function recordAssignment({ lead, type, fromUserId, toUserId, instructions, priority, dueDate }) {
  await sb.update('lead_assignments', [['lead_id', 'eq', lead.id], ['assignment_type', 'eq', type], ['status', 'eq', 'active']], { active: false, status: 'completed', completed_at: new Date().toISOString() });
  return sb.insert('lead_assignments', {
    lead_id: lead.id,
    assigned_to: toUserId,
    assigned_by: fromUserId,
    assigned_from_user_id: fromUserId,
    assigned_to_user_id: toUserId,
    assignment_type: type,
    instructions: instructions || null,
    priority: priority || 'Normal',
    due_date: dueDate || null,
    active: true,
    status: 'active'
  });
}

async function eligibleUser(id, { role, employeeType }) {
  const filters = [['id', 'eq', id], ['status', 'eq', 'active']];
  if (role) filters.push(['role', 'eq', role]);
  if (employeeType) filters.push(['employee_type', 'eq', employeeType]);
  return sb.one('users', { select: 'id,name,email,role,employee_type,status', filters });
}

function managerOwns(lead, managerId) {
  return Number(lead?.manager_id) === Number(managerId);
}

module.exports = { WORKFLOW_STATUSES, TRANSITIONS, assertTransition, transitionLead, recordAssignment, eligibleUser, managerOwns };
