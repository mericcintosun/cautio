import { leases } from "../data/seed";
import type { Lease } from "../types";
import type { CautioAdapter } from "./index";

// Serves the seed leases. Every call returns deep copies, so a caller that mutates
// a lease can never change what the next request sees.
const copy = <T,>(value: T): T => structuredClone(value);

export const fakeAdapter: CautioAdapter = {
  mode: "fake",
  async listLeases(): Promise<Lease[]> {
    return copy(leases);
  },
  async getLease(id: string): Promise<Lease | null> {
    const found = leases.find((l) => l.id === id);
    return found ? copy(found) : null;
  },
};
