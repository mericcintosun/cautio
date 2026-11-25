import { zeroHash, type Address, type Hex } from "viem";
import { CHAIN_ID, LOG_PREFIX, USDG_DECIMALS, VAULT_ADDRESS } from "../config";
import { SEED_NOW, leases as seedLeases } from "../data/seed";
import type { Answer, DataSource, DeductionItem, Lease, Phase, SeedOffer } from "../types";
import { depositVaultAbi, publicClient } from "../vault";
import type { CautioAdapter } from "./index";

// Chain-backed reads: DepositVault on Arbitrum Sepolia over the public RPC.
// Human fields (street, names, item labels, notes) are not stored on chain, so they
// are overlaid from the seed lease with the same onchainId when one exists.
// Any RPC failure falls back to the seed leases, so the desk is never empty.

const MAX_LEASES = 50;
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

type LeaseRow = readonly [
  Address, // tenant
  Address, // landlord
  Address, // arbiter
  bigint, // deposit
  bigint, // claimedTotal
  bigint, // acceptedTotal
  bigint, // disputedTotal
  bigint, // landlordAward
  bigint, // window
  bigint, // deadline
  number, // phase
  number, // itemCount
];
type ItemRow = readonly [bigint, Hex, Hex, boolean];
type OfferRow = readonly [Hex, bigint, boolean];

type ChainRead =
  | { ok: true; leases: Lease[]; block: bigint; vault: Address }
  | { ok: false; reason: string };

const copy = <T,>(value: T): T => structuredClone(value);
const usdg = (raw: bigint): number => Number(raw) / 10 ** USDG_DECIMALS;
const shortAddr = (a: Address): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

function toLease(id: number, row: LeaseRow, itemRows: ItemRow[], tenantOffer: OfferRow, landlordOffer: OfferRow): Lease {
  const [tenant, landlord, arbiter, deposit, , , , landlordAward, window, deadline, phaseIndex] = row;
  const seed = seedLeases.find((l) => l.onchainId === id);
  const phase = PHASE_BY_INDEX[phaseIndex] ?? "Active";
  const answered = phaseIndex > ITEMIZED_INDEX;

  const items: DeductionItem[] = itemRows.map(([amount, entryPhoto, exitPhoto, disputed], i) => {
    const seedItem = seed?.items[i];
    const answer: Answer = answered ? (disputed ? "disputed" : "accepted") : "pending";
    return {
      id: seedItem?.id ?? `item-${i + 1}`,
      label: seedItem?.label ?? `Item ${i + 1}`,
      amount: usdg(amount),
      entryNote: seedItem?.entryNote ?? "Move-in photo hash anchored on chain",
      exitNote: seedItem?.exitNote ?? "Move-out photo hash anchored on chain",
      entryPhoto,
      exitPhoto,
      answer,
    };
  });

  // The chain keeps only the commit until a reveal. The salt lives with the party that
  // sealed (localStorage); the seed's salt is reused for overlaid demo leases.
  const offerFor = (row: OfferRow, seedOffer: SeedOffer | null | undefined): SeedOffer | null => {
    const [commit, amount, revealed] = row;
    if (commit === zeroHash) return null;
    if (revealed) return { amount: usdg(amount), salt: seedOffer?.salt ?? zeroHash };
    return seedOffer ? copy(seedOffer) : null;
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
    windowDays: Math.round(Number(window) / 864) / 100,
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
      tenant: offerFor(tenantOffer, seed?.offers.tenant),
      landlord: offerFor(landlordOffer, seed?.offers.landlord),
      opened: tenantOffer[2] && landlordOffer[2],
    },
    landlordAward: phaseIndex >= RULED_INDEX ? usdg(landlordAward) : null,
    note: seed?.note ?? "Read from DepositVault on Arbitrum Sepolia.",
  };
}

async function readChain(vault: Address): Promise<ChainRead> {
  const started = Date.now();
  try {
    const [block, count] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.readContract({ address: vault, abi: depositVaultAbi, functionName: "leaseCount" }),
    ]);
    const n = Math.min(Number(count), MAX_LEASES);
    const ids = Array.from({ length: n }, (_, i) => i + 1);
    if (n === 0) {
      console.info(`${LOG_PREFIX} chain read leases=0 ms=${Date.now() - started}`);
      return { ok: false, reason: "Sample data: DepositVault holds no leases yet" };
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

    // itemCount is capped at MAX_ITEMS = 16 by the contract.
    const itemCalls = ids.flatMap((id, k) =>
      Array.from({ length: Number(rows[k][11]) }, (_, i) => ({
        address: vault,
        abi: depositVaultAbi,
        functionName: "items" as const,
        args: [BigInt(id), BigInt(i)] as const,
      }))
    );
    const offerCalls = ids.flatMap((id, k) =>
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
      publicClient.multicall({ allowFailure: false, contracts: offerCalls }) as unknown as Promise<OfferRow[]>,
    ]);

    let cursor = 0;
    const leases = ids.map((id, k) => {
      const count = Number(rows[k][11]);
      const items = itemResults.slice(cursor, cursor + count);
      cursor += count;
      return toLease(id, rows[k], items, offerResults[2 * k], offerResults[2 * k + 1]);
    });

    console.info(`${LOG_PREFIX} chain read leases=${leases.length} ms=${Date.now() - started}`);
    return { ok: true, leases, block, vault };
  } catch {
    console.warn(`${LOG_PREFIX} chain read failed ms=${Date.now() - started}`);
    return { ok: false, reason: "Sample data: Arbitrum Sepolia RPC did not answer" };
  }
}

// One chain read serves listLeases, getLease and describe within the same render.
let memo: { at: number; read: Promise<ChainRead> } | null = null;

function current(): Promise<ChainRead> {
  if (!VAULT_ADDRESS) {
    return Promise.resolve<ChainRead>({ ok: false, reason: "Sample data: DepositVault address is not configured" });
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
