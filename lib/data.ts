// Compatibility barrel. Types live in lib/types.ts, the seed leases in lib/data/seed.ts.
// Every existing `@/lib/data` import keeps working. Pages read leases through
// `getAdapter()` in lib/adapter; components may still import helpers from here.

import type { Answer, DeductionItem, Phase } from "./types";

export * from "./types";
export * from "./data/seed";

export const PHASES: Phase[] = ["Active", "MoveOut", "Itemized", "Sealed", "Revealed", "Ruled", "Settled"];

export const PHASE_LABEL: Record<Phase, string> = {
  Active: "Lease active",
  MoveOut: "Move-out",
  Itemized: "Items listed",
  Sealed: "Offers sealing",
  Revealed: "Offers open",
  Ruled: "Ruled",
  Settled: "Settled",
};

export function formatUsdg(n: number): string {
  return `${n.toLocaleString("en-US")} USDG`;
}

export function shortHex(h: string, head = 6, tail = 4): string {
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function totalsFor(items: DeductionItem[], answers: Record<string, Answer>) {
  let accepted = 0;
  let disputed = 0;
  let pending = 0;
  let claimed = 0;
  for (const it of items) {
    const a = answers[it.id] ?? it.answer;
    claimed += it.amount;
    if (a === "accepted") accepted += it.amount;
    else if (a === "disputed") disputed += it.amount;
    else pending += 1;
  }
  return { accepted, disputed, pending, claimed };
}
