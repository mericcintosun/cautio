import { TimeoutError } from "viem";

export type ErrorCode =
  | "invalid_input"
  | "upstream_timeout"
  | "upstream_error"
  | "parse_failure"
  | "not_configured"
  | "not_found";

export interface CoreError {
  error: ErrorCode;
  hint: string;
}

function isTimeout(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  // viem wraps transport errors; walk the cause chain once or twice.
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    if (cur instanceof TimeoutError) return true;
    const name = (cur as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "WaitForTransactionReceiptTimeoutError") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** Maps any thrown value to a code plus one human sentence. Provider text never passes through. */
export function toCoreError(err: unknown): CoreError {
  if (isTimeout(err)) {
    return { error: "upstream_timeout", hint: "Arbitrum Sepolia did not answer in time. Try again in a moment." };
  }
  return { error: "upstream_error", hint: "The vault call did not go through. Check your wallet and try again." };
}
