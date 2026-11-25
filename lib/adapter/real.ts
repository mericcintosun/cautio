import { zeroHash, type Address, type Hex } from "viem";
import { CHAIN_ID, LOG_PREFIX, USDG_DECIMALS, VAULT_ADDRESS } from "../config";
import { SEED_NOW, leases as seedLeases } from "../data/seed";
import type { Answer, DataSource, DeductionItem, Lease, Phase, SeedOffer } from "../types";
import { depositVaultAbi, publicClient } from "../vault";
import type { CautioAdapter } from "./index";

// Chain-backed reads: DepositVault on Arbitrum Sepolia over the public RPC.
//
// The chain is append-only, so `npm run demo:reset` cannot rewind a lease; it opens fresh
// ones (contracts/script/SeedDemo.s.sol). DEMO_ANCHORS recognizes those leases by a
// fingerprint on the raw lease row, and the NEWEST matching id wins. Anchors get the seed
// lease's human labels (street, names, item labels) and origin "chain", so their writes are
// real. Chain leases without an anchor show as "Lease #N" only when their id is above the
// newest anchor id (for example the lease opened in demo step 1); older ones, such as the
// Smoke lease #1 and every earlier reset cycle, are hidden, so each cycle shows the same desk.
// The other seed leases render from the seed with onchainId 0, so their writes stay simulated.
// Any RPC failure falls back to the seed leases, so the desk is never empty.

/** How many of the newest lease ids one read looks at. */
const MAX_LEASES = 24;
const MEMO_MS = 5000;

/** DepositVault.Phase indices 1..7, in contract order. 0 (None) never appears for a real id. */
const PHASE_BY_INDEX: Record<number, Phase> = {
  1: "Active",
  2: "MoveOut",
  3: "Itemized",
  4: "Sealed",
  5: "Revealed",
  6: "Ruled",
  7: "Settled",
};
const ITEMIZED_INDEX = 3;
const RULED_INDEX = 6;

export type LeaseRow = readonly [
  Address, // 0 tenant
  Address, // 1 landlord
  Address, // 2 arbiter
  bigint, // 3 deposit
  bigint, // 4 claimedTotal
  bigint, // 5 acceptedTotal
  bigint, // 6 disputedTotal
  bigint, // 7 landlordAward
  bigint, // 8 window
  bigint, // 9 deadline
  number, // 10 phase
  number, // 11 itemCount
];
type ItemRow = readonly [bigint, Hex, Hex, boolean];
type OfferRow = readonly [Hex, bigint, boolean];

export interface DemoAnchor {
  seedId: string;
  /** True for the lease rows SeedDemo.s.sol opens for this seed lease. Fields never change over the flow. */
  match: (row: LeaseRow) => boolean;
  /**
   * SeedDemo.s.sol opens this anchor right before the named one, in the same broadcast, so
   * its id is exactly one below. Pinning it this way keeps a live lease with the same numbers
   * (DEMO step 6 lists 400 and 900 on the step 1 lease) from taking over the anchor.
   */
  idBefore?: string;
}

/** Keep in step with contracts/script/SeedDemo.s.sol and the demo-state block in scripts/proof.mjs. */
export const DEMO_ANCHORS: readonly DemoAnchor[] = [
  {
    seedId: "rua-harmonia-302",
    match: (r) => r[3] === 3_000_000_000n && r[11] === 2 && r[4] === 1_300_000_000n,
    idBefore: "alameda-santos-1140",
  },
  {
    seedId: "alameda-santos-1140",
    match: (r) => r[3] === 3_600_000_000n && r[11] === 0 && r[8] === 60n,
  },
];

type ChainRead =
  | { ok: true; leases: Lease[]; block: bigint; vault: Address }
  | { ok: false; reason: string };

const copy = <T,>(value: T): T => structuredClone(value);
const usdg = (raw: bigint): number => Number(raw) / 10 ** USDG_DECIMALS;
const shortAddr = (a: Address): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

