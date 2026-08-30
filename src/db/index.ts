import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const globalForDb = globalThis as unknown as { __ewPool?: Pool };
const pool = globalForDb.__ewPool ?? new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
if (process.env.NODE_ENV !== "production") globalForDb.__ewPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
