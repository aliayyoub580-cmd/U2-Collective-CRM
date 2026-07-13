const sb = require('../database/supabaseClient');

const FALLBACK_TYPE = 'Manager Email Draft';
const PREFIX = 'U2_MANAGER_EMAIL_DRAFT:';

function parseDraft(communication) {
  if (!communication?.message?.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(communication.message.slice(PREFIX.length));
    return {
      id: `communication-${communication.id}`,
      communication_id: communication.id,
      lead_id: communication.lead_id,
      manager_id: communication.created_by,
      recipient_email: value.recipient_email,
      subject: value.subject,
      message_body: value.message_body,
      email_stage: value.email_stage,
      scheduled_for: value.scheduled_for || communication.created_at,
      sent_at: null,
      status: 'draft',
      created_at: communication.created_at,
      updated_at: communication.created_at,
      storage: 'communications_fallback'
    };
  } catch {
    return null;
  }
}

async function listFallbackDrafts(leadId, managerId) {
  const filters = [['lead_id', 'eq', leadId], ['type', 'eq', FALLBACK_TYPE]];
  if (managerId) filters.push(['created_by', 'eq', managerId]);
  const { data } = await sb.list('communications', { filters, order: 'created_at.asc', limit: 100 });
  return (data || []).map(parseDraft).filter(Boolean);
}

async function saveFallbackDraft({ leadId, managerId, recipientEmail, subject, messageBody, emailStage, scheduledFor }) {
  const communication = await sb.insert('communications', {
    lead_id: leadId,
    client_id: null,
    type: FALLBACK_TYPE,
    message: `${PREFIX}${JSON.stringify({ recipient_email: recipientEmail, subject, message_body: messageBody, email_stage: emailStage, scheduled_for: scheduledFor })}`,
    communication_date: new Date().toISOString().slice(0, 10),
    created_by: managerId
  });
  return parseDraft(communication);
}

async function updateFallbackDraft(draft, { recipientEmail, subject, messageBody, scheduledFor }) {
  const communication = await sb.update('communications', [['id', 'eq', draft.communication_id]], {
    message: `${PREFIX}${JSON.stringify({ recipient_email: recipientEmail, subject, message_body: messageBody, email_stage: draft.email_stage, scheduled_for: scheduledFor || draft.scheduled_for })}`,
    communication_date: new Date().toISOString().slice(0, 10)
  });
  return parseDraft(communication);
}

module.exports = { listFallbackDrafts, saveFallbackDraft, updateFallbackDraft };
