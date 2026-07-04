const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const sb = require('../database/supabaseClient');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const asyncHandler = require('../utils/asyncHandler');
const { mapById, pageOptions } = require('../utils/supabaseRelations');
const { uploadsPath } = require('../utils/runtimePaths');

const uploadDir = uploadsPath('proposals');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

async function enrich(rows) {
  const [leads, clients] = await Promise.all([
    mapById(sb, 'leads', rows.map((p) => p.lead_id), 'id,company_name'),
    mapById(sb, 'clients', rows.map((p) => p.client_id), 'id,company_name')
  ]);
  return rows.map((p) => ({
    ...p,
    lead_name: leads.get(Number(p.lead_id))?.company_name || null,
    client_name: clients.get(Number(p.client_id))?.company_name || null
  }));
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const { offset, limit: limitNum } = pageOptions(page, limit);
  const filters = [];
  if (status) filters.push(['status', 'eq', status]);

  const { data, count: total } = await sb.list('proposals', {
    filters,
    order: 'created_at.desc',
    limit: limitNum,
    offset,
    count: true
  });
  res.json({ proposals: await enrich(data || []), total });
}));

router.post('/', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  const { lead_id, client_id, title, amount, status, sent_date, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const proposal = await sb.insert('proposals', {
    lead_id: lead_id || null,
    client_id: client_id || null,
    title,
    amount: amount || 0,
    status: status || 'Draft',
    sent_date: sent_date || null,
    notes,
    file_path: req.file ? req.file.filename : null
  });
  await logActivity(req.user.id, 'Created proposal: ' + title, 'proposals', proposal.id);
  res.status(201).json({ proposal });
}));

router.put('/:id', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  const { lead_id, client_id, title, amount, status, sent_date, notes } = req.body;
  const existing = await sb.one('proposals', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Proposal not found' });

  const update = {
    lead_id: lead_id || null,
    client_id: client_id || null,
    title,
    amount,
    status,
    sent_date: sent_date || null,
    notes
  };
  if (req.file) update.file_path = req.file.filename;

  const proposal = await sb.update('proposals', [['id', 'eq', req.params.id]], update);
  res.json({ proposal });
}));

router.delete('/:id', authenticateToken, requireRole('CEO', 'Manager'), asyncHandler(async (req, res) => {
  const existing = await sb.one('proposals', { select: 'id', filters: [['id', 'eq', req.params.id]] });
  if (!existing) return res.status(404).json({ error: 'Proposal not found' });
  await sb.remove('proposals', [['id', 'eq', req.params.id]]);
  res.json({ message: 'Proposal deleted' });
}));

module.exports = router;
