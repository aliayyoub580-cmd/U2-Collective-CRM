const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { mapById } = require('../utils/supabaseRelations');

function getDateRange(req) {
  const { start_date, end_date } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  return { start: start_date || startOfYear, end: end_date || today };
}

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function inRange(value, start, end) {
  const date = dateOnly(value);
  return date >= start && date <= end;
}

function group(rows, keyFn, valueFn = () => 1) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || 'Unknown';
    map.set(key, (map.get(key) || 0) + valueFn(row));
  });
  return map;
}

function toCsv(data) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map((row) => headers.map((h) => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

router.get('/sales', authenticateToken, requireRole('CEO', 'Manager', 'Accountant'), asyncHandler(async (req, res) => {
  const { start, end } = getDateRange(req);
  const { data: allLeads } = await sb.list('leads', { limit: 10000, order: 'created_at.desc' });
  const leads = (allLeads || []).filter((lead) => inRange(lead.created_at, start, end));
  const users = await mapById(sb, 'users', leads.map((lead) => lead.assigned_to));
  const recentLeads = leads.slice(0, 50).map((lead) => ({
    ...lead,
    assigned_to_name: users.get(Number(lead.assigned_to))?.name || null
  }));

  const byServiceMap = group(leads, (lead) => lead.service_interested);
  const byStatusMap = group(leads, (lead) => lead.status);
  const byService = Array.from(byServiceMap.entries()).map(([service_interested, count]) => ({
    service_interested,
    count
  }));
  const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }));

  const total = leads.length;
  const contracted = leads.filter((lead) => lead.status === 'Contracted').length;
  const notInterested = leads.filter((lead) => lead.status === 'Not interested').length;
  const pending = leads.filter((lead) => !['Contracted', 'Not interested'].includes(lead.status)).length;
  const conversionRate = total > 0 ? ((contracted / total) * 100).toFixed(1) : 0;

  res.json({ total, contracted, notInterested, pending, conversionRate, byService, byStatus, recentLeads, dateRange: { start, end } });
}));

router.get('/revenue', authenticateToken, requireRole('CEO', 'Manager', 'Accountant'), asyncHandler(async (req, res) => {
  const { start, end } = getDateRange(req);
  const [paymentsRes, clientsRes] = await Promise.all([
    sb.list('payments', { limit: 10000, order: 'payment_date.desc' }),
    sb.list('clients', { limit: 10000 })
  ]);
  const payments = (paymentsRes.data || []).filter((payment) => inRange(payment.payment_date, start, end));
  const clients = clientsRes.data || [];
  const paidPayments = payments.filter((payment) => payment.status === 'Paid');
  const total = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const byMonth = Array.from(group(paidPayments, (p) => String(p.payment_date || '').slice(0, 7), (p) => Number(p.amount || 0)).entries())
    .map(([month, total]) => ({ month, total }));

  const byService = Array.from(group(paidPayments, (p) => clients.find((c) => Number(c.id) === Number(p.client_id))?.services, (p) => Number(p.amount || 0)).entries())
    .map(([services, total]) => ({ services, total }));

  const byClientMap = group(paidPayments, (p) => p.client_id, (p) => Number(p.amount || 0));
  const byClient = Array.from(byClientMap.entries()).map(([clientId, total]) => ({
    company_name: clients.find((c) => Number(c.id) === Number(clientId))?.company_name || 'Unknown',
    total,
    payment_count: paidPayments.filter((p) => Number(p.client_id) === Number(clientId)).length
  }));

  const recentPayments = payments.slice(0, 50).map((payment) => ({
    ...payment,
    company_name: clients.find((c) => Number(c.id) === Number(payment.client_id))?.company_name || null
  }));

  res.json({ total, byMonth, byService, byClient, recentPayments, dateRange: { start, end } });
}));

router.get('/lead-sources', authenticateToken, requireRole('CEO', 'Manager', 'Marketing'), asyncHandler(async (req, res) => {
  const { start, end } = getDateRange(req);
  const { data: allLeads } = await sb.list('leads', { limit: 10000 });
  const leads = (allLeads || []).filter((lead) => inRange(lead.created_at, start, end));

  const bySource = Array.from(group(leads, (lead) => lead.source).entries()).map(([source, count]) => ({
    source,
    count,
    contracted: leads.filter((lead) => (lead.source || 'Unknown') === source && lead.status === 'Contracted').length
  }));
  const byCountry = Array.from(group(leads, (lead) => lead.country).entries()).map(([country, count]) => ({ country, count }));

  res.json({ bySource, byCountry, dateRange: { start, end } });
}));

router.get('/employee-tasks', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { start, end } = getDateRange(req);
  const [usersRes, tasksRes] = await Promise.all([
    sb.list('users', { filters: [['status', 'eq', 'active']], limit: 10000 }),
    sb.list('tasks', { limit: 10000 })
  ]);
  const tasks = (tasksRes.data || []).filter((task) => inRange(task.created_at, start, end));
  const today = new Date().toISOString().split('T')[0];
  const byEmployee = (usersRes.data || []).map((user) => {
    const userTasks = tasks.filter((task) => Number(task.assigned_to) === Number(user.id));
    return {
      name: user.name,
      role: user.role,
      total_tasks: userTasks.length,
      completed: userTasks.filter((task) => task.status === 'Completed').length,
      pending: userTasks.filter((task) => task.status === 'Pending').length,
      in_progress: userTasks.filter((task) => task.status === 'In Progress').length,
      overdue: userTasks.filter((task) => task.deadline < today && task.status !== 'Completed').length
    };
  });
  res.json({ byEmployee, dateRange: { start, end } });
}));

router.get('/export/csv', authenticateToken, requireRole('CEO', 'Manager', 'Accountant'), asyncHandler(async (req, res) => {
  const { type, start_date, end_date } = req.query;
  const start = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const end = end_date || new Date().toISOString().split('T')[0];
  let data = [];
  let filename = 'report.csv';

  if (type === 'leads') {
    const { data: leads } = await sb.list('leads', { limit: 10000 });
    data = (leads || []).filter((lead) => inRange(lead.created_at, start, end)).map((lead) => ({
      id: lead.id,
      lead_id: lead.lead_id,
      client_clinic_name: lead.client_clinic_name || lead.company_name,
      clinic_website: lead.clinic_website,
      clinic_linkedin: lead.clinic_linkedin,
      clinic_phone: lead.clinic_phone,
      clinic_email: lead.clinic_email,
      country: lead.country,
      source: lead.source,
      service_interested: lead.service_interested,
      practice_size: lead.practice_size,
      status: lead.status,
      assigned_to: lead.assigned_to,
      notes: lead.notes,
      created_at: lead.created_at,
      updated_at: lead.updated_at
    }));
    filename = 'leads-report.csv';
  } else if (type === 'revenue') {
    const [paymentsRes, clientsRes] = await Promise.all([sb.list('payments', { limit: 10000 }), sb.list('clients', { limit: 10000 })]);
    data = (paymentsRes.data || []).filter((payment) => inRange(payment.payment_date, start, end)).map((payment) => ({
      ...payment,
      company_name: (clientsRes.data || []).find((client) => Number(client.id) === Number(payment.client_id))?.company_name || ''
    }));
    filename = 'revenue-report.csv';
  } else if (type === 'clients') {
    data = (await sb.list('clients', { limit: 10000 })).data || [];
    filename = 'clients-report.csv';
  }

  if (data.length === 0) return res.json({ csv: '', message: 'No data found' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(data));
}));

module.exports = router;
