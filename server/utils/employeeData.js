const STAFF_ROLES = ['Manager', 'Sales Representative', 'Marketing', 'Accountant', 'Employee'];
const EMPLOYEE_TYPES = ['lead_generator', 'caller'];

function normalizeRole(value) {
  const match = ['CEO', ...STAFF_ROLES].find((role) => role.toLowerCase() === String(value || '').trim().toLowerCase());
  return match || null;
}

function normalizeEmployeeType(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  return EMPLOYEE_TYPES.includes(normalized) ? normalized : undefined;
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

async function ensureEmployeeProfile(sb, user, defaults = {}) {
  if (!user || !isStaffRole(user.role)) return null;
  const existing = await sb.one('employees', { filters: [['user_id', 'eq', user.id]] });
  const values = {
    name: user.name,
    role: user.role,
    email: user.email,
    status: user.status === 'inactive' ? 'Inactive' : 'Active',
    employee_type: user.employee_type ?? null,
    ...defaults
  };
  if (existing) return sb.update('employees', [['id', 'eq', existing.id]], values);
  return sb.insert('employees', {
    user_id: user.id,
    salary: 0,
    phone: null,
    joining_date: new Date().toISOString().slice(0, 10),
    performance_notes: null,
    ...values
  });
}

module.exports = { STAFF_ROLES, EMPLOYEE_TYPES, normalizeRole, normalizeEmployeeType, isStaffRole, ensureEmployeeProfile };
