"use client";

import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import { zeroHash, type Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { ShortHex } from "@/components/ui/address";
import { OfferRail } from "@/components/offer-rail";
import { SceneSlot } from "@/components/scene-slot";
import { TxIntent } from "@/components/tx-intent";
import { TxStatus } from "@/components/tx-status";
import { useWallet } from "@/components/wallet-provider";
import {
  PHASES,
  PHASE_LABEL,
  SEED_NOW,
  formatDate,
  formatUsdg,
  shortHex,
  totalsFor,
  type Answer,
  type DeductionItem,
  type Lease,
  type Phase,
  type Side,
} from "@/lib/data";
import { EXPLORER, newSalt, offerCommit, recallSalt, rememberSalt, sha256Hex, type VaultWrite } from "@/lib/vault";
import { accountOf, roleOf, type Role } from "@/lib/wallet-state";
import { cn } from "@/lib/utils";

export interface SealedOffer {
  amount: number;
  salt: Hex;
  commit: Hex;
  /** This side has revealed (on chain, or in the simulated flow). */
  revealed: boolean;
  /** Amount and salt are known in this browser. False for a chain offer sealed elsewhere and not yet revealed. */
  known: boolean;
}

/** One deduction the landlord added in this browser session. The label never goes on chain. */
export interface ListedLine {
  /** Position in the lease's item list (the contract's item index). */
  index: number;
  label: string;
  amount: number;
  entryPhoto: Hex;
  exitPhoto: Hex;
}

/** Local mirror of one lease's on-chain state, advanced after each confirmed or simulated write. */
export interface Flow {
  phase: Phase;
  answers: Record<string, Answer>;
  clockRunOut: boolean;
  offers: Record<Side, SealedOffer | null>;
  opened: boolean;
  award: number | null;
  /** Lines added with addItem in this session, with their local labels. */
  listed: ListedLine[];
}

/** Mirrors MAX_ITEMS in DepositVault.sol, so the form stops before the vault would revert. */
const MAX_ITEMS = 16;

/** MOTION M5: opacity only, linear, 280ms, no transform. */
const FADE_TRANSITION = { duration: 0.28, ease: "linear" } as const;
const PHASE_FADE: Variants = {
  hidden: { opacity: 0, transition: FADE_TRANSITION },
  shown: { opacity: 1, transition: FADE_TRANSITION },
};
const ROW_LIST: Variants = {
  hidden: { opacity: 1 },
  shown: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const ROW_FADE: Variants = {
  hidden: { opacity: 0, transition: FADE_TRANSITION },
  shown: { opacity: 1, transition: FADE_TRANSITION },
};

/**
 * The lease's items, read from the chain or the seed, merged with the lines listed in this
 * session by index. A line listed here keeps its local label; a chain line without one
 * reads "Line N" (lib/adapter/real.ts).
 */
function itemsFor(lease: Lease, flow: Flow): DeductionItem[] {
  const byIndex = new Map<number, DeductionItem>();
  lease.items.forEach((it, i) => byIndex.set(i, it));
  for (const line of flow.listed) {
    const chain = byIndex.get(line.index);
    byIndex.set(
      line.index,
      chain
        ? { ...chain, label: line.label || chain.label }
        : {
            id: `listed-${line.index}`,
            label: line.label || `Line ${line.index + 1}`,
            amount: line.amount,
            entryNote: "Move-in photo, hashed in this browser",
            exitNote: "Move-out photo, hashed in this browser",
            entryPhoto: line.entryPhoto,
            exitPhoto: line.exitPhoto,
            answer: "pending",
          }
    );
  }
  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, it]) => it);
}

function sealFor(lease: Lease, side: Side, amount: number, salt: Hex): SealedOffer {
  return { amount, salt, commit: offerCommit(lease.onchainId, lease[side].address, amount, salt), revealed: false, known: true };
}

/** Where rememberSalt keeps this lease's salts. Chain leases key by on-chain id, so a reset cycle never reads an old salt. */
function saltKey(lease: Lease): string {
  return lease.origin === "chain" ? `chain-${lease.onchainId}` : lease.id;
}

/** Seed leases judge deadlines against the seed clock; chain leases against the real clock. */
function deadlinePassed(lease: Lease): boolean {
  if (lease.deadline === null) return false;
  const now = lease.origin === "chain" ? Date.now() : Date.parse(SEED_NOW);
  return Date.parse(lease.deadline) < now;
}

function windowText(lease: Lease): string {
  return lease.windowDays >= 1 ? `${Math.round(lease.windowDays * 100) / 100} day` : `${Math.round(lease.windowDays * 86_400)} second`;
}

function deadlineText(lease: Lease): string {
  if (!lease.deadline) return `${windowText(lease)}s after move-out`;
  if (lease.origin !== "chain") return formatDate(lease.deadline);
  const d = new Date(lease.deadline);
  return `${formatDate(lease.deadline)}, ${d.toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC`;
}

