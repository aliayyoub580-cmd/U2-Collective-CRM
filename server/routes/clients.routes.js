const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const filters = [];
  if (status) filters.push(['status', 'eq', status]);
  const or = search ? `(company_name.ilike.*${search}*,contact_person.ilike.*${search}*,email.ilike.*${search}*)` : undefined;

  const { data: clients, count: total } = await sb.list('clients', {
    filters,
    or,
    order: 'created_at.desc',
    limit: limitNum,
    offset,
    count: true
  });
  res.json({ clients, total });
}));

router.post('/', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { company_name, contact_person, email, phone, country, services, monthly_charges, contract_start, contract_end, status, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Company name is required' });

  const client = await sb.insert('clients', {
    company_name,
    contact_person,
    email,
    phone,
    country,
    services,
    monthly_charges: monthly_charges || 0,
    contract_start,
    contract_end,
    status: status || 'Active',
    notes
  });

  await logActivity(req.user.id, 'Created client: ' + company_name, 'clients', client.id);
  res.status(201).json({ client });
}));

router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const client = await sb.one('clients', { filters: [['id', 'eq', req.params.id]] });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const [paymentsRes, communicationsRes, proposalsRes] = await Promise.all([
    sb.list('payments', { filters: [['client_id', 'eq', req.params.id]], order: 'payment_date.desc' }),
    sb.list('communications', { filters: [['client_id', 'eq', req.params.id]], order: 'communication_date.desc' }),
    sb.list('proposals', { filters: [['client_id', 'eq', req.params.id]], order: 'created_at.desc' })
  ]);

  const commUsers = await mapById(sb, 'users', (communicationsRes.data || []).map((c) => c.created_by));
  const communications = (communicationsRes.data || []).map((c) => ({
    ...c,
    created_by_name: commUsers.get(Number(c.created_by))?.name || null
  }));
  const totalRevenue = (paymentsRes.data || [])
    .filter((p) => p.status === 'Paid')
    .reduce((total, p) => total + Number(p.amount || 0), 0);

  res.json({ client, payments: paymentsRes.data || [], communications, proposals: proposalsRes.data || [], totalRevenue });
}));

router.put('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const { company_name, contact_person, email, phone, country, services, monthly_charges, contract_start, contract_end, status, notes } = req.body;
  const existing = await sb.one('clients', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  const client = await sb.update('clients', [['id', 'eq', req.params.id]], {
    company_name,
    contact_person,
    email,
    phone,
    country,
    services,
    monthly_charges: monthly_charges || 0,
    contract_start,
    contract_end,
    status,
    notes
  });

  await logActivity(req.user.id, 'Updated client: ' + company_name, 'clients', req.params.id);
  res.json({ client });
}));

router.delete('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const existing = await sb.one('clients', { select: 'id,company_name', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  await sb.remove('clients', [['id', 'eq', req.params.id]]);
  await logActivity(req.user.id, 'Deleted client: ' + existing.company_name, 'clients', req.params.id);
  res.json({ message: 'Client deleted successfully' });
}));

router.post('/:id/payments', authenticateToken, requireRole('CEO', 'Manager', 'Accountant'), asyncHandler(async (req, res) => {
  const { amount, payment_date, payment_method, status, notes } = req.body;
  const payment = await sb.insert('payments', {
    client_id: req.params.id,
    amount,
    payment_date,
    payment_method,
    status: status || 'Paid',
    notes
  });
  await logActivity(req.user.id, 'Added payment for client', 'payments', payment.id);
  res.status(201).json({ payment });
}));

module.exports = router;