function toLease(id: number, row: LeaseRow, itemRows: ItemRow[], tenantOffer: OfferRow, landlordOffer: OfferRow, seed: Lease | null): Lease {
  const [tenant, landlord, arbiter, deposit, , , , landlordAward, window, deadline, phaseIndex] = row;
  const phase = PHASE_BY_INDEX[phaseIndex] ?? "Active";
  const answered = phaseIndex > ITEMIZED_INDEX;

  const items: DeductionItem[] = itemRows.map(([amount, entryPhoto, exitPhoto, disputed], i) => {
    const seedItem = seed?.items[i];
    const answer: Answer = answered ? (disputed ? "disputed" : "accepted") : "pending";
    return {
      id: seedItem?.id ?? `item-${i + 1}`,
      // The chain stores no labels: a line listed live reads back as "Line N".
      label: seedItem?.label ?? `Line ${i + 1}`,
      amount: usdg(amount),
      entryNote: seedItem?.entryNote ?? "Move-in photo hash anchored on chain",
      exitNote: seedItem?.exitNote ?? "Move-out photo hash anchored on chain",
      entryPhoto,
      exitPhoto,
      answer,
    };
  });

  // The chain keeps only the commit until a reveal. The amount and salt live with the
  // party that sealed (browser localStorage), so an unrevealed offer carries the commit only.
  const offerFor = (r: OfferRow): SeedOffer | null => {
    const [commit, amount, revealed] = r;
    if (commit === zeroHash) return null;
    return { amount: revealed ? usdg(amount) : 0, salt: zeroHash, commit, revealed };
  };

  const depositUsdg = usdg(deposit);
  return {
    id: seed?.id ?? `lease-${id}`,
    onchainId: id,
    street: seed?.street ?? `Lease #${id}`,
    neighborhood: seed?.neighborhood ?? "Arbitrum Sepolia",
    monthlyRent: seed?.monthlyRent ?? Math.round((depositUsdg / 3) * 100) / 100,
    deposit: depositUsdg,
    openedOn: seed?.openedOn ?? SEED_NOW.slice(0, 10),
    moveOutOn: seed?.moveOutOn ?? null,
    phase,
    // Unrounded, so a 60 second demo window stays 60 seconds (lease-detail formats it).
    windowDays: Number(window) / 86_400,
    deadline: deadline === 0n ? null : new Date(Number(deadline) * 1000).toISOString(),
    tenant: { name: seed?.tenant.name ?? `Tenant ${shortAddr(tenant)}`, address: tenant },
    landlord: { name: seed?.landlord.name ?? `Landlord ${shortAddr(landlord)}`, address: landlord },
    arbiter: {
      name: seed?.arbiter.name ?? `Arbiter ${shortAddr(arbiter)}`,
      agency: seed?.arbiter.agency ?? "named on chain",
      address: arbiter,
    },
    items,
    offers: {
      tenant: offerFor(tenantOffer),
      landlord: offerFor(landlordOffer),
      opened: tenantOffer[2] && landlordOffer[2],
    },
    landlordAward: phaseIndex >= RULED_INDEX ? usdg(landlordAward) : null,
    note: seed?.note ?? "Read from DepositVault on Arbitrum Sepolia.",
    origin: "chain",
  };
}

/**
 * For each anchor, the newest id whose row matches its fingerprint.
 * `ids` must be in descending order.
 */
export function resolveAnchors(ids: number[], rows: LeaseRow[]): Map<string, number> {
  const found = new Map<string, number>();
  const newestMatch = (anchor: DemoAnchor): number | undefined => {
    const k = ids.findIndex((_, i) => anchor.match(rows[i]));
    return k === -1 ? undefined : ids[k];
  };
  // Free anchors first, then the ones pinned one id below another anchor.
  for (const anchor of DEMO_ANCHORS) {
    if (anchor.idBefore) continue;
    const id = newestMatch(anchor);
    if (id !== undefined) found.set(anchor.seedId, id);
  }
  for (const anchor of DEMO_ANCHORS) {
    if (!anchor.idBefore) continue;
    const next = found.get(anchor.idBefore);
    if (next === undefined) {
      const id = newestMatch(anchor);
      if (id !== undefined) found.set(anchor.seedId, id);
      continue;
    }
    const k = ids.indexOf(next - 1);
    if (k !== -1 && anchor.match(rows[k])) found.set(anchor.seedId, next - 1);
  }
  return found;
}