export function initFlow(lease: Lease): Flow {
  const { opened } = lease.offers;
  const fromLease = (side: Side): SealedOffer | null => {
    const o = lease.offers[side];
    if (!o) return null;
    // Chain offer: the commit is the truth; amount and salt are known only once revealed.
    if (o.commit) return { amount: o.amount, salt: o.salt, commit: o.commit, revealed: !!o.revealed, known: !!o.revealed };
    return { ...sealFor(lease, side, o.amount, o.salt), revealed: opened };
  };
  return {
    phase: lease.phase,
    answers: Object.fromEntries(lease.items.map((i) => [i.id, i.answer])),
    clockRunOut: deadlinePassed(lease),
    offers: { landlord: fromLease("landlord"), tenant: fromLease("tenant") },
    opened,
    award: lease.landlordAward,
    listed: [],
  };
}

/** Changes whenever the chain state that drives the flow changes: phase, commits, reveals, award. */
export function leaseSignature(lease: Lease): string {
  const o = (side: Side) => {
    const offer = lease.offers[side];
    return offer ? `${offer.commit ?? offer.amount}:${offer.revealed ? 1 : 0}` : "-";
  };
  return [lease.onchainId, lease.phase, o("landlord"), o("tenant"), lease.offers.opened ? 1 : 0, lease.landlordAward ?? "-"].join("|");
}

/**
 * sim: every button in one window (seed lease, no wallet or no vault address).
 * real: a chain lease and a connected wallet; each action shows only for its role.
 * connect: a chain lease and a wallet that has not connected yet.
 */
type Mode = "sim" | "real" | "connect";

interface Ctx {
  lease: Lease;
  mode: Mode;
  role: Role;
  pending: boolean;
  connect: () => Promise<void>;
  /** itemsFor(lease, flow): chain or seed items plus lines listed in this session. */
  items: DeductionItem[];
}

type FollowUp = readonly [VaultWrite, readonly unknown[]];
/** Resolves true once every call went through and the flow advanced, false otherwise. */
type Act = (label: string, fn: VaultWrite, args: readonly unknown[], next: Partial<Flow>, then?: FollowUp[]) => Promise<boolean>;

