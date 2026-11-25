// npm run proof
// Writes two proof blocks into README.md:
//   chain-read: Arbitrum Sepolia block number and latency, plus leaseCount() and token()
//               when NEXT_PUBLIC_CONTRACT_ADDRESS is set
//   forge-test: the Suite result and passed lines of `forge test` in contracts/
// Never throws for a missing key, always exits 0, writes only README.md.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, isAddress, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");
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

function writeBlock(text, name, body) {
  const begin = `<!-- PROOF:BEGIN ${name} -->`;
  const end = `<!-- PROOF:END ${name} -->`;
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    console.log(`proof: README.md has no ${name} block, skipped`);
    return text;
  }
  return `${text.slice(0, i + begin.length)}\n${body}\n${text.slice(j)}`;
}

async function main() {
  const env = loadEnv();
  const chain = await chainRead(env);
  console.log(chain.summary);
  const forge = forgeTest();
  console.log(forge.summary);

  if (!existsSync(README)) {
    console.log("proof: README.md not found, nothing written");
    return;
  }
  let text = readFileSync(README, "utf8");
  text = writeBlock(text, "chain-read", chain.body);
  text = writeBlock(text, "forge-test", forge.body);
  writeFileSync(README, text);
}

main()
  .catch((err) => {
    console.log(`proof: stopped early (${err instanceof Error ? err.name : "unknown error"})`);
  })
  .finally(() => process.exit(0));
