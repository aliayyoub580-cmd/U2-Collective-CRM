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
const { notifyUsers, usersByRole } = require('../utils/notifications');

const uploadDir = uploadsPath('leads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function formatLeadId(id) {
  return `LD-${String(id).padStart(6, '0')}`;
}

const LEAD_SOURCES = ['Google', 'Reddit', 'LinkedIn', 'Facebook', 'Indeed', 'Glassdoor', 'Instagram', 'Other'];
const STATES = ['California', 'Florida', 'Hawaii', 'Illinois', 'Maryland', 'Massachusetts', 'New Hampshire', 'New York', 'Ohio', 'Texas'];

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { search, status, source, state, service, assigned_to, page = 1, limit = 20 } = req.query;
  const { offset, page: pageNum, limit: limitNum } = pageOptions(page, limit);
  const filters = [];

  if (req.user.employee_type === 'lead_generator') filters.push(['created_by', 'eq', req.user.id]);
  else if (req.user.employee_type === 'caller') filters.push(['assigned_to', 'eq', req.user.id]);
  else if (assigned_to) filters.push(['assigned_to', 'eq', assigned_to]);
  if (status) filters.push(['status', 'eq', status]);
  if (source) filters.push(['source', 'eq', source]);
  if (state) filters.push(['state', 'eq', state]);
  if (service) filters.push(['service_interested', 'eq', service]);

  const or = search
    ? `(company_name.ilike.*${search}*,client_clinic_name.ilike.*${search}*,lead_id.ilike.*${search}*,clinic_email.ilike.*${search}*,clinic_phone.ilike.*${search}*,state.ilike.*${search}*,source.ilike.*${search}*)`
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
    assigned_to_name: userMap.get(Number(lead.assigned_to))?.name || null,
    created_by_name: userMap.get(Number(lead.created_by))?.name || null
  }));

  res.json({ leads: enriched, total, page: pageNum, limit: limitNum });
}));

router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== 'CEO' && req.user.employee_type !== 'lead_generator') return res.status(403).json({ error: 'Only the CEO and Lead Generators can create leads' });
  const {
    company_name, client_clinic_name, clinic_website, clinic_linkedin,
    clinic_phone, clinic_email, practice_size, country, state, city, source,
    service_interested, clinic_specialty, source_other, assigned_to, notes, communication_type
  } = req.body;
  const clinicName = client_clinic_name || company_name;
  if (!clinicName || !clinic_email || !clinic_specialty || !clinic_phone || !state || !city || !source || !practice_size) {
    return res.status(400).json({ error: 'Clinic name, email, specialty, phone, state, city, source, and clinic size are required' });
  }
  if (!STATES.includes(state)) return res.status(400).json({ error: 'Invalid state' });
  if (!LEAD_SOURCES.includes(source) || (source === 'Other' && !source_other?.trim())) return res.status(400).json({ error: 'Select a valid lead source and specify Other when applicable' });

  const createdLead = await sb.insert('leads', {
    company_name: clinicName,
    client_clinic_name: clinicName,
    clinic_website,
    clinic_linkedin,
    clinic_phone,
    clinic_email,
    practice_size,
    clinic_specialty,
    source_other: source === 'Other' ? source_other.trim() : null,
    country,
    state,
    city,
    source,
    service_interested,
    status: 'New',
    assigned_to: req.user.role === 'CEO' ? (assigned_to || null) : null,
    created_by: req.user.id,
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

  await logActivity(req.user.id, 'Created Lead: ' + clinicName, 'leads', lead.id);
  await notifyUsers([req.user.id], { lead_id: lead.id, type: 'lead_created', title: 'Lead Created Successfully', message: `${lead.lead_id} - ${clinicName}` });
  res.status(201).json({ lead });
}));