export function LeaseDetail({ lease, flow, onChange }: { lease: Lease; flow: Flow; onChange: (next: Flow) => void }) {
  const wallet = useWallet();
  const [note, setNote] = useState<string | null>(null);
  const items = itemsFor(lease, flow);
  const totals = totalsFor(items, flow.answers);
  const pending = wallet.state.kind === "tx-pending";
  const account = accountOf(wallet.state);
  const mode: Mode = lease.origin === "chain" && wallet.canSign ? (account ? "real" : "connect") : "sim";
  const ctx: Ctx = { lease, mode, role: roleOf(lease, account), pending, connect: wallet.connect, items };

  // Sends one vault write, or a short sequence (both reveals, or resolveTimeout then settle),
  // through the wallet state machine. The flow only advances once every call has gone through.
  async function act(label: string, fn: VaultWrite, args: readonly unknown[], next: Partial<Flow>, then: FollowUp[] = []) {
    setNote(null);
    const tx = await wallet.send(label, fn, lease.onchainId, args, lease.origin);
    if (!tx) return false;
    for (const [nextFn, nextArgs] of then) {
      const more = await wallet.send(`${label} · ${nextFn}`, nextFn, lease.onchainId, nextArgs, lease.origin);
      if (!more) return false;
    }
    onChange({ ...flow, ...next });
    return true;
  }

  const showItems = items.length > 0 && flow.phase !== "Active" && flow.phase !== "MoveOut";
  const canAnswer = flow.phase === "Itemized" && !pending && (mode === "sim" || (mode === "real" && ctx.role === "tenant"));

  return (
    <Card className="bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-border p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {lease.neighborhood}, São Paulo · {lease.onchainId > 0 ? `lease #${lease.onchainId}` : "sample lease"}
            {lease.origin === "chain" ? " · on chain" : ""}
          </p>
          <h2 className="text-3xl sm:text-4xl">{lease.street}</h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">{lease.note}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl leading-none">{formatUsdg(lease.deposit)}</p>
          <p className="text-xs text-muted-foreground">
            {flow.phase === "Settled" ? "paid out" : "locked in the vault"} · 3 × {formatUsdg(lease.monthlyRent)} rent
          </p>
        </div>
      </div>

      <dl className="grid gap-px border-b-2 border-border bg-border text-sm md:grid-cols-3">
        <PartyCell role="Tenant" name={lease.tenant.name} address={lease.tenant.address} you={mode === "real" && ctx.role === "tenant"} />
        <PartyCell role="Landlord" name={lease.landlord.name} address={lease.landlord.address} you={mode === "real" && ctx.role === "landlord"} />
        <PartyCell
          role={`Arbiter, ${lease.arbiter.agency}`}
          name={lease.arbiter.name}
          address={lease.arbiter.address}
          you={mode === "real" && ctx.role === "arbiter"}
        />
      </dl>

      <ol aria-label="Deposit phase" className="flex flex-wrap gap-1 border-b-2 border-border px-5 py-3 text-[0.7rem] font-semibold uppercase tracking-wider">
        {PHASES.map((p) => {
          const current = p === flow.phase;
          const done = PHASES.indexOf(p) < PHASES.indexOf(flow.phase);
          return (
            <li
              key={p}
              aria-current={current ? "step" : undefined}
              className={cn(
                "rounded-sm border-2 px-2 py-0.5",
                current ? "border-foreground bg-primary text-primary-foreground" : done ? "border-foreground bg-muted" : "border-muted text-muted-foreground"
              )}
            >
              {PHASE_LABEL[p]}
            </li>
          );
        })}
      </ol>

      <MotionConfig reducedMotion="user">
        <div className="space-y-5 p-5">
          {/* K1 #3: the list staggers in when it appears (after "Send the list"); initial={false}
              keeps the server HTML and the first paint fully visible. */}
          <AnimatePresence initial={false}>
            {showItems && (
              <motion.section
                key="deductions"
                aria-label="Deductions"
                className="space-y-3"
                variants={ROW_LIST}
                initial="hidden"
                animate="shown"
                exit="hidden"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl uppercase">Deductions, item by item</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatUsdg(totals.claimed)} claimed of {formatUsdg(lease.deposit)}
                  </p>
                </div>
                <motion.ul className="space-y-3" variants={ROW_LIST}>
                  {items.map((it) => (
                    <DeductionRow
                      key={it.id}
                      item={it}
                      answer={flow.answers[it.id] ?? it.answer}
                      editable={canAnswer}
                      pending={pending}
                      onAnswer={(a) => onChange({ ...flow, answers: { ...flow.answers, [it.id]: a } })}
                    />
                  ))}
                </motion.ul>
              </motion.section>
            )}
          </AnimatePresence>

          {/* K1 #3: each phase exits before the next enters, opacity only (M5). */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={flow.phase} variants={PHASE_FADE} initial="hidden" animate="shown" exit="hidden">
              <PhaseBody ctx={ctx} flow={flow} totals={totals} act={act} onChange={onChange} setNote={setNote} />
            </motion.div>
          </AnimatePresence>

          {note && (
            <p role="alert" className="rounded-sm border-2 border-destructive bg-background px-3 py-2 text-sm text-destructive">
              {note}
            </p>
          )}

          <TxStatus state={wallet.state} />
        </div>
      </MotionConfig>
    </Card>
  );
}

function PartyCell({ role, name, address, you }: { role: string; name: string; address: string; you: boolean }) {
  return (
    <div className="min-w-0 bg-background px-5 py-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {role}
        {you && (
          <Badge variant="secondary" className="ml-2 align-middle">
            You
          </Badge>
        )}
      </dt>
      <dd className="font-semibold">{name}</dd>
      <dd className="min-w-0 text-xs text-muted-foreground">
        <ShortHex value={address} href={`${EXPLORER}/address/${address}`} />
      </dd>
    </div>
  );
}

const ROLE_WORD: Record<Exclude<Role, "viewer">, string> = { tenant: "tenant", landlord: "landlord", arbiter: "arbiter" };

/**
 * Shows its children only to the wallet this step needs. Simulated mode shows everything
 * in one window. A wrong role sees one line naming who the step waits for.
 */
function Gate({ ctx, need, children }: { ctx: Ctx; need: Exclude<Role, "viewer">[] | "anyone"; children: ReactNode }) {
  if (ctx.mode === "sim" || need === "anyone") return <>{children}</>;
  const who = need[0];
  const name = ctx.lease[who].name;
  if (ctx.mode === "connect") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">Connect the wallet of {name} ({ROLE_WORD[who]}) to act on this lease.</p>
        <Button size="sm" variant="outline" disabled={ctx.pending} onClick={() => void ctx.connect()}>
          Connect wallet
        </Button>
      </div>
    );
  }
  if (ctx.role !== "viewer" && need.includes(ctx.role)) return <>{children}</>;
  return (
    <p className="text-sm font-semibold">
      Waiting for {name} ({ROLE_WORD[who]})
    </p>
  );
}

