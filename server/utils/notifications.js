const sb = require('../database/supabaseClient');

async function notifyUsers(users, payload) {
  const uniqueIds = [...new Set((users || []).map((user) => Number(user.id || user)).filter(Boolean))];
  await Promise.all(uniqueIds.map((userId) => sb.insert('notifications', {
    user_id: userId,
    lead_id: payload.lead_id || null,
    type: payload.type,
    title: payload.title,
    message: payload.message || null
  })));
}

async function usersByRole(role) {
  const { data } = await sb.list('users', { select: 'id', filters: [['role', 'eq', role], ['status', 'eq', 'active']] });
  return data || [];
}

module.exports = { notifyUsers, usersByRole };
