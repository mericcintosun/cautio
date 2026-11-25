// npm run seed: snapshot the seed leases to fixtures/leases.json.
// The seed is fully deterministic (no clock, no randomness), so two runs produce
// byte-identical output and `git diff fixtures/leases.json` stays empty.
// Build-time only; the app never writes files at request time.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { leases } from "../lib/data/seed";

const dir = join(process.cwd(), "fixtures");
const out = join(dir, "leases.json");

mkdirSync(dir, { recursive: true });
writeFileSync(out, JSON.stringify(leases, null, 2) + "\n", "utf8");
console.log(`seed: wrote ${leases.length} leases to fixtures/leases.json`);