function PhaseBody({
  ctx,
  flow,
  totals,
  act,
  onChange,
  setNote,
}: {
  ctx: Ctx;
  flow: Flow;
  totals: ReturnType<typeof totalsFor>;
  act: Act;
  onChange: (next: Flow) => void;
  setNote: (note: string | null) => void;
}) {
  const { lease, pending } = ctx;
  switch (flow.phase) {
    case "Active":
      return (
        <Step title="Deposit locked" hint={`Opened ${formatDate(lease.openedOn)}. Neither ${lease.tenant.name} nor ${lease.landlord.name} can move it alone.`}>
          <Gate ctx={ctx} need={["tenant", "landlord"]}>
            <WithIntent ctx={ctx} fn="startMoveOut">
              <Button variant="outline" disabled={pending} onClick={() => act("startMoveOut", "startMoveOut", [], { phase: "MoveOut", clockRunOut: false })}>
                {pending ? "Sending…" : "Start move-out"}
              </Button>
            </WithIntent>
          </Gate>
        </Step>
      );

    case "MoveOut": {
      if (flow.clockRunOut) {
        return (
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
            <Step
              title="The landlord stayed silent"
              hint={`${lease.landlord.name} listed no deductions inside the ${windowText(lease)} window, so the whole deposit opens to ${lease.tenant.name}.`}
            >
              <Gate ctx={ctx} need="anyone">
                <WithIntent ctx={ctx} fn="resolveTimeout">
                  <Button
                    disabled={pending}
                    onClick={() => act("resolveTimeout, then settle", "resolveTimeout", [], { phase: "Settled", award: 0 }, [["settle", []]])}
                  >
                    {pending ? "Sending…" : `Claim full refund of ${formatUsdg(lease.deposit)}`}
                  </Button>
                </WithIntent>
              </Gate>
            </Step>
            <SceneSlot n={5} alt="An empty clipboard with no lines on it beside a moving box receiving a full stack of blue bills" width={600} height={600} className="hidden max-w-56 border-2 border-border md:block" />
          </div>
        );
      }
      const isLandlord = ctx.mode === "sim" || (ctx.mode === "real" && ctx.role === "landlord");
      return (
        <div className="space-y-4">
          <Step
            title="Waiting for the landlord's list"
            hint={`${lease.landlord.name} has until ${deadlineText(lease)} to list deductions with photos. Silence means a full refund.`}
          >
            {lease.origin === "chain" ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  const passed = deadlinePassed(lease);
                  setNote(passed ? null : `The window is still open until ${deadlineText(lease)}. Check again after that.`);
                  onChange({ ...flow, clockRunOut: passed });
                }}
              >
                Check the window again
              </Button>
            ) : (
              <Button variant="outline" disabled={pending} onClick={() => onChange({ ...flow, clockRunOut: true })}>
                Demo timeout mode: run the clock out
              </Button>
            )}
          </Step>
          {(isLandlord || ctx.mode === "connect") && (
            <Gate ctx={ctx} need={["landlord"]}>
              <ListingForm ctx={ctx} flow={flow} act={act} />
            </Gate>
          )}
        </div>
      );
    }

    case "Itemized": {
      const mask = ctx.items.reduce((m, it, i) => ((flow.answers[it.id] ?? it.answer) === "disputed" ? m | (1n << BigInt(i)) : m), 0n);
      const ready = totals.pending === 0;
      return (
        <Step
          title={`${lease.tenant.name} answers each item`}
          hint={
            ready
              ? `Accepting ${formatUsdg(totals.accepted)}, disputing ${formatUsdg(totals.disputed)}. Disputed items go to sealed final offers.`
              : `Accept or dispute every line above. ${totals.pending} still open. Try: accept the window, dispute the paint.`
          }
        >
          <Gate ctx={ctx} need={["tenant"]}>
            <WithIntent ctx={ctx} fn="respond" amount={totals.accepted}>
              <Button
                variant="secondary"
                disabled={!ready || pending}
                onClick={() =>
                  act("respond", "respond", [mask], totals.disputed > 0 ? { phase: "Sealed" } : { phase: "Ruled", award: totals.accepted })
                }
              >
                {pending ? "Sending…" : "Send answers to the vault"}
              </Button>
            </WithIntent>
          </Gate>
        </Step>
      );
    }

    case "Sealed":
    case "Revealed":
      return <FinalOffers ctx={ctx} flow={flow} totals={totals} act={act} setNote={setNote} />;

    case "Ruled":
      return (
        <Step
          title="Ruling recorded"
          hint={`${formatUsdg(flow.award ?? 0)} goes to ${lease.landlord.name}, ${formatUsdg(lease.deposit - (flow.award ?? 0))} back to ${lease.tenant.name}. One call pays both, and anyone may send it.`}
        >
          <Gate ctx={ctx} need="anyone">
            <WithIntent ctx={ctx} fn="settle" amount={flow.award ?? 0}>
              <Button disabled={pending} onClick={() => act("settle", "settle", [], { phase: "Settled" })}>
                {pending ? "Settling…" : "Settle in one transaction"}
              </Button>
            </WithIntent>
          </Gate>
        </Step>
      );

    case "Settled":
      return <Payout lease={lease} award={flow.award ?? 0} />;
  }
}

/** The plain-language line for a write (TxIntent), directly above its send button. */
function WithIntent({ ctx, fn, amount, children }: { ctx: Ctx; fn: VaultWrite; amount?: number; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-md flex-col items-start gap-2">
      <TxIntent fn={fn} street={ctx.lease.street} deposit={ctx.lease.deposit} amount={amount} origin={ctx.lease.origin} />
      {children}
    </div>
  );
}

type ListingProblem = string | null;

/**
 * DEMO step 6: the landlord lists deductions live. Each line is one addItem (amount plus
 * the SHA-256 of a move-in and a move-out photo, hashed here); "Send the list" is
 * submitItems. The contract's checks run here first, so a bad line costs no gas.
 */
