const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SQLITE_PATH = path.join(ROOT, 'data', 'database.sqlite');
const FULL_MIGRATION_PATH = path.join(ROOT, 'server', 'database', 'supabase-full-migration.sql');

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
  return values.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]]))
  );
}

function readSchemaSql() {
  const fullMigrationSql = fs.readFileSync(FULL_MIGRATION_PATH, 'utf8');
  const beginIndex = fullMigrationSql.indexOf('BEGIN;');
  const truncateIndex = fullMigrationSql.indexOf('TRUNCATE TABLE');

  if (beginIndex === -1 || truncateIndex === -1 || truncateIndex <= beginIndex) {
    throw new Error('Could not find schema section in supabase-full-migration.sql.');
  }

  return fullMigrationSql.slice(beginIndex + 'BEGIN;'.length, truncateIndex).trim();
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  const columnSql = columns.map(quoteIdentifier).join(', ');

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${placeholders})`,
      values
    );
  }

  return rows.length;
}

async function resetIdentity(client, table) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1),
      (SELECT COUNT(*) FROM ${quoteIdentifier(table)}) > 0
    )
  `);
}

async function main() {
  const sqlitePath = path.resolve(process.argv[2] || DEFAULT_SQLITE_PATH);
  const connectionString = process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    throw new Error('Set SUPABASE_DATABASE_URL before running this migration.');
  }

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const SQL = await initSqlJs();
  const sqliteBuffer = fs.readFileSync(sqlitePath);
  const sqliteDb = new SQL.Database(sqliteBuffer);
  const schemaSql = readSchemaSql();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const counts = [];

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query(`TRUNCATE TABLE ${TABLES.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`);

    for (const table of TABLES) {
      const rows = readRows(sqliteDb, table);
      const count = await insertRows(client, table, rows);
      await resetIdentity(client, table);
      counts.push({ table, count });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    sqliteDb.close();
    await client.end();
  }

  console.log('Migration completed successfully.');
  counts.forEach(({ table, count }) => console.log(`${table}: ${count}`));
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
