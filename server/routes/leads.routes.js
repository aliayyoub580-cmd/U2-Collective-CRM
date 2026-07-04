const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { hasCommunicationType, leadDisplayName } = require('../utils/leadWorkflow');
const { uploadsPath } = require('../utils/runtimePaths');

const uploadDir = uploadsPath('leads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function formatLeadId(id) {
  return `LEAD-${String(id).padStart(5, '0')}`;
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { search, status, source, service, assigned_to, page = 1, limit = 20 } = req.query;
  const { offset, page: pageNum, limit: limitNum } = pageOptions(page, limit);
  const filters = [];

  if (req.user.role === 'Sales Representative') filters.push(['assigned_to', 'eq', req.user.id]);
  else if (assigned_to) filters.push(['assigned_to', 'eq', assigned_to]);
  if (status) filters.push(['status', 'eq', status]);
  if (source) filters.push(['source', 'eq', source]);
  if (service) filters.push(['service_interested', 'eq', service]);

  const or = search
    ? `(company_name.ilike.*${search}*,client_clinic_name.ilike.*${search}*,lead_id.ilike.*${search}*,clinic_email.ilike.*${search}*)`
    : undefined;

  const [{ data: leads, count: total }, users] = await Promise.all([
    sb.list('leads', {
      filters,
      or,
      order: 'created_at.desc',
      limit: limitNum,
      offset,
      count: true
    }),
    sb.list('users', { select: 'id,name' })
  ]);

  const userMap = new Map((users.data || []).map((u) => [Number(u.id), u]));
  const enriched = (leads || []).map((lead) => ({
    ...lead,
    assigned_to_name: userMap.get(Number(lead.assigned_to))?.name || null
  }));

  res.json({ leads: enriched, total, page: pageNum, limit: limitNum });
}));

router.post('/', authenticateToken, requireRole('CEO', 'Manager', 'Sales Representative'), asyncHandler(async (req, res) => {
  const {
    company_name, client_clinic_name, clinic_website, clinic_linkedin,
    clinic_phone, clinic_email, practice_size, country, state, city, source,
    service_interested, status, assigned_to, notes, communication_type
  } = req.body;
  const clinicName = client_clinic_name || company_name;
  if (!clinicName) return res.status(400).json({ error: 'Client clinic name is required' });

  const createdLead = await sb.insert('leads', {
    company_name: clinicName,
    client_clinic_name: clinicName,
    clinic_website,
    clinic_linkedin,
    clinic_phone,
    clinic_email,
    practice_size,
    country,
    state,
    city,
    source,
    service_interested,
    status: status || 'Not contract',
    assigned_to: assigned_to || null,
    notes
  });
  const lead = await sb.update('leads', [['id', 'eq', createdLead.id]], {
    lead_id: formatLeadId(createdLead.id)
  });

  if (hasCommunicationType(communication_type)) {
    await sb.insert('communications', {
      lead_id: lead.id,
      client_id: null,
      type: communication_type,
      message: `${communication_type} added while creating lead ${leadDisplayName(lead)}.`,
      communication_date: new Date().toISOString().split('T')[0],
      created_by: req.user.id
    });
  }

  await logActivity(req.user.id, 'Created lead: ' + clinicName, 'leads', lead.id);
  res.status(201).json({ lead });
}));

router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const [users, filesRes, followupsRes, communicationsRes, proposalsRes] = await Promise.all([
    mapById(sb, 'users', [lead.assigned_to]),
    sb.list('lead_files', { filters: [['lead_id', 'eq', req.params.id]], order: 'uploaded_at.desc' }),
    sb.list('followups', { filters: [['lead_id', 'eq', req.params.id]], order: 'followup_date.desc' }),
    sb.list('communications', { filters: [['lead_id', 'eq', req.params.id]], order: 'communication_date.desc' }),
    sb.list('proposals', { filters: [['lead_id', 'eq', req.params.id]], order: 'created_at.desc' })
  ]);

  const commUsers = await mapById(sb, 'users', (communicationsRes.data || []).map((c) => c.created_by));
  const communications = (communicationsRes.data || []).map((c) => ({
    ...c,
    created_by_name: commUsers.get(Number(c.created_by))?.name || null
  }));

  res.json({
    lead: { ...lead, assigned_to_name: users.get(Number(lead.assigned_to))?.name || null },
    files: filesRes.data || [],
    followups: followupsRes.data || [],
    communications,
    proposals: proposalsRes.data || []
  });
}));

router.put('/:id', authenticateToken, requireRole('CEO', 'Manager', 'Sales Representative'), asyncHandler(async (req, res) => {
  const {
    company_name, client_clinic_name, clinic_website, clinic_linkedin,
    clinic_phone, clinic_email, practice_size, country, state, city, source,
    service_interested, status, assigned_to, notes, communication_type
  } = req.body;
  const existing = await sb.one('leads', { select: 'id,lead_id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Lead not found' });
  const clinicName = client_clinic_name || company_name;

  const lead = await sb.update('leads', [['id', 'eq', req.params.id]], {
    ...(!existing.lead_id ? { lead_id: formatLeadId(existing.id) } : {}),
    company_name: clinicName,
    client_clinic_name: clinicName,
    clinic_website,
    clinic_linkedin,
    clinic_phone,
    clinic_email,
    practice_size,
    country,
    state,
    city,
    source,
    service_interested,
    status,
    assigned_to: assigned_to || null,
    notes,
    updated_at: new Date().toISOString()
  });

  if (hasCommunicationType(communication_type)) {
    await sb.insert('communications', {
      lead_id: lead.id,
      client_id: null,
      type: communication_type,
      message: `${communication_type} added while updating lead ${leadDisplayName(lead)}.`,
      communication_date: new Date().toISOString().split('T')[0],
      created_by: req.user.id
    });
  }

  await logActivity(req.user.id, 'Updated lead: ' + clinicName, 'leads', req.params.id);
  res.json({ lead });
}));

router.delete('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const existing = await sb.one('leads', { select: 'id,company_name,client_clinic_name', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  await sb.remove('leads', [['id', 'eq', req.params.id]]);
  await logActivity(req.user.id, 'Deleted lead: ' + (existing.client_clinic_name || existing.company_name), 'leads', req.params.id);
  res.json({ message: 'Lead deleted successfully' });
}));

router.post('/:id/convert-to-client', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const client = await sb.insert('clients', {
    company_name: lead.client_clinic_name || lead.company_name,
    email: lead.clinic_email,
    phone: lead.clinic_phone,
    country: lead.country,
    services: lead.service_interested,
    monthly_charges: 0,
    status: 'Active',
    notes: lead.notes
  });

  await sb.update('leads', [['id', 'eq', req.params.id]], { status: 'Contracted' });
  await logActivity(req.user.id, 'Converted lead to client: ' + (lead.client_clinic_name || lead.company_name), 'clients', client.id);
  res.json({ client, message: 'Lead converted to client successfully' });
}));

router.post('/:id/upload', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const file = await sb.insert('lead_files', {
    lead_id: req.params.id,
    file_name: req.file.originalname,
    file_path: req.file.filename
  });

  res.json({ file });
}));

module.exports = router;
