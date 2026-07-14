const bcrypt = require('bcryptjs');
const sb = require('./supabaseClient');

async function seedSupabase() {
  const existing = await sb.one('users', {
    select: 'id',
    filters: [['email', 'eq', 'admin@u2collective.com']]
  });

  if (existing) return;

  const hashedPassword = bcrypt.hashSync('admin123', 10);
  await sb.insert('users', {
    name: 'Admin CEO',
    email: 'admin@u2collective.com',
    password: hashedPassword,
    role: 'CEO',
    employee_type: null,
    status: 'active'
  });

  console.log('Seed: default administrator created.');
}

module.exports = seedSupabase;
