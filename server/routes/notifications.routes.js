const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { data } = await sb.list('notifications', { filters: [['user_id', 'eq', req.user.id]], order: 'created_at.desc', limit: 50 });
  res.json({ notifications: data || [], unread: (data || []).filter((item) => !item.is_read).length });
}));

router.patch('/:id/read', authenticateToken, asyncHandler(async (req, res) => {
  const item = await sb.one('notifications', { select: 'id,user_id', filters: [['id', 'eq', req.params.id]] });
  if (!item || Number(item.user_id) !== Number(req.user.id)) return res.status(404).json({ error: 'Notification not found' });
  await sb.update('notifications', [['id', 'eq', item.id]], { is_read: true });
  res.json({ message: 'Notification read' });
}));

module.exports = router;
