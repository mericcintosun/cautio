import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseEventLogs,
  parseUnits,
  stringToHex,
  toHex,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import {
  CHAIN_ID,
  EXPLORER,
  LOG_PREFIX,
  RPC_RETRY_COUNT,
  RPC_TIMEOUT_MS,
  RPC_URL,
  TX_RECEIPT_TIMEOUT_MS,
  USDG_DECIMALS,
  VAULT_ADDRESS,
} from "./config";
import { toCoreError, type CoreError } from "./errors";

// The one integration module between the UI and DepositVault on Arbitrum.
// Reads use the public Arbitrum Sepolia RPC (no key). Writes go through sendVaultTx:
// real DepositVault transactions signed by the browser wallet when a vault address
// and a wallet are present, a labelled simulation otherwise.

export { CHAIN_ID, EXPLORER, USDG_DECIMALS, VAULT_ADDRESS };

export const depositVaultAbi = parseAbi([
  "function token() view returns (address)",
  "function leaseCount() view returns (uint256)",
  "function leases(uint256) view returns (address tenant, address landlord, address arbiter, uint128 deposit, uint128 claimedTotal, uint128 acceptedTotal, uint128 disputedTotal, uint128 landlordAward, uint64 window, uint64 deadline, uint8 phase, uint8 itemCount)",
  "function items(uint256, uint256) view returns (uint128 amount, bytes32 entryPhoto, bytes32 exitPhoto, bool disputed)",
  "function offers(uint256, address) view returns (bytes32 commit, uint128 amount, bool revealed)",
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
  "event LeaseOpened(uint256 indexed id, address indexed tenant, address indexed landlord, address arbiter, uint256 deposit, uint64 window)",
  // Custom errors, copied from DepositVault.sol, so viem can decode reverts.
  "error InvalidParty()",
  "error InvalidAmount()",
  "error InvalidWindow()",
  "error WrongPhase(uint8 expected, uint8 actual)",
  "error NotAllowed()",
  "error DeadlinePassed()",
  "error DeadlineNotReached()",
  "error TooManyItems()",
  "error AlreadyDone()",
  "error BadReveal()",
  "error TransferFailed()",
  "error Frozen()",
  "error Paused()",
]);

const erc20ApproveAbi = parseAbi(["function approve(address,uint256) returns (bool)"]);

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: RPC_RETRY_COUNT }),
});

export type VaultStatus =
  | { kind: "loading" }
  | { kind: "live"; chainId: number; block: bigint; vault: Address | null; leaseCount: bigint | null; token: Address | null }
  | { kind: "offline"; reason: string };

/**
 * Real read against Arbitrum Sepolia. Without NEXT_PUBLIC_CONTRACT_ADDRESS it still
 * reads the chain head (proof the RPC path works). With an address it also reads the
 * vault's lease count and token.
 */
export async function readVaultStatus(): Promise<VaultStatus> {
  try {
    const block = await publicClient.getBlockNumber();
    if (!VAULT_ADDRESS) {
      return { kind: "live", chainId: CHAIN_ID, block, vault: null, leaseCount: null, token: null };
    }
    const [leaseCount, token] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: depositVaultAbi, functionName: "leaseCount" }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: depositVaultAbi, functionName: "token" }),
    ]);
    return { kind: "live", chainId: CHAIN_ID, block, vault: VAULT_ADDRESS, leaseCount, token };
  } catch (err) {
    return { kind: "offline", reason: toCoreError(err).hint };
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
export function rememberSalt(leaseId: string, side: string, salt: Hex, amountUsdg?: number): void {
  try {
    window.localStorage.setItem(`cautio:salt:${leaseId}:${side}`, salt);
    if (amountUsdg !== undefined) window.localStorage.setItem(`cautio:amount:${leaseId}:${side}`, String(amountUsdg));
  } catch {
    // Private mode or storage full: the salt still lives in memory for this session.
  }
}

/**
 * Reads back what rememberSalt stored for this lease and side. Per-user browser state,
 * not a store: it never leaves the browser that sealed the offer.
 */
export function recallSalt(leaseId: string, side: string): { salt: Hex; amount: number | null } | null {
  try {
    const salt = window.localStorage.getItem(`cautio:salt:${leaseId}:${side}`);
    if (!salt || !/^0x[0-9a-fA-F]{64}$/.test(salt)) return null;
    const raw = window.localStorage.getItem(`cautio:amount:${leaseId}:${side}`);
    const amount = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
    return { salt: salt as Hex, amount };
  } catch {
    return null;
  }
}

/** SHA-256 of a photo file, computed in the browser with Web Crypto. */
export async function sha256Hex(file: Blob): Promise<Hex> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return toHex(new Uint8Array(digest));
}

export type VaultWrite =
  | "openLease"
  | "startMoveOut"
  | "addItem"
  | "submitItems"
  | "respond"
  | "commitOffer"
  | "revealOffer"
  | "pickOffer"
  | "resolveTimeout"
  | "settle";

