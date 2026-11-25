import type { Address, Hex } from "viem";
import type { ErrorCode } from "./errors";

// Shared types for the lease desk. Relative-import safe (no "@/" paths) so that
// scripts/seed.ts can load them through tsx.

export type Phase = "Active" | "MoveOut" | "Itemized" | "Sealed" | "Revealed" | "Ruled" | "Settled";
export type Answer = "pending" | "accepted" | "disputed";
export type Side = "landlord" | "tenant";

export interface Party {
  name: string;
  address: Address;
}

export interface Arbiter extends Party {
  agency: string;
}

export interface DeductionItem {
  id: string;
  label: string;
  amount: number;
  entryNote: string;
  exitNote: string;
  /** SHA-256 of the move-in photo, written on chain with the item. */
  entryPhoto: Hex;
  /** SHA-256 of the move-out photo. */
  exitPhoto: Hex;
  answer: Answer;
}

export interface SeedOffer {
  amount: number;
  salt: Hex;
  /** Chain leases only: the commit read from DepositVault. Seed offers derive it from amount and salt. */
  commit?: Hex;
  /** Chain leases only: whether this side has revealed. Until then `amount` and `salt` are unknown (0 and zero hash). */
  revealed?: boolean;
}

export interface Lease {
  id: string;
  onchainId: number;
  street: string;
  neighborhood: string;
  monthlyRent: number;
  deposit: number;
  openedOn: string;
  moveOutOn: string | null;
  phase: Phase;
  windowDays: number;
  deadline: string | null;
  tenant: Party;
  landlord: Party;
  arbiter: Arbiter;
  items: DeductionItem[];
  offers: { landlord: SeedOffer | null; tenant: SeedOffer | null; opened: boolean };
  landlordAward: number | null;
  note: string;
  /** "chain" when read from DepositVault (writes may be real); missing or "seed" means seed data (writes simulated). */
  origin?: "chain" | "seed";
}

/** Envelope for every /api response. `source` says whether the data came from seed or chain. */
export type ApiResponse<T> =
  | { ok: true; source: "fake" | "real"; data: T }
  | { ok: false; source: "fake" | "real"; error: ErrorCode; hint: string };

/** Where the desk's leases came from, as shown in the chain status line. */
export type DataSource =
  | { kind: "seed"; reason: string }
  | { kind: "chain"; chainId: number; vault: Address; block: string };

/** What the tenant fills in on the open-lease panel before `openLease`. */
export type OpenLeaseInput = {
  landlord: Party;
  arbiter: Arbiter;
  tenant: Party;
  deposit: number;
  windowDays: number;
  entryPhoto: Hex | null;
};
