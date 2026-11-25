import { ADAPTER_MODE_ENV } from "../config";
import type { DataSource, Lease } from "../types";
import { fakeAdapter } from "./fake";
import { realAdapter } from "./real";

// The read seam. Pages and API routes ask getAdapter() for leases and never import
// the seed directly. Writes stay client side in sendVaultTx (lib/vault.ts).
// Server only: no "use client" file may import this module.

export interface CautioAdapter {
  mode: "fake" | "real";
  listLeases(): Promise<Lease[]>;
  getLease(id: string): Promise<Lease | null>;
  /** Where the leases come from, for the status line above the desk. */
  describe(): Promise<DataSource>;
}

export type AdapterMode = CautioAdapter["mode"];

/** The only place that branches on ADAPTER_MODE. Defaults to the seed. */
export function getAdapter(): CautioAdapter {
  return ADAPTER_MODE_ENV === "real" ? realAdapter : fakeAdapter;
}