function ListingForm({ ctx, flow, act }: { ctx: Ctx; flow: Flow; act: Act }) {
  const { lease, pending, items } = ctx;
  const ids = useId();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [entry, setEntry] = useState<PhotoHash>({ kind: "none" });
  const [exit, setExit] = useState<PhotoHash>({ kind: "none" });
  const [problem, setProblem] = useState<ListingProblem>(null);
  const [busy, setBusy] = useState<"add" | "send" | null>(null);
  // Bumped after each added line, so the two file inputs mount empty again.
  const [round, setRound] = useState(0);

  const claimed = items.reduce((s, it) => s + it.amount, 0);
  const amountNumber = /^\d+$/.test(amount) ? Number(amount) : 0;
  const left = lease.deposit - claimed;

  function check(): ListingProblem {
    if (items.length >= MAX_ITEMS) return `A lease holds at most ${MAX_ITEMS} lines, and this one has ${items.length}.`;
    if (amountNumber <= 0) return "Enter an amount above zero, in whole USDG.";
    if (claimed + amountNumber > lease.deposit)
      return `This line would bring the claim to ${formatUsdg(claimed + amountNumber)}, above the ${formatUsdg(lease.deposit)} deposit. At most ${formatUsdg(left)} is left.`;
    if (entry.kind !== "hashed" || exit.kind !== "hashed") return "Pick a move-in photo and a move-out photo for this line.";
    return null;
  }

  async function add() {
    const found = check();
    setProblem(found);
    if (found || entry.kind !== "hashed" || exit.kind !== "hashed") return;
    const line: ListedLine = {
      index: items.length,
      label: label.trim(),
      amount: amountNumber,
      entryPhoto: entry.hash,
      exitPhoto: exit.hash,
    };
    setBusy("add");
    const ok = await act("addItem", "addItem", [line.amount, line.entryPhoto, line.exitPhoto], { listed: [...flow.listed, line] });
    setBusy(null);
    if (!ok) return;
    setLabel("");
    setAmount("");
    setEntry({ kind: "none" });
    setExit({ kind: "none" });
    setRound((r) => r + 1);
  }

  async function send() {
    if (items.length === 0) {
      setProblem("Add at least one line before sending the list.");
      return;
    }
    setProblem(null);
    setBusy("send");
    await act("submitItems", "submitItems", [], { phase: "Itemized" });
    setBusy(null);
  }

  return (
    <section aria-label="List deductions" className="space-y-4 rounded-sm border-2 border-border bg-card p-4">
      <div className="space-y-1">
        <h3 className="font-display text-xl uppercase">List deductions on {lease.street}</h3>
        <p className="text-sm text-muted-foreground">
          {formatUsdg(claimed)} claimed of {formatUsdg(lease.deposit)} · {items.length} of {MAX_ITEMS} lines
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <SceneSlot n={2} alt="Two photo prints side by side of the same bedroom window, the left one intact and the right one with a diagonal crack, each stamped with a hash check mark" width={640} height={640} className="w-32 border-2 border-border sm:w-40" />
          <p className="min-w-0 flex-1 basis-56 text-sm">
            No lines yet. Add each deduction with its move-in and move-out photo; {lease.tenant.name.split(" ")[0]} answers them line by line.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li key={it.id} className="min-w-0 rounded-sm border-2 border-border bg-background px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{it.label || `Line ${i + 1}`}</span>
                <span className="font-display text-lg">{formatUsdg(it.amount)}</span>
              </div>
              <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                <span>in</span>
                <ShortHex value={it.entryPhoto} />
                <span>out</span>
                <ShortHex value={it.exitPhoto} />
              </p>
            </li>
          ))}
          <li className="flex justify-between border-t-2 border-border pt-2 text-sm font-semibold">
            <span>Running total</span>
            <span>
              {formatUsdg(claimed)} of {formatUsdg(lease.deposit)}
            </span>
          </li>
        </ol>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${ids}-label`} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What is being deducted (stays in this browser)
          </label>
          <Input
            id={`${ids}-label`}
            value={label}
            placeholder="Cracked bedroom window pane"
            disabled={pending}
            onChange={(e) => setLabel(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${ids}-amount`} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Amount in USDG ({formatUsdg(Math.max(0, left))} left)
          </label>
          <Input
            id={`${ids}-amount`}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={amount}
            placeholder="400"
            disabled={pending}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <PhotoField key={`entry-${round}`} id={`${ids}-entry`} label="Move-in photo" state={entry} onChange={setEntry} disabled={pending} />
        <PhotoField key={`exit-${round}`} id={`${ids}-exit`} label="Move-out photo" state={exit} onChange={setExit} disabled={pending} />
      </div>

      {problem && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <WithIntent ctx={ctx} fn="addItem" amount={amountNumber}>
          <Button variant="outline" disabled={pending} onClick={() => void add()}>
            {pending && busy === "add" ? "Adding…" : "Add this line"}
          </Button>
        </WithIntent>
        <WithIntent ctx={ctx} fn="submitItems" amount={claimed}>
          <Button disabled={pending || items.length === 0} onClick={() => void send()}>
            {pending && busy === "send" ? "Sending…" : "Send the list"}
          </Button>
        </WithIntent>
      </div>
    </section>
  );
}

type PhotoHash = { kind: "none" } | { kind: "hashing" } | { kind: "hashed"; hash: Hex; name: string } | { kind: "error" };

