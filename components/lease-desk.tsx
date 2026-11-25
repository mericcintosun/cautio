"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { DeskEmptyState } from "@/components/desk-states";
import { useReportDeskPhase } from "@/components/diagonal-split";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaseDetail, initFlow, leaseSignature, type Flow } from "@/components/lease-detail";
import { useWallet } from "@/components/wallet-provider";
import { PHASE_LABEL, formatUsdg, shortHex, type Lease, type Phase } from "@/lib/data";
import type { DataSource } from "@/lib/types";
import { readVaultStatus, type VaultStatus } from "@/lib/vault";

const layoutSpring = { type: "spring", stiffness: 420, damping: 38 } as const;

const phaseTone: Record<Phase, "default" | "secondary" | "outline" | "ok" | "warn"> = {
  Active: "outline",
  MoveOut: "warn",
  Itemized: "default",
  Sealed: "secondary",
  Revealed: "secondary",
  Ruled: "default",
  Settled: "ok",
};

/**
 * The lease desk: every deposit an agency holds, one of them open.
 * Signature interaction (K1 #1): a lease cell grows into the detail view through a
 * shared layoutId, and the detail shrinks back into its cell when another lease opens.
 */
export function LeaseDesk({ leases, initialId, source }: { leases: Lease[]; initialId: string; source: DataSource }) {
  const router = useRouter();
  const wallet = useWallet();
  const { setFocus } = wallet;
  const [selectedId, setSelectedId] = useState(initialId);
  const [flows, setFlows] = useState<Record<string, Flow>>(() =>
    Object.fromEntries(leases.map((l) => [l.id, initFlow(l)]))
  );
  const [status, setStatus] = useState<VaultStatus>({ kind: "loading" });
  const [refreshing, startRefresh] = useTransition();
  const signatures = useRef<Record<string, string>>(Object.fromEntries(leases.map((l) => [l.id, leaseSignature(l)])));

  useEffect(() => setSelectedId(initialId), [initialId]);

  // New server props (after "Refresh from chain" or a confirmed tx): a lease whose chain
  // state changed (phase, commits, reveals, award) gets its flow re-derived. Unchanged
  // leases keep their local flow, so simulated progress on seed leases survives a refresh.
  useEffect(() => {
    const changed = leases.filter((l) => signatures.current[l.id] !== leaseSignature(l));
    if (changed.length === 0) return;
    for (const l of changed) signatures.current[l.id] = leaseSignature(l);
    setFlows((f) => {
      const next = { ...f };
      for (const l of changed) next[l.id] = initFlow(l);
      return next;
    });
  }, [leases]);

  // Every confirmed write re-reads the server component, so the desk shows the chain.
  const confirmedHash = wallet.state.kind === "tx-confirmed" ? wallet.state.hash : null;
  useEffect(() => {
    if (confirmedHash) startRefresh(() => router.refresh());
  }, [confirmedHash, router]);

  const refresh = () => startRefresh(() => router.refresh());
  const flowOf = (l: Lease): Flow => flows[l.id] ?? initFlow(l);

  useEffect(() => {
    let alive = true;
    readVaultStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const selected: Lease | null = leases.find((l) => l.id === selectedId) ?? leases[0] ?? null;

  // The diagonal behind the desk (components/diagonal-split.tsx) follows the open lease's phase.
  useReportDeskPhase(selected ? flowOf(selected).phase : null);

  // Tell the header which lease is open, so the wallet button can show this wallet's role.
  useEffect(() => {
    setFocus(
      selected
        ? { tenant: selected.tenant, landlord: selected.landlord, arbiter: selected.arbiter, origin: selected.origin, street: selected.street }
        : null
    );
  }, [selected, setFocus]);
  useEffect(() => () => setFocus(null), [setFocus]);

  const headerProps = { status, source, refreshing, onRefresh: refresh };

  if (!selected) {
    return (
      <div className="space-y-5">
        <DeskHeader {...headerProps} />
        <DeskEmptyState />
      </div>
    );
  }

  const others = leases.filter((l) => l.id !== selected.id);

  function open(id: string) {
    setSelectedId(id);
    router.replace(`/?lease=${id}`, { scroll: false });
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className="space-y-5">
          <DeskHeader {...headerProps} />

          <motion.article key={selected.id} layoutId={`lease-${selected.id}`} transition={layoutSpring}>
            <LeaseDetail
              lease={selected}
              flow={flowOf(selected)}
              onChange={(next) => setFlows((f) => ({ ...f, [selected.id]: next }))}
            />
          </motion.article>

          <section aria-label="Other deposits at the desk" className="space-y-3">
            <h2 className="text-3xl text-foreground">Other deposits at the desk</h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {others.map((l) => (
                <motion.li key={l.id} layoutId={`lease-${l.id}`} layout transition={layoutSpring}>
                  <Button
                    variant="outline"
                    onClick={() => open(l.id)}
                    className="h-auto w-full flex-col items-start gap-1.5 whitespace-normal p-3 text-left normal-case tracking-normal"
                    aria-label={`Open ${l.street}`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        {l.neighborhood}
                      </span>
                      <Badge variant={phaseTone[flowOf(l).phase]}>{PHASE_LABEL[flowOf(l).phase]}</Badge>
                    </span>
                    <span className="font-display text-lg uppercase leading-tight">{l.street}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatUsdg(l.deposit)} · {l.tenant.name} and {l.landlord.name}
                    </span>
                  </Button>
                </motion.li>
              ))}
            </ul>
          </section>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

function DeskHeader({
  status,
  source,
  refreshing,
  onRefresh,
}: {
  status: VaultStatus;
  source: DataSource;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <ChainLine status={status} source={source} />
      </div>
      <div className="flex flex-wrap gap-2 self-start">
        <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? "Refreshing…" : "Refresh from chain"}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/?view=open" scroll={false}>
            Open a new deposit
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ChainLine({ status, source }: { status: VaultStatus; source: DataSource }) {
  const sourceText =
    source.kind === "chain"
      ? `Live: DepositVault ${shortHex(source.vault)} on Arbitrum Sepolia, block ${source.block}`
      : source.reason;

  let text: string;
  if (status.kind === "loading") {
    text = "Reading Arbitrum Sepolia…";
  } else if (status.kind === "offline") {
    text = `Arbitrum Sepolia RPC did not answer from this browser (${status.reason}) Writes are simulated.`;
  } else if (status.vault) {
    text = `Arbitrum Sepolia block ${status.block.toLocaleString("en-US")}. Vault ${shortHex(status.vault)} holds ${String(
      status.leaseCount ?? 0n
    )} leases on chain. With a browser wallet, leases read from the chain sign real transactions, one role per wallet; sample leases stay simulated.`;
  } else {
    text = `Arbitrum Sepolia block ${status.block.toLocaleString("en-US")}, read live. No vault address configured yet, so every write is simulated.`;
  }
  return (
    <div aria-live="polite" className="riso-plate space-y-px border-2 border-l-4 border-border border-l-secondary bg-card px-3 py-2 text-xs text-foreground">
      <p className="font-semibold">{sourceText}</p>
      <p>{text}</p>
    </div>
  );
}
