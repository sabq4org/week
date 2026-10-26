import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __ewPool?: Pool };
let cached: Db | undefined;

// الاتصال يُنشأ عند أول استخدام لا عند الاستيراد، حتى لا يفشل `next build`
// (الذي يستورد مسارات الـAPI لجمع بياناتها) في بيئة بلا DATABASE_URL.
function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = globalForDb.__ewPool ?? new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  if (process.env.NODE_ENV !== "production") globalForDb.__ewPool = pool;
  cached = drizzle(pool, { schema });
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
