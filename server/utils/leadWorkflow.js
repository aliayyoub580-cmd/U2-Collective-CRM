function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isFollowUpStatus(status) {
  return normalizeValue(status) === 'followup';
}

function hasCommunicationType(type) {
  return String(type || '').trim().length > 0;
}

function leadDisplayName(lead) {
  return lead?.client_clinic_name || lead?.company_name || '';
}

module.exports = {
  normalizeValue,
  isFollowUpStatus,
  hasCommunicationType,
  leadDisplayName
};