export interface VaultTx {
  hash: Hex;
  simulated: boolean;
  /** For a real openLease: the new on-chain lease id, read from the LeaseOpened log of the receipt. */
  leaseId?: number;
}

const usdg = (n: unknown): bigint => parseUnits(String(n), USDG_DECIMALS);

/**
 * The single place where UI values become contract arguments.
 * Callers pass plain numbers for USDG amounts and leave the lease id out:
 *   openLease    [landlord, arbiter, depositUsdg, windowSeconds]
 *   addItem      [amountUsdg, entryHash, exitHash]
 *   respond      [disputeMask]
 *   commitOffer  [commit]
 *   revealOffer  [amountUsdg, salt]
 *   pickOffer    [tenantOffer]
 *   startMoveOut, submitItems, resolveTimeout, settle: []
 * Every fn except openLease gets BigInt(leaseId) prepended.
 */
export function buildVaultArgs(fn: VaultWrite, leaseId: number, args: readonly unknown[]): readonly unknown[] {
  switch (fn) {
    case "openLease":
      return [args[0], args[1], usdg(args[2]), BigInt(String(args[3]))];
    case "addItem":
      return [BigInt(leaseId), usdg(args[0]), args[1], args[2]];
    case "revealOffer":
      return [BigInt(leaseId), usdg(args[0]), args[1]];
    case "respond":
      return [BigInt(leaseId), BigInt(String(args[0]))];
    default:
      return [BigInt(leaseId), ...args];
  }
}

/** Where a lease's data came from. Only "chain" leases may sign real transactions. */
export type LeaseOrigin = "chain" | "seed";

/** The injected browser wallet (window.ethereum), or null on the server and without one. */
export function browserWallet(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  return eth ?? null;
}

function walletClient(provider: EIP1193Provider) {
  return createWalletClient({ chain: arbitrumSepolia, transport: custom(provider) });
}

/** Asks the wallet for an account. Returns the account and the chain the wallet is on. */
export async function connectBrowserWallet(): Promise<{ account: Address; chainId: number }> {
  const provider = browserWallet();
  if (!provider) throw new Error("no browser wallet", { cause: { error: "not_configured", hint: "No browser wallet found. Writes stay simulated." } });
  const wallet = walletClient(provider);
  const [account] = await wallet.requestAddresses();
  const chainId = await wallet.getChainId();
  return { account, chainId };
}

/** Reads the already authorized account without a prompt, or null. */
export async function readBrowserWallet(): Promise<{ account: Address; chainId: number } | null> {
  const provider = browserWallet();
  if (!provider) return null;
  const wallet = walletClient(provider);
  const [account] = await wallet.getAddresses();
  if (!account) return null;
  return { account, chainId: await wallet.getChainId() };
}

/** Switches the wallet to Arbitrum Sepolia; adds the chain first when the wallet does not know it (4902). */
export async function switchToVaultChain(): Promise<void> {
  const provider = browserWallet();
  if (!provider) return;
  const wallet = walletClient(provider);
  try {
    await wallet.switchChain({ id: CHAIN_ID });
  } catch (err) {
    if (!hasCode(err, 4902)) throw err;
    await wallet.addChain({ chain: arbitrumSepolia });
    await wallet.switchChain({ id: CHAIN_ID });
  }
}

function hasCode(err: unknown, code: number): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    if ((cur as { code?: unknown }).code === code) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * True when sendVaultTx would sign a real transaction instead of simulating one:
 * a vault address, a browser wallet, and a lease read from the chain (openLease always
 * creates a chain lease).
 */
export function canSendRealTx(fn: VaultWrite, leaseId: number, origin?: LeaseOrigin): boolean {
  return VAULT_ADDRESS !== null && browserWallet() !== null && origin === "chain" && (leaseId > 0 || fn === "openLease");
}

// Writes on their way, keyed `${fn}:${leaseId}`. A double click cannot send a second identical write.
const inFlight = new Set<string>();

function assertNotInFlight(fn: VaultWrite, leaseId: number): string {
  const key = `${fn}:${leaseId}`;
  if (inFlight.has(key)) {
    const core: CoreError = { error: "invalid_input", hint: "That call is already on its way. Wait for it to confirm." };
    throw new Error(core.hint, { cause: core });
  }
  inFlight.add(key);
  return key;
}

