const fs = require('fs');
const path = require('path');

function loadLocalConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'supabase.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn('Could not read server/config/supabase.json:', err.message);
    return {};
  }
}

const localConfig = loadLocalConfig();

const SUPABASE_URL = process.env.SUPABASE_URL || localConfig.url || 'https://bkalqlhtblccjqgitdrz.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  localConfig.secretKey ||
  localConfig.serviceRoleKey ||
  localConfig.anonKey ||
  localConfig.publishableKey;

if (!SUPABASE_KEY) {
  console.warn('Supabase key is not configured. Set SUPABASE_SECRET_KEY on the backend.');
}

const REST_URL = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY || '',
    Authorization: `Bearer ${SUPABASE_KEY || ''}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function appendFilter(params, field, op, value) {
  if (value === undefined || value === null || value === '') return;
  params.append(field, `${op}.${value}`);
}

function appendIn(params, field, values) {
  if (!values || values.length === 0) return;
  params.append(field, `in.(${values.map(String).join(',')})`);
}

function appendLike(params, field, value) {
  if (!value) return;
  params.append(field, `ilike.*${String(value).replace(/\*/g, '')}*`);
}

function countFromContentRange(range) {
  if (!range) return 0;
  const total = range.split('/')[1];
  return total === '*' ? 0 : Number(total || 0);
}

async function request(table, params = new URLSearchParams(), options = {}) {
  if (!SUPABASE_KEY) {
    throw new Error('Supabase backend key is missing. Set SUPABASE_SECRET_KEY.');
  }

  const qs = params.toString();
  const response = await fetch(`${REST_URL}/${table}${qs ? `?${qs}` : ''}`, {
    ...options,
    headers: headers(options.headers)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || text || `Supabase request failed: ${response.status}`;
    throw new Error(message);
  }

  return { data, count: countFromContentRange(response.headers.get('content-range')) };
}

async function list(table, options = {}) {
  const params = new URLSearchParams();
  params.set('select', options.select || '*');
  options.filters?.forEach(([field, op, value]) => appendFilter(params, field, op, value));
  options.in?.forEach(([field, values]) => appendIn(params, field, values));
  options.likes?.forEach(([field, value]) => appendLike(params, field, value));
  if (options.or) params.set('or', options.or);
  if (options.order) params.set('order', options.order);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));

  const prefer = options.count ? { Prefer: 'count=exact' } : {};
  return request(table, params, { method: 'GET', headers: prefer });
}

async function one(table, options = {}) {
  const result = await list(table, { ...options, limit: 1 });
  return result.data?.[0];
}

async function count(table, options = {}) {
  const result = await list(table, { ...options, select: 'id', limit: 1, count: true });
  return result.count;
}

async function insert(table, row) {
  const result = await request(table, new URLSearchParams(), {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return result.data?.[0];
}

async function update(table, filters, row) {
  const params = new URLSearchParams();
  filters.forEach(([field, op, value]) => appendFilter(params, field, op, value));
  const result = await request(table, params, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
  return result.data?.[0];
}

async function remove(table, filters) {
  const params = new URLSearchParams();
  filters.forEach(([field, op, value]) => appendFilter(params, field, op, value));
  await request(table, params, { method: 'DELETE' });
}

async function upsert(table, rows, conflictColumns) {
  const params = new URLSearchParams();
  if (conflictColumns) params.set('on_conflict', conflictColumns);

  const result = await request(table, params, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
  return result.data || [];
}

async function sum(table, field, options = {}) {
  const rows = await list(table, { ...options, limit: options.limit || 10000 });
  return (rows.data || []).reduce((total, row) => total + Number(row[field] || 0), 0);
}

function groupCount(rows, field) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[field] || 'Unknown';
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  return Array.from(grouped.entries()).map(([key, count]) => ({ [field]: key, count }));
}

function betweenDateFilters(field, start, end) {
  return [
    [field, 'gte', start],
    [field, 'lte', end]
  ];
}

module.exports = {
  SUPABASE_URL,
  list,
  one,
  count,
  insert,
  upsert,
  update,
  remove,
  sum,
  groupCount,
  betweenDateFilters
};
