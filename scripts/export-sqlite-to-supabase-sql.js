const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SQLITE_PATH = path.join(ROOT, 'data', 'database.sqlite');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'server', 'database', 'supabase-full-migration.sql');

const TABLES = [
  'users',
  'clients',
  'leads',
  'lead_files',
  'followups',
  'communications',
  'tasks',
  'proposals',
  'payments',
  'employees',
  'activities',
  'daily_quran_ayats'
];

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function readRows(db, table) {
  let result;
  try {
    result = db.exec(`SELECT * FROM ${quoteIdentifier(table)}`);
  } catch (err) {
    if (String(err.message).includes('no such table')) return [];
    throw err;
  }
  if (result.length === 0) return [];

  const [{ columns, values }] = result;
  return values.map((row) => ({
    columns,
    values: columns.map((_, index) => row[index])
  }));
}

function readSchemaSql(outputPath) {
  const fullMigrationSql = fs.readFileSync(outputPath, 'utf8');
  const beginIndex = fullMigrationSql.indexOf('BEGIN;');
  const truncateIndex = fullMigrationSql.indexOf('TRUNCATE TABLE');

  if (beginIndex === -1 || truncateIndex === -1 || truncateIndex <= beginIndex) {
    throw new Error('Could not find schema section in existing supabase-full-migration.sql.');
  }

  return fullMigrationSql.slice(beginIndex + 'BEGIN;'.length, truncateIndex).trim();
}

function insertSql(table, rows) {
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;

  const columns = rows[0].columns.map(quoteIdentifier).join(', ');
  const valuesSql = rows
    .map((row) => `  (${row.values.map(quoteValue).join(', ')})`)
    .join(',\n');

  return `INSERT INTO ${quoteIdentifier(table)} (${columns}) VALUES\n${valuesSql};\n`;
}

function resetIdentitySql(table) {
  return `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1), (SELECT COUNT(*) FROM ${quoteIdentifier(table)}) > 0);\n`;
}

async function main() {
  const sqlitePath = path.resolve(process.argv[2] || DEFAULT_SQLITE_PATH);
  const outputPath = path.resolve(process.argv[3] || DEFAULT_OUTPUT_PATH);

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(sqlitePath));
  const schemaSql = readSchemaSql(outputPath);

  const parts = [
    '-- U2 Collective CRM SQLite to Supabase migration',
    '-- Generated from local SQLite data. Run this in Supabase SQL Editor.',
    '',
    'BEGIN;',
    '',
    schemaSql,
    '',
    `TRUNCATE TABLE ${TABLES.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE;`,
    ''
  ];

  const counts = [];
  for (const table of TABLES) {
    const rows = readRows(db, table);
    counts.push({ table, count: rows.length });
    parts.push(`-- ${table}: ${rows.length} rows`);
    parts.push(insertSql(table, rows).trimEnd());
    parts.push(resetIdentitySql(table).trimEnd());
    parts.push('');
  }

  parts.push('COMMIT;');
  parts.push('');

  fs.writeFileSync(outputPath, parts.join('\n'), 'utf8');
  db.close();

  console.log(`Wrote ${outputPath}`);
  counts.forEach(({ table, count }) => console.log(`${table}: ${count}`));
}

main().catch((err) => {
  console.error(`SQL export failed: ${err.message}`);
  process.exit(1);
});
