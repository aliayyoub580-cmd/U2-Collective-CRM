const bcrypt = require('bcryptjs');
const sb = require('./supabaseClient');

async function seedSupabase() {
  const existing = await sb.one('users', {
    select: 'id',
    filters: [['email', 'eq', 'admin@u2collective.com']]
  });

  if (existing) return;

  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const admin = await sb.insert('users', {
    name: 'Admin CEO',
    email: 'admin@u2collective.com',
    password: hashedPassword,
    role: 'CEO',
    employee_type: null,
    status: 'active'
  });

  const adminId = admin.id;

  await sb.insert('leads', {
    company_name: 'MedBill Solutions',
    client_clinic_name: 'MedBill Solutions',
    clinic_website: 'https://medbill.example.com',
    clinic_linkedin: '',
    clinic_phone: '+1-555-0101',
    clinic_email: 'info@medbill.example.com',
    country: 'USA',
    source: 'LinkedIn',
    service_interested: 'Medical Billing',
    practice_size: 'Small 2 - 5 providers',
    status: 'Not contract',
    assigned_to: adminId,
    notes: 'Interested in full RCM'
  });

  await sb.insert('leads', {
    company_name: 'Digital Boost Agency',
    client_clinic_name: 'Digital Boost Agency',
    clinic_website: 'https://digitalboost.example.com',
    clinic_linkedin: '',
    clinic_phone: '+1-555-0202',
    clinic_email: 'hello@digitalboost.example.com',
    country: 'UK',
    source: 'Meta Ads',
    service_interested: 'Digital Marketing',
    practice_size: 'Medium 6 - 15 providers',
    status: 'Follow up',
    assigned_to: adminId,
    notes: 'Needs SEO + Social Media'
  });

  await sb.insert('leads', {
    company_name: 'WebCraft Inc',
    client_clinic_name: 'WebCraft Inc',
    clinic_website: 'https://webcraft.example.com',
    clinic_linkedin: '',
    clinic_phone: '+1-555-0303',
    clinic_email: 'contact@webcraft.example.com',
    country: 'Canada',
    source: 'Referral',
    service_interested: 'Web Development',
    practice_size: 'Larger 15+ provider',
    status: 'Meeting scheduled',
    assigned_to: adminId,
    notes: 'E-commerce project'
  });

  await sb.insert('clients', {
    company_name: 'HealthFirst Medical',
    contact_person: 'Dr. Alice Brown',
    email: 'alice@healthfirst.com',
    phone: '+1-555-0404',
    country: 'USA',
    services: 'Medical Billing,Prior Authorization',
    monthly_charges: 4500,
    contract_start: '2024-01-01',
    status: 'Active',
    notes: 'Long-term client since 2024'
  });

  await sb.insert('employees', {
    user_id: adminId,
    name: 'Admin CEO',
    role: 'CEO',
    employee_type: null,
    salary: 15000,
    phone: '+1-555-0001',
    email: 'admin@u2collective.com',
    status: 'Active',
    joining_date: '2023-01-01',
    performance_notes: 'Founder and CEO of U2 Collective LLP'
  });

  console.log('Seed: Supabase default data created.');
}

module.exports = seedSupabase;
