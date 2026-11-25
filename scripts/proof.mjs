// npm run proof
// Writes proof blocks into README.md and SUBMISSION.md (each file gets the blocks it has):
//   addresses:  Live URL and DepositVault rows, the vault linked to Arbiscan when set
//   chain-read: Arbitrum Sepolia block number and latency, plus leaseCount() and token()
//               when NEXT_PUBLIC_CONTRACT_ADDRESS is set
//   forge-test: the Suite result and passed lines of `forge test` in contracts/
//   demo-state: id, phase and deposit of the two demo anchor leases (newest fingerprint match)
// Never throws for a missing key, always exits 0, writes only README.md and SUBMISSION.md.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, isAddress, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [join(ROOT, "README.md"), join(ROOT, "SUBMISSION.md")];
const LIVE_URL = "https://cautio-beta.vercel.app";
const RPC_TIMEOUT_MS = 8000;
const RPC_RETRY_COUNT = 1;
const FORGE_TIMEOUT_MS = 90_000;
const EXPLORER = "https://sepolia.arbiscan.io";

/** Read-only parse of .env.local; real process.env values win. */
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

async function chainRead(env) {
  const rpc = env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc, { timeout: RPC_TIMEOUT_MS, retryCount: RPC_RETRY_COUNT }),
  });
  const address = env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
  const vault = isAddress(address) ? address : null;
  const when = new Date().toISOString();

  try {
    const started = Date.now();
    const block = await client.getBlockNumber();
    const ms = Date.now() - started;
    const lines = [`Arbitrum Sepolia (421614) block ${block} read in ${ms} ms on ${when}.`];

    if (!vault) {
      lines.push("", "Not run in this build: NEXT_PUBLIC_CONTRACT_ADDRESS is not configured.");
      return { summary: `chain-read: block ${block} in ${ms} ms, no vault address`, body: lines.join("\n") };
    }

    const abi = parseAbi(["function leaseCount() view returns (uint256)", "function token() view returns (address)"]);
    const [leaseCount, token] = await Promise.all([
      client.readContract({ address: vault, abi, functionName: "leaseCount" }),
      client.readContract({ address: vault, abi, functionName: "token" }),
    ]);
    lines.push(
      "",
      `- DepositVault [${vault}](${EXPLORER}/address/${vault})`,
      `- \`leaseCount()\` = ${leaseCount}`,
      `- \`token()\` = [${token}](${EXPLORER}/address/${token})`
    );
    return { summary: `chain-read: block ${block} in ${ms} ms, leaseCount ${leaseCount}`, body: lines.join("\n") };
  } catch {
    return {
      summary: "chain-read: RPC did not answer",
      body: `Not run in this build: the Arbitrum Sepolia RPC did not answer within ${RPC_TIMEOUT_MS} ms (one retry) on ${when}.`,
    };
  }
}

// Same fingerprints as DEMO_ANCHORS in lib/adapter/real.ts (this script cannot import TS).
// Row indices: 3 deposit, 4 claimedTotal, 8 window, 10 phase, 11 itemCount.
const DEMO_ANCHORS = [
  { seedId: "rua-harmonia-302", match: (r) => r[3] === 3_000_000_000n && Number(r[11]) === 2 && r[4] === 1_300_000_000n },
  { seedId: "alameda-santos-1140", match: (r) => r[3] === 3_600_000_000n && Number(r[11]) === 0 && r[8] === 60n },
];
const PHASES = ["None", "Active", "MoveOut", "Itemized", "Sealed", "Revealed", "Ruled", "Settled"];
const NEWEST_LEASES = 24;

