const sb = require('../database/supabaseClient');

async function notifyUsers(users, payload) {
  const uniqueIds = [...new Set((users || []).map((user) => Number(user.id || user)).filter(Boolean))];
  const results = await Promise.allSettled(uniqueIds.map((userId) => sb.insert('notifications', {
    user_id: userId,
    lead_id: payload.lead_id || null,
    type: payload.type,
    title: payload.title,
    message: payload.message || null
  })));
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) console.warn(`Skipped ${failed.length} notification(s):`, failed[0].reason?.message || 'notification storage unavailable');
  return { delivered: results.length - failed.length, failed: failed.length };
}

async function usersByRole(role) {
  const { data } = await sb.list('users', { select: 'id', filters: [['role', 'eq', role], ['status', 'eq', 'active']] });
  return data || [];
}

module.exports = { notifyUsers, usersByRole };
