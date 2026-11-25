// npm run demo:reset
// Rebuilds the demo in two parts:
//   1. fixtures: `tsx scripts/seed.ts` rewrites fixtures/leases.json from lib/data/seed.ts
//   2. chain:    `forge script script/SeedDemo.s.sol --broadcast` in contracts/ opens two
//                fresh anchor leases for the three role wallets
// The chain is append-only: a reset never rewinds a lease, it opens new anchors, and the
// desk (lib/adapter/real.ts) shows only the newest lease matching each anchor fingerprint.
// Reads .env.local plus process.env (read only), passes the env to forge through
// spawnSync, never prints a key, and always exits 0.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORGE_TIMEOUT_MS = 300_000;
const DEFAULT_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const FORGE_KEYS = ["PRIVATE_KEY", "DEPLOYED_CONTRACT", "DEMO_TENANT_KEY", "DEMO_LANDLORD_KEY", "DEMO_ARBITER_KEY"];

/** Read-only parse of .env.local; real process.env values win. Same as scripts/proof.mjs. */
function loadEnv() {
  const env = {};
  const file = join(ROOT, ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && v !== "") env[k] = v;
  }
  return env;
}

function seedFixtures() {
  console.log("demo:reset 1/2 fixtures: tsx scripts/seed.ts");
  const res = spawnSync("npx", ["tsx", "scripts/seed.ts"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (res.error) console.log(`demo:reset fixtures not run: ${res.error.code ?? "could not start tsx"}`);
  else if (res.status !== 0) console.log(`demo:reset fixtures exited with code ${res.status}`);
}

function seedChain(env) {
  console.log("demo:reset 2/2 chain: forge script script/SeedDemo.s.sol --broadcast");
  // The deploy step writes NEXT_PUBLIC_CONTRACT_ADDRESS; reuse it when DEPLOYED_CONTRACT is not set.
  if (!env.DEPLOYED_CONTRACT && env.NEXT_PUBLIC_CONTRACT_ADDRESS) env.DEPLOYED_CONTRACT = env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  const missing = FORGE_KEYS.filter((k) => !env[k]);
  if (missing.length > 0) {
    for (const k of missing) console.log(`Not run: missing ${k}`);
    return;
  }

  const rpc = env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;
  const res = spawnSync("forge", ["script", "script/SeedDemo.s.sol", "--rpc-url", rpc, "--broadcast"], {
    cwd: join(ROOT, "contracts"),
    env: { ...process.env, ...env },
    stdio: "inherit",
    timeout: FORGE_TIMEOUT_MS,
  });
  if (res.error && res.error.code === "ENOENT") {
    console.log("Not run: forge is not installed");
    return;
  }
  if (res.error) {
    console.log(`Not run: forge did not finish within ${FORGE_TIMEOUT_MS / 1000} seconds`);
    return;
  }
  if (res.status !== 0) {
    console.log(`demo:reset chain: forge exited with code ${res.status}. Check the farm wallet balance (0.01 Arbitrum Sepolia ETH).`);
    return;
  }
  console.log("demo:reset chain: two fresh anchors opened. The Alameda Santos refund opens 60 seconds from now.");
}

try {
  const env = loadEnv();
  seedFixtures();
  seedChain(env);
} catch (err) {
  console.log(`demo:reset stopped early (${err instanceof Error ? err.name : "unknown error"})`);
}
process.exit(0);