async function demoState(env) {
  const address = env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
  const vault = isAddress(address) ? address : null;
  if (!vault) {
    return { summary: "demo-state: no vault address", body: "Not run in this build: NEXT_PUBLIC_CONTRACT_ADDRESS is not configured." };
  }
  const missing = ["DEMO_TENANT_KEY", "DEMO_LANDLORD_KEY", "DEMO_ARBITER_KEY"].filter((k) => !env[k]);
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc", {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RPC_RETRY_COUNT,
    }),
  });
  const abi = parseAbi([
    "function leaseCount() view returns (uint256)",
    "function leases(uint256) view returns (address tenant, address landlord, address arbiter, uint128 deposit, uint128 claimedTotal, uint128 acceptedTotal, uint128 disputedTotal, uint128 landlordAward, uint64 window, uint64 deadline, uint8 phase, uint8 itemCount)",
  ]);
  const when = new Date().toISOString();
  try {
    const count = Number(await client.readContract({ address: vault, abi, functionName: "leaseCount" }));
    const ids = Array.from({ length: Math.min(count, NEWEST_LEASES) }, (_, i) => count - i);
    const rows = await Promise.all(ids.map((id) => client.readContract({ address: vault, abi, functionName: "leases", args: [BigInt(id)] })));
    const lines = [];
    for (const anchor of DEMO_ANCHORS) {
      const k = ids.findIndex((_, i) => anchor.match(rows[i]));
      if (k === -1) {
        lines.push(`- \`${anchor.seedId}\`: Not run in this build: no matching lease in the newest ${NEWEST_LEASES} (run \`npm run demo:reset\`).`);
        continue;
      }
      const r = rows[k];
      lines.push(`- \`${anchor.seedId}\`: lease #${ids[k]}, phase ${PHASES[Number(r[10])] ?? r[10]}, deposit ${Number(r[3]) / 1e6} USDG`);
    }
    lines.push("", `Read from DepositVault \`leaseCount()\` = ${count} on ${when}.`);
    if (missing.length > 0) lines.push(`Role keys not set here (${missing.join(", ")}), so this run did not reseed.`);
    return { summary: `demo-state: ${lines.filter((l) => l.startsWith("- ") && l.includes("lease #")).length} of 2 anchors found`, body: lines.join("\n") };
  } catch {
    return {
      summary: "demo-state: RPC did not answer",
      body: `Not run in this build: the Arbitrum Sepolia RPC did not answer within ${RPC_TIMEOUT_MS} ms (one retry) on ${when}.`,
    };
  }
}

function forgeTest() {
  const res = spawnSync("forge", ["test"], {
    cwd: join(ROOT, "contracts"),
    encoding: "utf8",
    timeout: FORGE_TIMEOUT_MS,
  });
  if (res.error && res.error.code === "ENOENT") {
    return { summary: "forge-test: forge not installed", body: "Not run in this build: forge is not installed on the runner." };
  }
  if (res.error) {
    return {
      summary: "forge-test: did not finish",
      body: `Not run in this build: forge test did not finish within ${FORGE_TIMEOUT_MS / 1000} seconds.`,
    };
  }
  // eslint-disable-next-line no-control-regex
  const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
  const picked = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("Suite result") || /\d+ (tests? )?passed/.test(l));
  const unique = [...new Set(picked)];
  const status = res.status === 0 ? "exit code 0" : `exit code ${res.status}`;
  const body = unique.length
    ? ["```", ...unique, "```", "", `\`forge test\` in contracts/, ${status}, ${new Date().toISOString()}.`].join("\n")
    : `forge test ran (${status}) but printed no Suite result line.`;
  return { summary: `forge-test: ${unique[unique.length - 1] ?? status}`, body };
}

/** The addresses table: never hand-typed, always from the configured env. */
function addresses(env) {
  const address = env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
  const vault = isAddress(address) ? address : null;
  const row = vault
    ? `| DepositVault | [${vault}](${EXPLORER}/address/${vault}) (Arbitrum Sepolia, 421614) |`
    : "| DepositVault | Not run in this build: NEXT_PUBLIC_CONTRACT_ADDRESS is not configured. |";
  return {
    summary: vault ? `addresses: vault ${vault}` : "addresses: no vault address",
    body: ["| What | Where |", "| --- | --- |", `| Live URL | ${LIVE_URL} |`, row].join("\n"),
  };
}

function writeBlock(text, name, body, file) {
  const begin = `<!-- PROOF:BEGIN ${name} -->`;
  const end = `<!-- PROOF:END ${name} -->`;
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    console.log(`proof: ${file} has no ${name} block, skipped`);
    return text;
  }
  return `${text.slice(0, i + begin.length)}\n${body}\n${text.slice(j)}`;
}

async function main() {
  const env = loadEnv();
  const addr = addresses(env);
  console.log(addr.summary);
  const chain = await chainRead(env);
  console.log(chain.summary);
  const forge = forgeTest();
  console.log(forge.summary);
  const demo = await demoState(env);
  console.log(demo.summary);

  for (const target of TARGETS) {
    const file = target.slice(ROOT.length + 1);
    if (!existsSync(target)) {
      console.log(`proof: ${file} not found, nothing written`);
      continue;
    }
    let text = readFileSync(target, "utf8");
    text = writeBlock(text, "addresses", addr.body, file);
    text = writeBlock(text, "chain-read", chain.body, file);
    text = writeBlock(text, "forge-test", forge.body, file);
    text = writeBlock(text, "demo-state", demo.body, file);
    writeFileSync(target, text);
  }
}

main()
  .catch((err) => {
    console.log(`proof: stopped early (${err instanceof Error ? err.name : "unknown error"})`);
  })
  .finally(() => process.exit(0));
