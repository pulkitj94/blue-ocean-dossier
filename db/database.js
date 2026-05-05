// db/database.js
// ============================================
// DATABASE LAYER — PostgreSQL (Vercel Postgres / Neon)
//
// WHY THIS DESIGN: All route files use a synchronous-looking API:
//   db.prepare('SELECT ...').get(param1, param2)
//   db.prepare('INSERT ...').run(param1, param2)
//   db.prepare('SELECT ...').all(param1)
//
// PostgreSQL is async, so this wrapper queues queries and resolves them.
// Since Express route handlers can be async, we make prepare() return
// async methods. Routes need minor "await" additions.
// ============================================

const { Pool } = require('pg');

let pool = null;

// Convert SQLite-style "?" placeholders to PostgreSQL "$1, $2, $3"
function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

// Convert SQLite-specific SQL to PostgreSQL-compatible SQL
function convertSQL(sql) {
  let converted = convertPlaceholders(sql);
  // AUTOINCREMENT → SERIAL (handled in table creation)
  // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  // DATETIME DEFAULT CURRENT_TIMESTAMP → TIMESTAMPTZ DEFAULT NOW()
  converted = converted.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()');
  converted = converted.replace(/DATETIME/gi, 'TIMESTAMPTZ');
  // REAL → DOUBLE PRECISION
  converted = converted.replace(/\bREAL\b/g, 'DOUBLE PRECISION');
  // INTEGER for booleans stays INTEGER (PostgreSQL handles it fine)
  return converted;
}

class DB {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  prepare(sql) {
    const pgSQL = convertPlaceholders(sql);
    const self = this;

    return {
      async run(...params) {
        const isInsert = pgSQL.trim().toUpperCase().startsWith('INSERT');
        const finalSQL = isInsert ? pgSQL + ' RETURNING id' : pgSQL;
        const result = await self.pool.query(finalSQL, params);
        const row = result.rows[0];
        return {
          lastInsertRowid: isInsert ? (row?.id || 0) : 0,
          changes: result.rowCount || 0
        };
      },

      async get(...params) {
        const result = await self.pool.query(pgSQL, params);
        return result.rows[0] || undefined;
      },

      async all(...params) {
        const result = await self.pool.query(pgSQL, params);
        return result.rows;
      }
    };
  }

  // Transaction helper
  transaction(fn) {
    const self = this;
    return async function(...args) {
      const client = await self.pool.connect();
      try {
        await client.query('BEGIN');
        // Temporarily replace pool with client for this transaction
        const origPool = self.pool;
        self.pool = client;
        const result = await fn(...args);
        self.pool = origPool;
        await client.query('COMMIT');
        return result;
      } catch(e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    };
  }

  // Direct query execution (for table creation, etc.)
  async exec(sql) {
    await this.pool.query(sql);
  }
}

let dbInstance = null;

async function initDatabase() {
  if (dbInstance) return dbInstance;

  // Vercel Postgres sets POSTGRES_URL; fallback to DATABASE_URL
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database URL found. Set POSTGRES_URL or DATABASE_URL in .env');
    process.exit(1);
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10
  });

  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('📦 PostgreSQL connected');
  } catch(e) {
    console.error('❌ PostgreSQL connection failed:', e.message);
    process.exit(1);
  }

  dbInstance = new DB(pool);

  // Create tables (PostgreSQL syntax)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      cohort TEXT DEFAULT '',
      table_number TEXT DEFAULT '',
      custom_fields TEXT DEFAULT '{}',
      role TEXT DEFAULT 'respondent',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      module_number INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      description TEXT DEFAULT '',
      module_type TEXT DEFAULT 'assessment',
      is_default_unlocked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_module_status (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      status TEXT DEFAULT 'locked',
      completed_at TIMESTAMPTZ,
      UNIQUE(user_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      module_id INTEGER NOT NULL,
      question_number INTEGER NOT NULL,
      pillar TEXT NOT NULL,
      question_text TEXT NOT NULL,
      response_type TEXT NOT NULL,
      options TEXT DEFAULT '[]',
      scoring_logic TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS responses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      answer TEXT NOT NULL,
      score DOUBLE PRECISION DEFAULT 0,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS module_unlock_rules (
      id SERIAL PRIMARY KEY,
      module_id INTEGER NOT NULL,
      rule_type TEXT NOT NULL,
      depends_on_module_id INTEGER,
      unlock_date TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);

  return dbInstance;
}

function getDB() {
  if (!dbInstance) throw new Error('Call initDatabase() first');
  return dbInstance;
}

module.exports = { initDatabase, getDB };
