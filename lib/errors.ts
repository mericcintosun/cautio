import { TimeoutError } from "viem";

export type ErrorCode =
  | "invalid_input"
  | "upstream_timeout"
  | "upstream_error"
  | "parse_failure"
  | "not_configured"
  | "not_found"
  | "user_rejected"
  | "wrong_network";

export interface CoreError {
  error: ErrorCode;
  hint: string;
}

/** One sentence per DepositVault custom error a demo step can hit. */
const REVERT_HINTS: Record<string, string> = {
  NotAllowed: "This wallet is not the tenant, landlord or arbiter this step needs.",
  WrongPhase: "The lease has already moved to another step. Refresh from chain to see where it is.",
  DeadlinePassed: "The window for this step has closed. Anyone can now resolve the timeout.",
  DeadlineNotReached: "The window for this step is still open. Try again after it closes.",
  BadReveal: "This amount and salt do not match the sealed commit. Use the salt saved when you sealed.",
  AlreadyDone: "This wallet already did this step on this lease.",
  Frozen: "USDG is frozen for this address, so the payout is held in the vault.",
  InvalidAmount: "The amount is outside what the vault accepts for this lease.",
  InvalidParty: "Tenant, landlord and arbiter must be three different addresses.",
  InvalidWindow: "The window must be between 60 seconds and 30 days.",
  TooManyItems: "A lease holds at most 16 deduction items.",
  TransferFailed: "The USDG transfer did not go through. Check the balance and allowance.",
  Paused: "New deposits are paused on this vault. Existing leases still settle.",
};

/** Walks err, err.cause, err.cause.cause and so on (viem nests its errors). */
function chain(err: unknown): unknown[] {
  const out: unknown[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    out.push(cur);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

const field = (o: unknown, key: string): unknown => (o && typeof o === "object" ? (o as Record<string, unknown>)[key] : undefined);

function isTimeout(links: unknown[]): boolean {
  return links.some((cur) => {
    if (cur instanceof TimeoutError) return true;
    const name = field(cur, "name");
    return name === "TimeoutError" || name === "WaitForTransactionReceiptTimeoutError";
  });
}

function isUserRejected(links: unknown[]): boolean {
  return links.some((cur) => field(cur, "code") === 4001 || field(cur, "name") === "UserRejectedRequestError");
}

function isWrongNetwork(links: unknown[]): boolean {
  return links.some((cur) => {
    const name = field(cur, "name");
    return name === "ChainMismatchError" || name === "SwitchChainError" || field(cur, "code") === 4902;
  });
}

function revertName(links: unknown[]): string | null {
  for (const cur of links) {
    if (field(cur, "name") !== "ContractFunctionRevertedError") continue;
    const direct = field(cur, "errorName");
    if (typeof direct === "string") return direct;
    const nested = field(field(cur, "data"), "errorName");
    if (typeof nested === "string") return nested;
  }
  return null;
}

/** Maps any thrown value to a code plus one human sentence. Provider text never passes through. */
export function toCoreError(err: unknown): CoreError {
  const links = chain(err);
  // A CoreError already attached as a cause (sendVaultTx does this) wins.
  for (const cur of links) {
    if (isCoreError(cur)) return { error: cur.error, hint: cur.hint };
  }
  if (isUserRejected(links)) {
    return { error: "user_rejected", hint: "You closed the wallet. Nothing was sent." };
  }
  const reverted = revertName(links);
  if (reverted) {
    return {
      error: "upstream_error",
      hint: REVERT_HINTS[reverted] ?? `The vault refused the call (${reverted}).`,
    };
  }
  if (isWrongNetwork(links)) {
    return { error: "wrong_network", hint: "Switch your wallet to Arbitrum Sepolia and try again." };
  }
  if (isTimeout(links)) {
    return { error: "upstream_timeout", hint: "Arbitrum Sepolia did not answer in time. Try again in a moment." };
  }
  return { error: "upstream_error", hint: "The vault call did not go through. Check your wallet and try again." };
}

const CODES: readonly ErrorCode[] = [
  "invalid_input",
  "upstream_timeout",
  "upstream_error",
  "parse_failure",
  "not_configured",
  "not_found",
  "user_rejected",
  "wrong_network",
];

export function isCoreError(v: unknown): v is CoreError {
  const code = field(v, "error");
  return typeof code === "string" && (CODES as readonly string[]).includes(code) && typeof field(v, "hint") === "string";
}
