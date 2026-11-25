import type { Address, Hex } from "viem";
import type { Lease } from "./types";

// The browser wallet as one discriminated union. Every screen that signs or shows a
// transaction switches on `kind`; there is no second source of truth for "busy".
// States after a connection carry the account so role gating does not flicker while a
// transaction is pending.

export type WalletState =
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "wrong-network"; account: Address }
  | { kind: "idle"; account: Address }
  | { kind: "tx-pending"; label: string; account: Address | null }
  | { kind: "tx-confirmed"; label: string; hash: Hex; simulated: boolean; account: Address | null }
  | { kind: "tx-rejected"; label: string; account: Address | null }
  | { kind: "tx-failed"; label: string; hint: string; account: Address | null };

export type WalletKind = WalletState["kind"];

export type Role = "tenant" | "landlord" | "arbiter" | "viewer";

/** The connected account, if the state has one. */
export function accountOf(state: WalletState): Address | null {
  switch (state.kind) {
    case "disconnected":
    case "connecting":
      return null;
    case "wrong-network":
    case "idle":
    case "tx-pending":
    case "tx-confirmed":
    case "tx-rejected":
    case "tx-failed":
      return state.account;
  }
}

/** Which party of the lease this account is. Addresses compare lowercased. */
export function roleOf(lease: Pick<Lease, "tenant" | "landlord" | "arbiter">, account: Address | string | null): Role {
  if (!account) return "viewer";
  const a = account.toLowerCase();
  if (lease.tenant.address.toLowerCase() === a) return "tenant";
  if (lease.landlord.address.toLowerCase() === a) return "landlord";
  if (lease.arbiter.address.toLowerCase() === a) return "arbiter";
  return "viewer";
}

export const ROLE_LABEL: Record<Role, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  arbiter: "Arbiter",
  viewer: "Viewer",
};
