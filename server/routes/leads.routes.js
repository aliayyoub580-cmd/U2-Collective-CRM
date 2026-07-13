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

  if (req.user.employee_type === 'lead_generator') filters.push(['lead_generator_id', 'eq', req.user.id]);
  else if (req.user.employee_type === 'caller') filters.push(['assigned_to', 'eq', req.user.id]);
  else if (req.user.role === 'Manager') filters.push(['manager_id', 'eq', req.user.id]);
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
    created_by_name: userMap.get(Number(lead.created_by))?.name || null,
    manager_name: userMap.get(Number(lead.manager_id))?.name || null,
    lead_generator_name: userMap.get(Number(lead.lead_generator_id))?.name || null
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
    lead_generator_id: req.user.employee_type === 'lead_generator' ? req.user.id : null,
    current_owner_id: req.user.id,
    workflow_status: 'new',
    submitted_at: null,
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
  await sb.insert('lead_activity', { lead_id: lead.id, event_type: 'lead_created', performed_by_user_id: req.user.id, previous_status: null, new_status: 'new', metadata: { source: lead.source } });
  await notifyUsers([req.user.id], { lead_id: lead.id, type: 'lead_created', title: 'Lead Created Successfully', message: `${lead.lead_id} - ${clinicName}` });
  res.status(201).json({ lead });
}));

router.post('/:id/submit', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type !== 'lead_generator') return res.status(403).json({ error: 'Lead Generator access required' });
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id], ['lead_generator_id', 'eq', req.user.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.manager_id) return res.status(409).json({ error: 'An Admin must assign a Manager before this lead can be submitted' });
  const required = ['client_clinic_name', 'clinic_email', 'clinic_phone', 'clinic_specialty', 'state', 'city', 'source', 'practice_size'];
  if (required.some((field) => !String(lead[field] || '').trim())) return res.status(400).json({ error: 'Complete all required clinic information before submitting' });
  const { transitionLead } = require('../utils/managerWorkflow');
  const updated = await transitionLead(lead, 'submitted_by_lead_generator', req.user, 'Lead submitted to Manager', {}, { current_owner_id: lead.manager_id, submitted_at: new Date().toISOString() });
  await notifyUsers([lead.manager_id], { lead_id: lead.id, type: 'lead_submitted', title: 'Lead ready for review', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.patch('/:id/assign', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const caller = await sb.one('users', { select: 'id,name,employee_type,status', filters: [['id', 'eq', req.body.assigned_to]] });
  if (!caller || caller.status !== 'active' || caller.employee_type !== 'caller') return res.status(400).json({ error: 'Select an active Caller' });
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.role === 'Manager' && Number(lead.manager_id) !== Number(req.user.id)) return res.status(404).json({ error: 'Lead not found' });
  await sb.update('lead_assignments', [['lead_id', 'eq', lead.id], ['active', 'eq', true]], { active: false });
  await sb.insert('lead_assignments', { lead_id: lead.id, assigned_to: caller.id, assigned_by: req.user.id, active: true });
  const updated = await sb.update('leads', [['id', 'eq', lead.id]], { assigned_to: caller.id, status: 'Assigned' });
  await logActivity(req.user.id, `Assigned Lead ${lead.lead_id} to ${caller.name}`, 'leads', lead.id);
  await notifyUsers([caller.id], { lead_id: lead.id, type: 'lead_assigned', title: 'New Lead Assigned', message: `${lead.lead_id} - ${lead.client_clinic_name || lead.company_name}` });
  res.json({ lead: updated });
}));

router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const lead = await sb.one('leads', { filters: [['id', 'eq', req.params.id]] });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.employee_type === 'lead_generator' && Number(lead.lead_generator_id) !== Number(req.user.id)) return res.status(403).json({ error: 'This lead is not yours' });
  if (req.user.employee_type === 'caller' && Number(lead.assigned_to) !== Number(req.user.id)) return res.status(403).json({ error: 'This lead is not assigned to you' });
  if (req.user.role === 'Manager' && Number(lead.manager_id) !== Number(req.user.id)) return res.status(404).json({ error: 'Lead not found' });

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
  if (req.user.employee_type === 'lead_generator' && Number(existing.lead_generator_id) !== Number(req.user.id)) return res.status(403).json({ error: 'You can only edit your own leads' });
  if (req.user.employee_type === 'lead_generator' && !['new', 'assigned_to_manager', 'assigned_to_lead_generator', 'lead_generation_in_progress'].includes(existing.workflow_status || 'new')) return res.status(409).json({ error: 'This submission is locked while the Manager reviews it' });
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
