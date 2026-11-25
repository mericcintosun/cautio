"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaseDetail, initFlow, type Flow } from "@/components/lease-detail";
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
  const [selectedId, setSelectedId] = useState(initialId);
  const [flows, setFlows] = useState<Record<string, Flow>>(() =>
    Object.fromEntries(leases.map((l) => [l.id, initFlow(l)]))
  );
  const [status, setStatus] = useState<VaultStatus>({ kind: "loading" });

  useEffect(() => setSelectedId(initialId), [initialId]);

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

  if (!selected) {
    return (
      <div className="space-y-5">
        <DeskHeader status={status} source={source} />
        <div className="cautio-enter space-y-3 rounded-sm border-2 border-border bg-background p-6">
          <h2 className="text-3xl text-foreground">No deposits at the desk yet</h2>
          <p className="max-w-[52ch] text-sm text-muted-foreground">
            Lock the first one: the tenant deposits three months of rent in USDG, and neither side can move it alone.
          </p>
          <Button asChild>
            <Link href="/?view=open">Open a new deposit</Link>
          </Button>
        </div>
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
          <DeskHeader status={status} source={source} />

          <motion.article key={selected.id} layoutId={`lease-${selected.id}`} transition={layoutSpring}>
            <LeaseDetail
              lease={selected}
              flow={flows[selected.id]}
              onChange={(next) => setFlows((f) => ({ ...f, [selected.id]: next }))}
            />
          </motion.article>

          <section aria-label="Other deposits at the desk" className="space-y-3">
            <h2 className="text-2xl text-foreground">Other deposits at the desk</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <Badge variant={phaseTone[flows[l.id].phase]}>{PHASE_LABEL[flows[l.id].phase]}</Badge>
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

function DeskHeader({ status, source }: { status: VaultStatus; source: DataSource }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <ChainLine status={status} source={source} />
      </div>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/?view=open" scroll={false}>
          Open a new deposit
        </Link>
      </Button>
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
    )} leases on chain. With a browser wallet, every button below signs a real transaction.`;
  } else {
    text = `Arbitrum Sepolia block ${status.block.toLocaleString("en-US")}, read live. No vault address configured yet, so every write is simulated.`;
  }
  return (
    <div aria-live="polite" className="space-y-px border-l-4 border-secondary bg-background px-3 py-2 text-xs text-foreground">
      <p className="font-semibold">{sourceText}</p>
      <p>{text}</p>
    </div>
  );
}