async function realVaultTx(fn: VaultWrite, leaseId: number, args: readonly unknown[]): Promise<VaultTx> {
  const vault = VAULT_ADDRESS as Address;
  const provider = browserWallet() as EIP1193Provider;
  const wallet = walletClient(provider);
  const [account] = await wallet.requestAddresses();
  await switchToVaultChain();

  const callArgs = buildVaultArgs(fn, leaseId, args);
  console.info(`${LOG_PREFIX} tx requested fn=${fn}`);

  // Dry run first, so a revert comes back decoded (NotAllowed, WrongPhase...) before the
  // wallet asks for a signature. openLease is skipped: it needs the approve below first.
  if (fn !== "openLease") {
    await publicClient.simulateContract({
      address: vault,
      abi: depositVaultAbi,
      functionName: fn,
      args: callArgs,
      account,
    } as never);
  }

  if (fn === "openLease") {
    const token = await publicClient.readContract({ address: vault, abi: depositVaultAbi, functionName: "token" });
    const approveHash = await wallet.writeContract({
      address: token,
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [vault, callArgs[2] as bigint],
      chain: arbitrumSepolia,
      account,
    });
    console.info(`${LOG_PREFIX} tx submitted fn=approve hash=${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: TX_RECEIPT_TIMEOUT_MS });
    console.info(`${LOG_PREFIX} tx confirmed fn=approve block=${approveReceipt.blockNumber}`);
    if (approveReceipt.status !== "success") throw new Error("approve reverted");
  }

  // functionName is a union of the vault's writes, so viem cannot narrow args statically;
  // buildVaultArgs above is where their shape is fixed.
  const hash = await wallet.writeContract({
    address: vault,
    abi: depositVaultAbi,
    functionName: fn,
    args: callArgs,
    chain: arbitrumSepolia,
    account,
  } as never);
  console.info(`${LOG_PREFIX} tx submitted fn=${fn} hash=${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: TX_RECEIPT_TIMEOUT_MS });
  console.info(`${LOG_PREFIX} tx confirmed fn=${fn} block=${receipt.blockNumber}`);
  if (receipt.status !== "success") throw new Error(`${fn} reverted`);
  if (fn === "openLease") {
    const [opened] = parseEventLogs({ abi: depositVaultAbi, eventName: "LeaseOpened", logs: receipt.logs });
    if (opened) return { hash, simulated: false, leaseId: Number(opened.args.id) };
  }
  return { hash, simulated: false };
}

const fmt = (n: number | undefined): string => `${(n ?? 0).toLocaleString("en-US")} USDG`;

/**
 * One plain sentence per write, shown above its send button before the wallet opens,
 * so the amount in the popup is the amount the page already said.
 */
export function describeTx(fn: VaultWrite, ctx: { deposit?: number; amount?: number; street: string }): string {
  const { deposit, amount, street } = ctx;
  switch (fn) {
    case "openLease":
      return `Approve exactly ${fmt(deposit)} for DepositVault, then lock it for ${street}.`;
    case "startMoveOut":
      return `Start the move-out on ${street}. The landlord's listing window opens; no money moves.`;
    case "addItem":
      return `Record one deduction of ${fmt(amount)} with two photo hashes on ${street}. No money moves.`;
    case "submitItems":
      return `Send the list of ${fmt(amount)} in deductions on ${street} to the tenant. No money moves.`;
    case "respond":
      return (amount ?? 0) > 0
        ? `Accept ${fmt(amount)} and dispute the rest of the list on ${street}. No money moves.`
        : `Dispute every deduction on ${street}. No money moves.`;
    case "commitOffer":
      return `Seal a hash of your final number on ${street}. The number itself stays in this browser.`;
    case "revealOffer":
      return `Open your sealed offer of ${fmt(amount)} on ${street} so the arbiter can see it.`;
    case "pickOffer":
      return `Pick the offer of ${fmt(amount)} on ${street}. This fixes the landlord's award.`;
    case "resolveTimeout":
      return `Close the timed-out step on ${street}, then pay ${fmt(deposit)} back to the tenant from DepositVault.`;
    case "settle":
      return `Pay ${fmt(amount)} to the landlord and ${fmt((deposit ?? 0) - (amount ?? 0))} to the tenant from DepositVault.`;
  }
}

/**
 * Sends one DepositVault write.
 * Real path: NEXT_PUBLIC_CONTRACT_ADDRESS is set, a browser wallet is present, the lease
 * was read from the chain (origin "chain") and has an on-chain id (or fn is openLease).
 * The wallet signs, and the call resolves only after the receipt on Arbitrum Sepolia.
 * Simulated path otherwise: waits like a block would and returns a labelled fake hash.
 * A failure throws an Error whose `cause` is a CoreError with a human hint.
 * The same fn on the same lease cannot be in flight twice (assertNotInFlight).
 */
export async function sendVaultTx(
  fn: VaultWrite,
  leaseId: number,
  args: readonly unknown[] = [],
  origin?: LeaseOrigin
): Promise<VaultTx> {
  const key = assertNotInFlight(fn, leaseId);
  try {
    if (canSendRealTx(fn, leaseId, origin)) {
      try {
        return await realVaultTx(fn, leaseId, args);
      } catch (err) {
        const core = toCoreError(err);
        console.warn(`${LOG_PREFIX} tx failed fn=${fn} error=${core.error}`);
        throw new Error(core.hint, { cause: core });
      }
    }
    await new Promise((r) => setTimeout(r, 450));
    const hash = keccak256(stringToHex(`${fn}:${leaseId}:${args.map(String).join(",")}:${Date.now()}`));
    return { hash, simulated: true };
  } finally {
    inFlight.delete(key);
  }
}
