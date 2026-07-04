const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { normalizeValue, leadDisplayName } = require('../utils/leadWorkflow');

async function enrichCommunications(rows) {
  const [users, leads, clients] = await Promise.all([
    mapById(sb, 'users', rows.map((c) => c.created_by)),
    mapById(sb, 'leads', rows.map((c) => c.lead_id), 'id,lead_id,company_name,client_clinic_name,clinic_email,clinic_phone,source,service_interested,status,assigned_to,created_at'),
    mapById(sb, 'clients', rows.map((c) => c.client_id), 'id,company_name')
  ]);
  const leadAssignees = await mapById(
    sb,
    'users',
    rows.map((c) => leads.get(Number(c.lead_id))?.assigned_to)
  );
  return rows.map((c) => ({
    ...c,
    communication_type: c.type,
    created_by_name: users.get(Number(c.created_by))?.name || null,
    lead_public_id: leads.get(Number(c.lead_id))?.lead_id || null,
    lead_name: leadDisplayName(leads.get(Number(c.lead_id))) || null,
    client_clinic_name: leadDisplayName(leads.get(Number(c.lead_id))) || null,
    clinic_email: leads.get(Number(c.lead_id))?.clinic_email || null,
    clinic_phone: leads.get(Number(c.lead_id))?.clinic_phone || null,
    service_interested: leads.get(Number(c.lead_id))?.service_interested || null,
    source: leads.get(Number(c.lead_id))?.source || null,
    status: leads.get(Number(c.lead_id))?.status || null,
    assigned_to: leads.get(Number(c.lead_id))?.assigned_to || null,
    assigned_to_name: leadAssignees.get(Number(leads.get(Number(c.lead_id))?.assigned_to))?.name || null,
    lead_created_at: leads.get(Number(c.lead_id))?.created_at || null,
    client_name: clients.get(Number(c.client_id))?.company_name || null
  }));
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, source, assigned_to, type } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const { data } = await sb.list('communications', {
    order: 'communication_date.desc,created_at.desc',
    limit: 10000
  });
  let communications = await enrichCommunications(data || []);
  communications = communications.filter((communication) => {
    if (!communication.lead_id) return false;
    if (status && normalizeValue(communication.status) !== normalizeValue(status)) return false;
    if (source && normalizeValue(communication.source) !== normalizeValue(source)) return false;
    if (assigned_to && Number(communication.assigned_to) !== Number(assigned_to)) return false;
    if (type && normalizeValue(communication.type) !== normalizeValue(type)) return false;
    return true;
  });
  const total = communications.length;
  res.json({ communications: communications.slice(offset, offset + limitNum), total });
}));

router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { lead_id, client_id, type, message, communication_date } = req.body;
  const communication = await sb.insert('communications', {
    lead_id: lead_id || null,
    client_id: client_id || null,
    type,
    message,
    communication_date: communication_date || new Date().toISOString().split('T')[0],
    created_by: req.user.id
  });
  await logActivity(req.user.id, 'Logged communication: ' + type, 'communications', communication.id);
  res.status(201).json({ communication });
}));

router.get('/lead/:leadId', authenticateToken, asyncHandler(async (req, res) => {
  const { data } = await sb.list('communications', {
    filters: [['lead_id', 'eq', req.params.leadId]],
    order: 'communication_date.desc,created_at.desc'
  });
  res.json({ communications: await enrichCommunications(data || []) });
}));

router.get('/client/:clientId', authenticateToken, asyncHandler(async (req, res) => {
  const { data } = await sb.list('communications', {
    filters: [['client_id', 'eq', req.params.clientId]],
    order: 'communication_date.desc,created_at.desc'
  });
  res.json({ communications: await enrichCommunications(data || []) });
}));

module.exports = router;