async function readChain(vault: Address): Promise<ChainRead> {
  const started = Date.now();
  try {
    const [block, count] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.readContract({ address: vault, abi: depositVaultAbi, functionName: "leaseCount" }),
    ]);
    const newest = Number(count);
    const n = Math.min(newest, MAX_LEASES);
    // Newest first: leaseCount, leaseCount - 1, ...
    const ids = Array.from({ length: n }, (_, i) => newest - i);
    if (n === 0) {
      console.info(`${LOG_PREFIX} chain read leases=0 ms=${Date.now() - started}`);
      return { ok: false, reason: "Sample leases shown: DepositVault holds no leases yet" };
    }

    const rows = (await publicClient.multicall({
      allowFailure: false,
      contracts: ids.map((id) => ({
        address: vault,
        abi: depositVaultAbi,
        functionName: "leases" as const,
        args: [BigInt(id)] as const,
      })),
    })) as unknown as LeaseRow[];

    const anchors = resolveAnchors(ids, rows);
    const newestAnchorId = Math.max(0, ...anchors.values());
    const anchoredIds = new Set(anchors.values());
    // Only anchors and leases newer than the newest anchor are shown, so only they are read further.
    const shown = ids.map((id, k) => ({ id, k })).filter(({ id }) => anchoredIds.has(id) || id > newestAnchorId);

    // itemCount is capped at MAX_ITEMS = 16 by the contract.
    const itemCalls = shown.flatMap(({ id, k }) =>
      Array.from({ length: Number(rows[k][11]) }, (_, i) => ({
        address: vault,
        abi: depositVaultAbi,
        functionName: "items" as const,
        args: [BigInt(id), BigInt(i)] as const,
      }))
    );
    const offerCalls = shown.flatMap(({ id, k }) =>
      [rows[k][0], rows[k][1]].map((party) => ({
        address: vault,
        abi: depositVaultAbi,
        functionName: "offers" as const,
        args: [BigInt(id), party] as const,
      }))
    );
    const [itemResults, offerResults] = await Promise.all([
      itemCalls.length > 0
        ? (publicClient.multicall({ allowFailure: false, contracts: itemCalls }) as unknown as Promise<ItemRow[]>)
        : Promise.resolve([] as ItemRow[]),
      offerCalls.length > 0
        ? (publicClient.multicall({ allowFailure: false, contracts: offerCalls }) as unknown as Promise<OfferRow[]>)
        : Promise.resolve([] as OfferRow[]),
    ]);

    const byId = new Map<number, Lease>();
    let cursor = 0;
    shown.forEach(({ id, k }, j) => {
      const itemCount = Number(rows[k][11]);
      const items = itemResults.slice(cursor, cursor + itemCount);
      cursor += itemCount;
      const seedId = [...anchors.entries()].find(([, anchorId]) => anchorId === id)?.[0];
      const seed = seedId ? (seedLeases.find((l) => l.id === seedId) ?? null) : null;
      byId.set(id, toLease(id, rows[k], items, offerResults[2 * j], offerResults[2 * j + 1], seed));
    });

    // Seed order first: anchored leases from the chain, the rest from the seed with
    // onchainId 0 (simulated writes). Then any newer chain lease, newest first.
    const desk: Lease[] = seedLeases.map((s) => {
      const anchorId = anchors.get(s.id);
      const fromChain = anchorId !== undefined ? byId.get(anchorId) : undefined;
      return fromChain ?? { ...copy(s), onchainId: 0, origin: "seed" as const };
    });
    for (const { id } of shown) {
      if (!anchoredIds.has(id)) {
        const lease = byId.get(id);
        if (lease) desk.push(lease);
      }
    }

    console.info(
      `${LOG_PREFIX} chain read leases=${shown.length} anchors=${anchors.size} newestAnchor=${newestAnchorId} ms=${Date.now() - started}`
    );
    return { ok: true, leases: desk, block, vault };
  } catch {
    console.warn(`${LOG_PREFIX} chain read failed ms=${Date.now() - started}`);
    return { ok: false, reason: "Sample leases shown: Arbitrum Sepolia did not answer this read" };
  }
}

// One chain read serves listLeases, getLease and describe within the same render.
let memo: { at: number; read: Promise<ChainRead> } | null = null;

function current(): Promise<ChainRead> {
  if (!VAULT_ADDRESS) {
    return Promise.resolve<ChainRead>({ ok: false, reason: "Sample leases shown: DepositVault is not deployed in this build yet" });
  }
  const now = Date.now();
  if (!memo || now - memo.at > MEMO_MS) {
    memo = { at: now, read: readChain(VAULT_ADDRESS) };
  }
  return memo.read;
}

export const realAdapter: CautioAdapter = {
  mode: "real",
  async listLeases(): Promise<Lease[]> {
    const read = await current();
    return copy(read.ok ? read.leases : seedLeases);
  },
  async getLease(id: string): Promise<Lease | null> {
    const read = await current();
    const found = (read.ok ? read.leases : seedLeases).find((l) => l.id === id);
    return found ? copy(found) : null;
  },
  async describe(): Promise<DataSource> {
    const read = await current();
    if (!read.ok) return { kind: "seed", reason: read.reason };
    return { kind: "chain", chainId: CHAIN_ID, vault: read.vault, block: read.block.toString() };
  },
};
