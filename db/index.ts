import { Pool } from "pg";

let pool: Pool | undefined;

function connection(): Pool {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is not configured.");
  // Supabase signs its pooler certificate with its own CA (not in Node's trust store).
  // Traffic stays encrypted; provide DATABASE_CA_CERT (PEM) to enable strict verification.
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  // pg lets URL params such as ?sslmode=require override the `ssl` option above.
  const url = new URL(rawUrl.trim());
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(key);
  pool ??= new Pool({ connectionString: url.toString(), max: 1, ssl });
  return pool;
}

// Keep parameter binding separate from SQL text for the ticket routes.
export function getDb() {
  return {
    prepare(sql: string) {
      let index = 0;
      const statement = sql.replace(/\?/g, () => `$${++index}`);
      let values: unknown[] = [];
      return {
        bind(...params: unknown[]) { values = params; return this; },
        async first<T>() { const result = await connection().query(statement, values); return (result.rows[0] as T | undefined) ?? null; },
        async all<T>() { const result = await connection().query(statement, values); return { results: result.rows as T[] }; },
        async run() { const result = await connection().query(statement, values); return { meta: { changes: result.rowCount ?? 0 } }; },
      };
    },
  };
}
