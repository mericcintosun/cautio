import { isAddress, type Address } from "viem";

// The one place that reads the environment for the chain integration.
// Every value here is public (NEXT_PUBLIC_* or a mode switch), so client files may import it.
// No secret is read in this module, and none may be added.

const rawAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

/** DepositVault on the target chain, or null when the address is missing or malformed. */
export const VAULT_ADDRESS: Address | null = isAddress(rawAddress) ? rawAddress : null;

/** 421614 is Arbitrum Sepolia. */
export const CHAIN_ID: number = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 421614);

export const RPC_URL: string = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

export const EXPLORER = "https://sepolia.arbiscan.io";

/** Raw ADAPTER_MODE. Only lib/adapter/index.ts branches on it. */
export const ADAPTER_MODE_ENV: string | undefined = process.env.ADAPTER_MODE;

export const USDG_DECIMALS = 6;

export const RPC_TIMEOUT_MS = 8000;
export const RPC_RETRY_COUNT = 1;
export const TX_RECEIPT_TIMEOUT_MS = 60000;

export const LOG_PREFIX = "[core]";