/** One photo input, hashed with SHA-256 in the browser on change. The photo never leaves the device. */
function PhotoField({
  id,
  label,
  state,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  state: PhotoHash;
  onChange: (next: PhotoHash) => void;
  disabled: boolean;
}) {
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onChange({ kind: "none" });
      return;
    }
    onChange({ kind: "hashing" });
    try {
      onChange({ kind: "hashed", hash: await sha256Hex(file), name: file.name });
    } catch {
      onChange({ kind: "error" });
    }
  }

  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} (hashed here, never uploaded)
      </label>
      <FileInput id={id} accept="image/*" disabled={disabled} onChange={onFile} />
      {state.kind === "hashing" && <p className="text-xs text-muted-foreground">Hashing…</p>}
      {state.kind === "hashed" && (
        <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span>sha256</span>
          <ShortHex value={state.hash} />
        </p>
      )}
      {state.kind === "error" && <p className="text-xs font-semibold text-destructive">This browser could not hash the file.</p>}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-sm border-2 border-border bg-card p-4">
      <div className="max-w-[60ch] space-y-1">
        <h3 className="font-display text-xl uppercase">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function DeductionRow({
  item,
  answer,
  editable,
  pending,
  onAnswer,
}: {
  item: DeductionItem;
  answer: Answer;
  editable: boolean;
  pending: boolean;
  onAnswer: (a: Answer) => void;
}) {
  const [check, setCheck] = useState<
    { state: "idle" } | { state: "hashing" } | { state: "match"; which: string } | { state: "nomatch"; hash: Hex } | { state: "error" }
  >({ state: "idle" });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheck({ state: "hashing" });
    try {
      const hash = await sha256Hex(file);
      if (hash === item.entryPhoto) setCheck({ state: "match", which: "move-in" });
      else if (hash === item.exitPhoto) setCheck({ state: "match", which: "move-out" });
      else setCheck({ state: "nomatch", hash });
    } catch {
      setCheck({ state: "error" });
    }
  }

  const checkId = useId();

  return (
    <motion.li variants={ROW_FADE} className="rounded-sm border-2 border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border px-4 py-2">
        <p className="font-semibold">{item.label}</p>
        <div className="flex items-center gap-2">
          <span className="font-display text-xl">{formatUsdg(item.amount)}</span>
          {answer === "accepted" && <Badge variant="ok">Accepted</Badge>}
          {answer === "disputed" && <Badge variant="secondary">Disputed</Badge>}
          {answer === "pending" && <Badge variant="outline">Awaiting tenant</Badge>}
        </div>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        <PhotoSide label="Move-in photo" note={item.entryNote} hash={item.entryPhoto} />
        <PhotoSide label="Move-out photo" note={item.exitNote} hash={item.exitPhoto} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground sm:flex-1">
          <p id={checkId}>Check a photo against the anchored hashes (SHA-256, computed in your browser)</p>
          <FileInput accept="image/*" onChange={onFile} buttonLabel="Check a photo" emptyText="No photo checked" aria-describedby={checkId} />
          {check.state === "hashing" && <span>Hashing…</span>}
          {check.state === "match" && <span className="font-semibold text-ok">Matches the {check.which} photo on chain.</span>}
          {check.state === "nomatch" && (
            <span className="font-semibold text-destructive">No match. This file hashes to {shortHex(check.hash)}.</span>
          )}
          {check.state === "error" && <span className="font-semibold text-destructive">This browser could not hash the file.</span>}
        </div>
        {editable && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant={answer === "accepted" ? "default" : "outline"} disabled={pending} onClick={() => onAnswer("accepted")}>
              Accept
            </Button>
            <Button size="sm" variant={answer === "disputed" ? "secondary" : "outline"} disabled={pending} onClick={() => onAnswer("disputed")}>
              Dispute
            </Button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

function PhotoSide({ label, note, hash }: { label: string; note: string; hash: Hex }) {
  return (
    <div className="min-w-0 space-y-1 bg-card px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{note}</p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        <span>sha256</span>
        <ShortHex value={hash} />
        <span className="font-semibold text-ok">anchored</span>
      </p>
    </div>
  );
}

/**
 * The amount and salt to reveal for one side: the copy rememberSalt saved in this browser
 * (cautio:salt:*) when it matches the commit, otherwise the flow's own copy when known.
 */
function revealPair(lease: Lease, side: Side, offer: SealedOffer): { amount: number; salt: Hex } | null {
  const saved = recallSalt(saltKey(lease), side);
  if (saved) {
    const amount = saved.amount ?? (offer.known ? offer.amount : null);
    if (amount !== null && offerCommit(lease.onchainId, lease[side].address, amount, saved.salt) === offer.commit) {
      return { amount, salt: saved.salt };
    }
  }
  return offer.known ? { amount: offer.amount, salt: offer.salt } : null;
}

function FinalOffers({
  ctx,
  flow,
  totals,
  act,
  setNote,
}: {
  ctx: Ctx;
  flow: Flow;
  totals: ReturnType<typeof totalsFor>;
  act: Act;
  setNote: (note: string | null) => void;
}) {
  const { lease, pending, mode, role } = ctx;
  const ids = useId();
  const cap = totals.disputed;
  const [drafts, setDrafts] = useState<Record<Side, string>>({
    landlord: String(cap),
    tenant: String(Math.round(cap / 3 / 50) * 50),
  });
  const { landlord, tenant } = flow.offers;

  function seal(side: Side) {
    const amount = Number(drafts[side]);
    if (!Number.isInteger(amount) || amount < 0 || amount > cap) return;
    const salt = newSalt();
    rememberSalt(saltKey(lease), side, salt, amount);
    const sealed = sealFor(lease, side, amount, salt);
    const other = side === "landlord" ? tenant : landlord;
    void act(`commitOffer (${side})`, "commitOffer", [sealed.commit], {
      offers: { ...flow.offers, [side]: sealed },
      phase: other ? "Revealed" : "Sealed",
    });
  }

  function revealMine(side: Side) {
    const offer = flow.offers[side];
    if (!offer) return;
    const pair = revealPair(lease, side, offer);
    if (!pair) {
      setNote("This browser does not hold the salt for this offer. Reveal from the browser that sealed it.");
      return;
    }
    const other = flow.offers[side === "landlord" ? "tenant" : "landlord"];
    void act(`revealOffer (${side})`, "revealOffer", [pair.amount, pair.salt], {
      offers: { ...flow.offers, [side]: { ...offer, ...pair, revealed: true, known: true } },
      opened: !!other?.revealed,
    });
  }

  function revealBoth() {
    if (!landlord || !tenant) return;
    const l = revealPair(lease, "landlord", landlord);
    const t = revealPair(lease, "tenant", tenant);
    if (!l || !t) {
      setNote("This browser does not hold both salts. Each side opens its own offer.");
      return;
    }
    void act("revealOffer × 2", "revealOffer", [l.amount, l.salt], {
      opened: true,
      offers: {
        landlord: { ...landlord, ...l, revealed: true, known: true },
        tenant: { ...tenant, ...t, revealed: true, known: true },
      },
    }, [["revealOffer", [t.amount, t.salt]]]);
  }

  function pick(side: Side) {
    const offer = flow.offers[side];
    if (!offer) return;
    void act(`pickOffer (${side}'s number)`, "pickOffer", [side === "tenant"], {
      phase: "Ruled",
      award: totals.accepted + offer.amount,
    });
  }

  const mySide: Side | null = mode === "real" && (role === "landlord" || role === "tenant") ? role : null;
  const myOffer = mySide ? flow.offers[mySide] : null;
  const otherSide: Side = mySide === "landlord" ? "tenant" : "landlord";

  return (
    <div className="space-y-4">
      <div className="max-w-[68ch] space-y-1">
        <h3 className="font-display text-2xl uppercase">Sealed final offers on {formatUsdg(cap)}</h3>
        <p className="text-sm text-muted-foreground">
          Each side writes the number it will live with, without seeing the other. Only the hash goes on chain until both are open.
          {totals.accepted > 0 && ` ${formatUsdg(totals.accepted)} of accepted items is already the landlord's.`}
        </p>
      </div>

      {!flow.opened && (
        <SceneSlot n={3} alt="Two sealed envelopes with wax seals, one orange and one blue, and an agent's hand lifting only the blue envelope" width={960} height={480} className="hidden max-w-md border-2 border-border sm:block" />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(["landlord", "tenant"] as const).map((side) => {
          const offer = flow.offers[side];
          const name = lease[side].name;
          const value = drafts[side];
          const valid = /^\d+$/.test(value) && Number(value) <= cap;
          const ownsBackup = mode === "sim" || mySide === side;
          return (
            <div key={side} className="space-y-3 rounded-sm border-2 border-border bg-card p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {side === "landlord" ? "Landlord's window" : "Tenant's window"} · {name}
              </p>
              {offer ? (
                flow.opened ? (
                  <p className="font-display text-4xl">{formatUsdg(offer.amount)}</p>
                ) : (
                  <div className="space-y-1">
                    <Badge variant={offer.revealed ? "ok" : "secondary"}>{offer.revealed ? "Opened, other side pending" : "Sealed"}</Badge>
                    <p className="flex min-w-0 items-center gap-x-1 text-xs">
                      <span>commit</span>
                      <ShortHex value={offer.commit} />
                    </p>
                    {ownsBackup && !offer.revealed && <SaltBackup lease={lease} side={side} offer={offer} />}
                  </div>
                )
              ) : (
                <Gate ctx={ctx} need={[side]}>
                  <div className="space-y-3">
                    <OfferRail
                      value={valid ? Number(value) : 0}
                      max={cap}
                      accepted={totals.accepted}
                      deposit={lease.deposit}
                      landlordName={lease.landlord.name.split(" ")[0]}
                      tenantName={lease.tenant.name.split(" ")[0]}
                      disabled={pending || flow.phase !== "Sealed"}
                      onChange={(n) => setDrafts((d) => ({ ...d, [side]: String(n) }))}
                    />
                    <div className="space-y-1">
                      <label htmlFor={`${ids}-${side}-offer`} className="block text-xs text-muted-foreground">
                        Exact number, 0 to {cap} USDG
                      </label>
                      <Input
                        id={`${ids}-${side}-offer`}
                        inputMode="numeric"
                        value={value}
                        disabled={pending}
                        onChange={(e) => {
                          const next = e.target.value.replace(/[^\d]/g, "");
                          setDrafts((d) => ({ ...d, [side]: next }));
                        }}
                        aria-invalid={!valid}
                      />
                    </div>
                    {!valid && <p className="text-xs font-semibold text-destructive">Enter a whole number up to {cap}.</p>}
                    <WithIntent ctx={ctx} fn="commitOffer">
                      <Button size="sm" variant="secondary" disabled={!valid || pending || flow.phase !== "Sealed"} onClick={() => seal(side)}>
                        {pending ? "Sealing…" : "Seal my offer"}
                      </Button>
                    </WithIntent>
                  </div>
                </Gate>
              )}
            </div>
          );
        })}
      </div>

      {flow.phase === "Revealed" && !flow.opened && mode === "sim" && (
        <Step title="Both offers sealed" hint="Each side reveals amount and salt; the vault checks them against the commits.">
          <WithIntent ctx={ctx} fn="revealOffer" amount={landlord?.known ? landlord.amount : undefined}>
            <Button variant="secondary" disabled={pending} onClick={revealBoth}>
              {pending ? "Opening…" : "Open both offers"}
            </Button>
          </WithIntent>
        </Step>
      )}

      {flow.phase === "Revealed" && !flow.opened && mode !== "sim" && (
        <Step
          title="Both offers sealed"
          hint="Each side opens its own offer from its own wallet. The vault checks amount and salt against the commit, and both numbers show once both are open."
        >
          <Gate ctx={ctx} need={["landlord", "tenant"]}>
            {mySide && myOffer && !myOffer.revealed ? (
              <WithIntent ctx={ctx} fn="revealOffer" amount={revealPair(lease, mySide, myOffer)?.amount}>
                <Button variant="secondary" disabled={pending} onClick={() => revealMine(mySide)}>
                  {pending ? "Opening…" : "Open my offer"}
                </Button>
              </WithIntent>
            ) : (
              <p className="text-sm font-semibold">
                Waiting for {lease[otherSide].name} ({otherSide})
              </p>
            )}
          </Gate>
        </Step>
      )}

      {flow.phase === "Revealed" && flow.opened && landlord && tenant && (
        <div className="space-y-3 rounded-sm border-2 border-border bg-primary p-4 text-primary-foreground">
          <h3 className="font-display text-2xl uppercase">{lease.arbiter.name} picks one number</h3>
          <p className="max-w-[60ch] text-sm">
            There is no split-the-difference button. The more reasonable offer wins whole, which is why both sides offered something close to fair.
          </p>
          <Gate ctx={ctx} need={["arbiter"]}>
            <div className="flex flex-wrap items-end gap-4">
              <WithIntent ctx={ctx} fn="pickOffer" amount={landlord.amount}>
                <Button variant="outline" disabled={pending} onClick={() => pick("landlord")}>
                  {lease.landlord.name.split(" ")[0]}&apos;s {formatUsdg(landlord.amount)}
                </Button>
              </WithIntent>
              <WithIntent ctx={ctx} fn="pickOffer" amount={tenant.amount}>
                <Button variant="outline" disabled={pending} onClick={() => pick("tenant")}>
                  {lease.tenant.name.split(" ")[0]}&apos;s {formatUsdg(tenant.amount)}
                </Button>
              </WithIntent>
            </div>
          </Gate>
        </div>
      )}
    </div>
  );
}

/** A JSON file with what the reveal needs, built in the browser. Nothing is uploaded. */
function SaltBackup({ lease, side, offer }: { lease: Lease; side: Side; offer: SealedOffer }) {
  const [href, setHref] = useState<string | null>(null);
  const key = saltKey(lease);
  const { known, amount: knownAmount, salt: knownSalt, commit } = offer;

  useEffect(() => {
    const saved = recallSalt(key, side);
    const amount = known ? knownAmount : (saved?.amount ?? null);
    const salt = known ? knownSalt : (saved?.salt ?? null);
    if (amount === null || !salt || salt === zeroHash) {
      setHref(null);
      return;
    }
    const body = JSON.stringify({ leaseId: lease.onchainId, side, amount, salt, commit }, null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [key, side, known, knownAmount, knownSalt, commit, lease.onchainId]);

  if (!href) return null;
  return (
    <Button asChild variant="link" size="sm">
      <a href={href} download={`cautio-salt-${key}-${side}.json`}>
        Download salt backup
      </a>
    </Button>
  );
}

function Payout({ lease, award }: { lease: Lease; award: number }) {
  const back = lease.deposit - award;
  return (
    <div className="space-y-3 rounded-sm border-2 border-border bg-card p-4">
      <h3 className="font-display text-2xl uppercase">Paid out in one transaction</h3>
      <SceneSlot n={4} alt="One stack of orange bills sliding to a landlord's key and a larger blue stack sliding to a tenant's moving box" width={1200} height={500} className="border-2 border-border" />
      <div className="riso-plate flex h-10 border-2 border-border" aria-hidden>
        {award > 0 && <div className="bg-primary" style={{ flexGrow: award }} />}
        {back > 0 && <div className="riso-halftone-blue bg-background" style={{ flexGrow: back }} />}
      </div>
      <p className="text-sm">
        <span className="font-semibold">{lease.landlord.name}</span> received {formatUsdg(award)}.{" "}
        <span className="font-semibold">{lease.tenant.name}</span> got {formatUsdg(back)} back
        {award === 0 ? ", the full deposit." : "."} A frozen USDG address would have its share held in the vault for a later withdraw.
      </p>
    </div>
  );
}
