import { config } from "dotenv";
config({ path: ".env.local" }); config();
import { ingestAll } from "../src/ingest/sama";
import { ingestMarkets } from "../src/ingest/markets";
import { ingestPosWeekly, ingestMonthlyBulletin } from "../src/ingest/reports";
Promise.all([ingestAll(), ingestMarkets().catch((e) => ({ error: String(e) })), ingestPosWeekly().catch((e) => ({ posError: String(e) })), ingestMonthlyBulletin().catch((e) => ({ bulletinError: String(e) }))]).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
