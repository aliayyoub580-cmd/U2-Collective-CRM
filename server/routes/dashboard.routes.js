const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { mapById } = require('../utils/supabaseRelations');

function monthOf(value) {
  return String(value || '').slice(0, 7);
}

function groupRows(rows, field, outField = field) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[field] || 'Unknown';
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  return Array.from(grouped.entries()).map(([key, count]) => ({ [outField]: key, count }));
}

router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);
  const user = req.user;

  const [leadsRes, clientsRes, tasksRes, followupsRes, proposalsRes, paymentsRes] = await Promise.all([
    sb.list('leads', { limit: 10000 }),
    sb.list('clients', { limit: 10000 }),
    sb.list('tasks', { limit: 10000 }),
    sb.list('followups', { limit: 10000 }),
    sb.list('proposals', { limit: 10000 }),
    sb.list('payments', { limit: 10000 })
  ]);

  let leads = leadsRes.data || [];
  let tasks = tasksRes.data || [];
  let followups = followupsRes.data || [];
  const clients = clientsRes.data || [];
  const proposals = proposalsRes.data || [];
  const payments = paymentsRes.data || [];

  if (user.employee_type === 'lead_generator') {
    leads = leads.filter((lead) => Number(lead.created_by) === Number(user.id));
  } else if (user.employee_type === 'caller') {
    leads = leads.filter((lead) => Number(lead.assigned_to) === Number(user.id));
    tasks = tasks.filter((task) => Number(task.assigned_to) === Number(user.id));
    followups = followups.filter((followup) => Number(followup.assigned_to) === Number(user.id));
  } else if (user.role === 'Sales Representative') {
    leads = leads.filter((lead) => Number(lead.assigned_to) === Number(user.id));
    tasks = tasks.filter((task) => Number(task.assigned_to) === Number(user.id));
    followups = followups.filter((followup) => Number(followup.assigned_to) === Number(user.id));
  } else if (user.role === 'Employee') {
    tasks = tasks.filter((task) => Number(task.assigned_to) === Number(user.id));
    followups = followups.filter((followup) => Number(followup.assigned_to) === Number(user.id));
  }

  const monthlyRevenue = payments
    .filter((payment) => monthOf(payment.payment_date) === currentMonth)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const revenueByServiceMap = new Map();
  payments.forEach((payment) => {
    const client = clients.find((c) => Number(c.id) === Number(payment.client_id));
    if (!client) return;
    revenueByServiceMap.set(client.services || 'Unknown', (revenueByServiceMap.get(client.services || 'Unknown') || 0) + Number(payment.amount || 0));
  });

  res.json({
    dashboardType: user.employee_type || user.role,
    todaysLeads: leads.filter((lead) => String(lead.created_at || '').slice(0, 10) === today).length,
    totalLeadGenerated: leads.length,
    assignedLeads: leads.length,
    pendingLeads: leads.filter((lead) => ['Assigned', 'New', 'No Answer'].includes(lead.status)).length,
    todaysFollowUps: followups.filter((followup) => followup.followup_date === today).length,
    todaysReminder: followups.filter((followup) => followup.followup_date === today && followup.status === 'Pending').length,
    totalLeads: leads.length,
    totalClients: clients.filter((client) => client.status === 'Active').length,
    tasksDueToday: tasks.filter((task) => task.deadline === today && task.status !== 'Completed').length,
    followupsToday: followups.filter((followup) => followup.followup_date === today && followup.status === 'Pending').length,
    pendingProposals: proposals.filter((proposal) => ['Draft', 'Sent'].includes(proposal.status)).length,
    monthlyRevenue,
    newLeadsThisMonth: leads.filter((lead) => monthOf(lead.created_at) === currentMonth).length,
    leadsByStatus: groupRows(leads, 'status'),
    revenueByService: Array.from(revenueByServiceMap.entries()).map(([services, total]) => ({ services, total })),
    leadsBySource: groupRows(leads.filter((lead) => lead.source), 'source')
  });
}));

router.get('/recent-activities', authenticateToken, asyncHandler(async (req, res) => {
  const { data } = await sb.list('activities', {
    order: 'created_at.desc',
    limit: 20
  });
  const users = await mapById(sb, 'users', (data || []).map((a) => a.user_id));
  const activities = (data || []).map((activity) => ({
    ...activity,
    user_name: users.get(Number(activity.user_id))?.name || null
  }));
  res.json({ activities });
}));

module.exports = router;