router.patch('/:id/assign', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const caller = await sb.one('users', { select: 'id,name,employee_type,status', filters: [['id', 'eq', req.body.assigned_to]] });
  if (!caller || caller.status !== 'active' || caller.employee_type !== 'caller') return res.status(400).json({ error: 'Select an active Caller' });
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await sb.update('lead_assignments', [['lead_id', 'eq', lead.id], ['active', 'eq', true]], { active: false });
  await sb.insert('lead_assignments', { lead_id: lead.id, assigned_to: caller.id, assigned_by: req.user.id, active: true });
  const updated = await sb.update('leads', [['id', 'eq', lead.id]], { assigned_to: caller.id, status: 'Assigned' });
  await logActivity(req.user.id, `Assigned Lead ${lead.lead_id} to ${caller.name}`, 'leads', lead.id);
  await notifyUsers([caller.id], { lead_id: lead.id, type: 'lead_assigned', title: 'New Lead Assigned', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.post('/:id/call', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type !== 'caller') return res.status(403).json({ error: 'Only Callers can record calls' });
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['assigned_to', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Assigned lead not found' });
  if (!['Called', 'No Answer'].includes(req.body.call_status)) return res.status(400).json({ error: 'Invalid call status' });
  const attempt = await sb.insert('call_attempts', { lead_id: lead.id, employee_id: req.user.id, call_status: req.body.call_status, notes: req.body.notes || null });
  const leadUpdate = { status: req.body.call_status };
  if (req.body.call_status === 'Called') Object.assign(leadUpdate, {
    practice_manager_name: req.body.practice_manager_name || null,
    practice_manager_phone: req.body.practice_manager_phone || null,
    practice_manager_email: req.body.practice_manager_email || null,
    practice_manager_linkedin: req.body.practice_manager_linkedin || null,
    practice_manager_position: req.body.practice_manager_position || null
  });
  await sb.update('leads', [['id', 'eq', lead.id]], leadUpdate);
  let followup = null;
  if (req.body.call_status === 'Called' && req.body.followup_date) {
    followup = await sb.insert('followups', { lead_id: lead.id, title: `Follow up: ${lead.client_clinic_name || lead.company_name}`, followup_date: req.body.followup_date, followup_time: req.body.followup_time || null, method: 'Phone Call', assigned_to: req.user.id, status: 'Pending' });
    await logActivity(req.user.id, `Reminder Added for ${lead.lead_id}`, 'followups', followup.id);
  }
  await logActivity(req.user.id, `${req.body.call_status}: ${lead.lead_id}`, 'leads', lead.id);
  res.status(201).json({ attempt, followup });
}));

router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.employee_type === 'lead_generator' && Number(lead.created_by) !== Number(req.user.id)) return res.status(403).json({ error: 'This lead is not yours' });
  if (req.user.employee_type === 'caller' && Number(lead.assigned_to) !== Number(req.user.id)) return res.status(403).json({ error: 'This lead is not assigned to you' });

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

router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== 'CEO' && req.user.employee_type !== 'lead_generator') return res.status(403).json({ error: 'You cannot edit leads' });
  const {
    company_name, client_clinic_name, clinic_phone, clinic_email, clinic_specialty, practice_size, state, city, source,
    source_other, assigned_to, notes
  } = req.body;
  const existing = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.employee_type === 'lead_generator' && Number(existing.created_by) !== Number(req.user.id)) return res.status(403).json({ error: 'You can only edit your own leads' });
  const clinicName = client_clinic_name || company_name;

  const lead = await sb.update('leads', [['id', 'eq', req.params.id]], {
    ...(!existing.lead_id ? { lead_id: formatLeadId(existing.id) } : {}),
    company_name: clinicName,
    client_clinic_name: clinicName,
    clinic_phone,
    clinic_email,
    clinic_specialty,
    practice_size,
    state,
    city,
    source,
    source_other: source === 'Other' ? source_other : null,
    ...(req.user.role === 'CEO' ? { assigned_to: assigned_to || null } : {}),
    notes,
    updated_at: new Date().toISOString()
  });

  await logActivity(req.user.id, 'Updated lead: ' + clinicName, 'leads', req.params.id);
  res.json({ lead });
}));

router.delete('/:id', authenticateToken, requireRole('CEO'), asyncHandler(async (req, res) => {
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
