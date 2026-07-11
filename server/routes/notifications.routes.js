const express = require('express');
const router = express.Router();
const sb = require('../database/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.employee_type === 'caller') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: reminders } = await sb.list('followups', { select: 'id,lead_id,title,followup_time', filters: [['assigned_to', 'eq', req.user.id], ['followup_date', 'eq', today], ['status', 'eq', 'Pending']], limit: 100 });
    const { data: existing } = await sb.list('notifications', { select: 'id,message', filters: [['user_id', 'eq', req.user.id], ['type', 'eq', 'today_reminder']], limit: 100 });
    const existingKeys = new Set((existing || []).map((item) => item.message));
    await Promise.all((reminders || []).map((reminder) => {
      const message = `${reminder.title || 'Scheduled follow-up'} [reminder:${reminder.id}]`;
      if (existingKeys.has(message)) return null;
      return sb.insert('notifications', { user_id: req.user.id, lead_id: reminder.lead_id, type: 'today_reminder', title: `Today's Reminder${reminder.followup_time ? ` · ${reminder.followup_time}` : ''}`, message });
    }));
  }
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
