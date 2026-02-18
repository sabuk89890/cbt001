const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

(async () => {
  try {
    const sqlPath = path.resolve(__dirname, '../supabase/schema.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    const connection = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_CONNECTION;
    if (!connection) {
      console.error('Environment variable SUPABASE_DB_URL or DATABASE_URL must be set with your Postgres connection string.');
      process.exit(1);
    }

    const client = new Client({ connectionString: connection });
    await client.connect();
    console.log('Connected to database. Running migration...');

    await client.query(sql);
    console.log('Migration applied successfully.');

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(2);
  }
})();
