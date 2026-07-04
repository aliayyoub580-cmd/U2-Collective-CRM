const sb = require('../database/supabaseClient');

async function logActivity(userId, action, module, recordId = null) {
  try {
    await sb.insert('activities', {
      user_id: userId,
      action,
      module,
      record_id: recordId
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
