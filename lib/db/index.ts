import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // Reuse the pool across hot reloads in development.
  var __aeoPool: Pool | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: /sslmode=require|supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = globalThis.__aeoPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__aeoPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
