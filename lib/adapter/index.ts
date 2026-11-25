import type { Lease } from "../types";
import { fakeAdapter } from "./fake";

// The read seam. Pages and API routes ask getAdapter() for leases and never import
// the seed directly. Writes stay client side in sendVaultTx (lib/vault.ts).

export interface CautioAdapter {
  mode: "fake" | "real";
  listLeases(): Promise<Lease[]>;
  getLease(id: string): Promise<Lease | null>;
}

export type AdapterMode = CautioAdapter["mode"];

export function adapterMode(): AdapterMode {
  return process.env.ADAPTER_MODE === "real" ? "real" : "fake";
}

export function getAdapter(): CautioAdapter {
  if (adapterMode() === "real") {
    // TODO(Phase 2): chain reads via lib/vault.ts
    return fakeAdapter;
  }
  return fakeAdapter;
}
