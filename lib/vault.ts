import {
  createPublicClient,
  encodeAbiParameters,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseUnits,
  stringToHex,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";

// The one integration module between the UI and DepositVault on Arbitrum.
// Reads are real from the first commit: the public Arbitrum Sepolia RPC needs no key.
// Writes go through sendVaultTx, which is the only mocked function.

const rawAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
export const VAULT_ADDRESS: Address | null = isAddress(rawAddress) ? rawAddress : null;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? arbitrumSepolia.id);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || arbitrumSepolia.rpcUrls.default.http[0];
export const EXPLORER = arbitrumSepolia.blockExplorers.default.url;

export const USDG_DECIMALS = 6;

export const depositVaultAbi = parseAbi([
  "function token() view returns (address)",
  "function leaseCount() view returns (uint256)",
  "function leases(uint256) view returns (address tenant, address landlord, address arbiter, uint128 deposit, uint128 claimedTotal, uint128 acceptedTotal, uint128 disputedTotal, uint128 landlordAward, uint64 window, uint64 deadline, uint8 phase, uint8 itemCount)",
  "function openLease(address landlord, address arbiter, uint128 deposit, uint64 window) returns (uint256)",
  "function startMoveOut(uint256 id)",
  "function addItem(uint256 id, uint128 amount, bytes32 entryPhoto, bytes32 exitPhoto)",
  "function submitItems(uint256 id)",
  "function respond(uint256 id, uint256 disputeMask)",
  "function commitOffer(uint256 id, bytes32 commit)",
  "function revealOffer(uint256 id, uint128 amount, bytes32 salt)",
  "function pickOffer(uint256 id, bool tenantOffer)",
  "function resolveTimeout(uint256 id)",
  "function settle(uint256 id)",
  "function withdraw()",
]);

const client = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC_URL) });

export type VaultStatus =
  | { kind: "loading" }
  | { kind: "live"; chainId: number; block: bigint; vault: Address | null; leaseCount: bigint | null; token: Address | null }
  | { kind: "offline"; reason: string };

/**
 * Real read against Arbitrum Sepolia. Without NEXT_PUBLIC_CONTRACT_ADDRESS it still
 * reads the chain head (proof the RPC path works) and reports that the desk is on
 * seed data. With an address it also reads the vault's lease count and token.
 */
export async function readVaultStatus(): Promise<VaultStatus> {
  try {
    const block = await client.getBlockNumber();
    if (!VAULT_ADDRESS) {
      return { kind: "live", chainId: CHAIN_ID, block, vault: null, leaseCount: null, token: null };
    }
    const [leaseCount, token] = await Promise.all([
      client.readContract({ address: VAULT_ADDRESS, abi: depositVaultAbi, functionName: "leaseCount" }),
      client.readContract({ address: VAULT_ADDRESS, abi: depositVaultAbi, functionName: "token" }),
    ]);
    return { kind: "live", chainId: CHAIN_ID, block, vault: VAULT_ADDRESS, leaseCount, token };
  } catch (err) {
    return { kind: "offline", reason: err instanceof Error ? err.message.split("\n")[0] : "RPC unreachable" };
  }
}

/**
 * The sealed offer, exactly as DepositVault.revealOffer checks it:
 * keccak256(abi.encode(id, sender, amount, salt)).
 */
export function offerCommit(leaseId: number, sender: Address, amountUsdg: number, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("uint256, address, uint128, bytes32"), [
      BigInt(leaseId),
      sender,
      parseUnits(String(amountUsdg), USDG_DECIMALS),
      salt,
    ])
  );
}

/** 32 random bytes from the browser's CSPRNG. */
export function newSalt(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Keep the salt where the reveal step can find it again. Losing it means losing the reveal. */
export function rememberSalt(leaseId: string, side: string, salt: Hex): void {
  try {
    window.localStorage.setItem(`cautio:salt:${leaseId}:${side}`, salt);
  } catch {
    // Private mode or storage full: the salt still lives in memory for this session.
  }
}

/** SHA-256 of a photo file, computed in the browser with Web Crypto. */
export async function sha256Hex(file: Blob): Promise<Hex> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return toHex(new Uint8Array(digest));
}

export type VaultWrite =
  | "startMoveOut"
  | "respond"
  | "commitOffer"
  | "revealOffer"
  | "pickOffer"
  | "resolveTimeout"
  | "settle";

export interface VaultTx {
  hash: Hex;
  simulated: boolean;
}

/**
 * Sends one DepositVault write. Mocked for now: waits like a block would and returns
 * a labelled fake hash so the UI can show the receipt row.
 * TODO: swap mock for wagmi writeContract({ address: VAULT_ADDRESS, abi: depositVaultAbi,
 * functionName: fn, args, chainId: CHAIN_ID }) once RainbowKit is wired, then
 * waitForTransactionReceipt and return { hash, simulated: false }.
 */
export async function sendVaultTx(fn: VaultWrite, leaseId: number, args: readonly unknown[] = []): Promise<VaultTx> {
  await new Promise((r) => setTimeout(r, 450));
  const hash = keccak256(stringToHex(`${fn}:${leaseId}:${args.map(String).join(",")}:${Date.now()}`));
  return { hash, simulated: true };
}
