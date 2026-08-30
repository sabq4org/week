import { config } from "dotenv";
config({ path: ".env.local" }); config();
import { ingestAll } from "../src/ingest/sama";
ingestAll().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
