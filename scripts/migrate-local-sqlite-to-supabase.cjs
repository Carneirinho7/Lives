const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { Pool } = require("pg");

const envLine = readFileSync(join(process.cwd(), ".env.local"), "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("DATABASE_URL="));
if (!envLine) throw new Error("DATABASE_URL is missing from .env.local");

const localDb = new DatabaseSync(join(process.cwd(), "data", "liveloot.sqlite"));
const pool = new Pool({
  connectionString: envLine.slice("DATABASE_URL=".length),
  ssl: {
    ca: readFileSync(join(process.cwd(), "supabase", "prod-ca-2021.crt"), "utf8"),
    rejectUnauthorized: true,
  },
  max: 1,
});
const tables = ["user", "account", "session", "verification"];

async function migrate() {
  const client = await pool.connect();
  try {
    const counts = {};
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::int AS count FROM liveloot."${table}"`);
      counts[table] = result.rows[0].count;
    }
    if (Object.values(counts).some((count) => count > 0)) {
      throw new Error("The Supabase auth schema is not empty; local data was not copied.");
    }

    await client.query("BEGIN");
    for (const table of tables) {
      const localRows = localDb.prepare(`SELECT * FROM "${table}"`).all();
      const columnsResult = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'liveloot' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      const targetColumns = new Map(columnsResult.rows.map((column) => [column.column_name, column.data_type]));

      for (const row of localRows) {
        const columns = Object.keys(row).filter((column) => targetColumns.has(column));
        const values = columns.map((column) => {
          const value = row[column];
          if (value === null || value === undefined) return value;
          if (targetColumns.get(column) === "boolean") return Boolean(value);
          return value;
        });
        const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO liveloot."${table}" (${quotedColumns}) VALUES (${placeholders})`,
          values,
        );
      }
    }
    await client.query("COMMIT");

    for (const table of tables) {
      await client.query(`ALTER TABLE liveloot."${table}" ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON TABLE liveloot."${table}" FROM PUBLIC, anon, authenticated`);
      await client.query(`DROP POLICY IF EXISTS app_runtime_all ON liveloot."${table}"`);
      await client.query(
        `CREATE POLICY app_runtime_all ON liveloot."${table}"
         FOR ALL TO liveloot_runtime USING (true) WITH CHECK (true)`,
      );
    }

    const summary = {};
    for (const table of tables) {
      summary[table] = localDb.prepare(`SELECT count(*) AS count FROM "${table}"`).get().count;
    }
    console.log(`Migrated local Better Auth data to Supabase: ${JSON.stringify(summary)}`);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
    localDb.close();
  }
}

migrate().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
