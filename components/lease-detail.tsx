"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import type { Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { EXPLORER, newSalt, offerCommit, rememberSalt, sendVaultTx, sha256Hex, type VaultWrite } from "@/lib/vault";
import { cn } from "@/lib/utils";

export interface SealedOffer {
  amount: number;
  salt: Hex;
  commit: Hex;
}

/** Local mirror of one lease's on-chain state while writes are still simulated. */
export interface Flow {
  phase: Phase;
  answers: Record<string, Answer>;
  clockRunOut: boolean;
  offers: Record<Side, SealedOffer | null>;
  opened: boolean;
  award: number | null;
  lastTx: { label: string; hash: Hex; simulated: boolean } | null;
}

function sealFor(lease: Lease, side: Side, amount: number, salt: Hex): SealedOffer {
  return { amount, salt, commit: offerCommit(lease.onchainId, lease[side].address, amount, salt) };
}

export function initFlow(lease: Lease): Flow {
  const { landlord, tenant, opened } = lease.offers;
  return {
    phase: lease.phase,
    answers: Object.fromEntries(lease.items.map((i) => [i.id, i.answer])),
    clockRunOut: lease.deadline !== null && Date.parse(lease.deadline) < Date.parse(SEED_NOW),
    offers: {
      landlord: landlord ? sealFor(lease, "landlord", landlord.amount, landlord.salt) : null,
      tenant: tenant ? sealFor(lease, "tenant", tenant.amount, tenant.salt) : null,
    },
    opened,
    award: lease.landlordAward,
    lastTx: null,
  };
}

export function LeaseDetail({ lease, flow, onChange }: { lease: Lease; flow: Flow; onChange: (next: Flow) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totals = totalsFor(lease.items, flow.answers);

  async function act(label: string, fn: VaultWrite, args: readonly unknown[], next: Partial<Flow>) {
    setBusy(label);
    setError(null);
    try {
      const tx = await sendVaultTx(fn, lease.onchainId, args);
      onChange({ ...flow, ...next, lastTx: { label, ...tx } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The vault call failed.");
    } finally {
      setBusy(null);
    }
  }

  const showItems = lease.items.length > 0 && flow.phase !== "Active" && flow.phase !== "MoveOut";

  return (
    <Card className="bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-border p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {lease.neighborhood}, São Paulo · lease #{lease.onchainId}
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

      <dl className="grid gap-px border-b-2 border-border bg-border text-sm sm:grid-cols-3">
        <PartyCell role="Tenant" name={lease.tenant.name} address={lease.tenant.address} />
        <PartyCell role="Landlord" name={lease.landlord.name} address={lease.landlord.address} />
        <PartyCell role={`Arbiter, ${lease.arbiter.agency}`} name={lease.arbiter.name} address={lease.arbiter.address} />
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

      <div className="space-y-5 p-5">
        {showItems && (
          <section aria-label="Deductions" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl uppercase">Deductions, item by item</h3>
              <p className="text-sm text-muted-foreground">
                {formatUsdg(totals.claimed)} claimed of {formatUsdg(lease.deposit)}
              </p>
            </div>
            <ul className="space-y-3">
              {lease.items.map((it) => (
                <DeductionRow
                  key={it.id}
                  item={it}
                  answer={flow.answers[it.id] ?? it.answer}
                  editable={flow.phase === "Itemized" && !busy}
                  onAnswer={(a) => onChange({ ...flow, answers: { ...flow.answers, [it.id]: a } })}
                />
              ))}
            </ul>
          </section>
        )}

        <PhaseBody lease={lease} flow={flow} totals={totals} busy={busy} act={act} onChange={onChange} />

        {error && (
          <p role="alert" className="rounded-sm border-2 border-destructive bg-background px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {flow.lastTx && (
          <p className="border-t-2 border-dashed border-border pt-3 text-xs text-muted-foreground">
            Last call: <span className="font-semibold text-foreground">{flow.lastTx.label}</span> ·{" "}
            {flow.lastTx.simulated ? (
              <>simulated tx {shortHex(flow.lastTx.hash, 10, 6)} (vault writes are mocked until the wallet is wired)</>
            ) : (
              <a className="underline decoration-primary decoration-2" href={`${EXPLORER}/tx/${flow.lastTx.hash}`} target="_blank" rel="noreferrer">
                {shortHex(flow.lastTx.hash, 10, 6)} on Arbiscan
              </a>
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

function PartyCell({ role, name, address }: { role: string; name: string; address: string }) {
  return (
    <div className="bg-background px-5 py-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{role}</dt>
      <dd className="font-semibold">{name}</dd>
      <dd className="text-xs tabular-nums text-muted-foreground" title={address}>
        {shortHex(address)}
      </dd>
    </div>
  );
}

type Act = (label: string, fn: VaultWrite, args: readonly unknown[], next: Partial<Flow>) => Promise<void>;

function PhaseBody({
  lease,
  flow,
  totals,
  busy,
  act,
  onChange,
}: {
  lease: Lease;
  flow: Flow;
  totals: ReturnType<typeof totalsFor>;
  busy: string | null;
  act: Act;
  onChange: (next: Flow) => void;
}) {
  const id = lease.onchainId;

  switch (flow.phase) {
    case "Active":
      return (
        <Step title="Deposit locked" hint={`Opened ${formatDate(lease.openedOn)}. Neither ${lease.tenant.name} nor ${lease.landlord.name} can move it alone.`}>
          <Button variant="outline" disabled={!!busy} onClick={() => act("startMoveOut", "startMoveOut", [id], { phase: "MoveOut", clockRunOut: false })}>
            {busy ? "Sending…" : "Announce move-out"}
          </Button>
        </Step>
      );

    case "MoveOut":
      return flow.clockRunOut ? (
        <Step
          title="The landlord stayed silent"
          hint={`${lease.landlord.name} listed no deductions inside the ${lease.windowDays} day window, so the whole deposit opens to ${lease.tenant.name}.`}
        >
          <Button
            disabled={!!busy}
            onClick={() => act("resolveTimeout, then settle", "resolveTimeout", [id], { phase: "Settled", award: 0 })}
          >
            {busy ? "Sending…" : `Claim full refund of ${formatUsdg(lease.deposit)}`}
          </Button>
        </Step>
      ) : (
        <Step
          title="Waiting for the landlord's list"
          hint={`${lease.landlord.name} has until ${lease.deadline ? formatDate(lease.deadline) : `${lease.windowDays} days after move-out`} to list deductions with photos. Silence means a full refund.`}
        >
          <Button variant="outline" onClick={() => onChange({ ...flow, clockRunOut: true })}>
            Demo timeout mode: run the clock out
          </Button>
        </Step>
      );

    case "Itemized": {
      const mask = lease.items.reduce((m, it, i) => ((flow.answers[it.id] ?? it.answer) === "disputed" ? m | (1n << BigInt(i)) : m), 0n);
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
          <Button
            variant="secondary"
            disabled={!ready || !!busy}
            onClick={() =>
              act("respond", "respond", [id, mask], totals.disputed > 0 ? { phase: "Sealed" } : { phase: "Ruled", award: totals.accepted })
            }
          >
            {busy ? "Sending…" : "Send answers to the vault"}
          </Button>
        </Step>
      );
    }

    case "Sealed":
    case "Revealed":
      return <FinalOffers lease={lease} flow={flow} totals={totals} busy={busy} act={act} />;

    case "Ruled":
      return (
        <Step
          title="Ruling recorded"
          hint={`${formatUsdg(flow.award ?? 0)} goes to ${lease.landlord.name}, ${formatUsdg(lease.deposit - (flow.award ?? 0))} back to ${lease.tenant.name}. One call pays both.`}
        >
          <Button disabled={!!busy} onClick={() => act("settle", "settle", [id], { phase: "Settled" })}>
            {busy ? "Settling…" : "Settle in one transaction"}
          </Button>
        </Step>
      );

    case "Settled":
      return <Payout lease={lease} award={flow.award ?? 0} />;
  }
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
  onAnswer,
}: {
  item: DeductionItem;
  answer: Answer;
  editable: boolean;
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

  return (
    <li className="rounded-sm border-2 border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border px-4 py-2">
        <p className="font-semibold">{item.label}</p>
        <div className="flex items-center gap-2">
          <span className="font-display text-xl">{formatUsdg(item.amount)}</span>
          {answer === "accepted" && <Badge variant="ok">Accepted</Badge>}
          {answer === "disputed" && <Badge variant="secondary">Disputed</Badge>}
          {answer === "pending" && <Badge variant="outline">Awaiting tenant</Badge>}
        </div>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <PhotoSide label="Move-in photo" note={item.entryNote} hash={item.entryPhoto} />
        <PhotoSide label="Move-out photo" note={item.exitNote} hash={item.exitPhoto} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          <span>Check a photo against the anchored hashes (SHA-256, computed in your browser)</span>
          <Input type="file" accept="image/*" onChange={onFile} className="max-w-sm" />
          {check.state === "hashing" && <span>Hashing…</span>}
          {check.state === "match" && <span className="font-semibold text-ok">Matches the {check.which} photo on chain.</span>}
          {check.state === "nomatch" && (
            <span className="font-semibold text-destructive">No match. This file hashes to {shortHex(check.hash)}.</span>
          )}
          {check.state === "error" && <span className="font-semibold text-destructive">This browser could not hash the file.</span>}
        </label>
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" variant={answer === "accepted" ? "default" : "outline"} onClick={() => onAnswer("accepted")}>
              Accept
            </Button>
            <Button size="sm" variant={answer === "disputed" ? "secondary" : "outline"} onClick={() => onAnswer("disputed")}>
              Dispute
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function PhotoSide({ label, note, hash }: { label: string; note: string; hash: Hex }) {
  return (
    <div className="space-y-1 bg-card px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{note}</p>
      <p className="text-xs tabular-nums text-muted-foreground" title={hash}>
        sha256 {shortHex(hash, 10, 6)} · <span className="font-semibold text-ok">anchored</span>
      </p>
    </div>
  );
}

function FinalOffers({
  lease,
  flow,
  totals,
  busy,
  act,
}: {
  lease: Lease;
  flow: Flow;
  totals: ReturnType<typeof totalsFor>;
  busy: string | null;
  act: Act;
}) {
  const cap = totals.disputed;
  const [drafts, setDrafts] = useState<Record<Side, string>>({
    landlord: String(cap),
    tenant: String(Math.round(cap / 3 / 50) * 50),
  });
  const id = lease.onchainId;
  const { landlord, tenant } = flow.offers;

  function seal(side: Side) {
    const amount = Number(drafts[side]);
    if (!Number.isInteger(amount) || amount < 0 || amount > cap) return;
    const salt = newSalt();
    rememberSalt(lease.id, side, salt);
    const sealed = sealFor(lease, side, amount, salt);
    const other = side === "landlord" ? tenant : landlord;
    void act(`commitOffer (${side})`, "commitOffer", [id, sealed.commit], {
      offers: { ...flow.offers, [side]: sealed },
      phase: other ? "Revealed" : "Sealed",
    });
  }

  function pick(side: Side) {
    const offer = flow.offers[side];
    if (!offer) return;
    void act(`pickOffer (${side}'s number)`, "pickOffer", [id, side === "tenant"], {
      phase: "Ruled",
      award: totals.accepted + offer.amount,
    });
  }

  return (
    <div className="space-y-4">
      <div className="max-w-[68ch] space-y-1">
        <h3 className="font-display text-2xl uppercase">Sealed final offers on {formatUsdg(cap)}</h3>
        <p className="text-sm text-muted-foreground">
          Each side writes the number it will live with, without seeing the other. Only the hash goes on chain until both are sealed.
          {totals.accepted > 0 && ` ${formatUsdg(totals.accepted)} of accepted items is already the landlord's.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["landlord", "tenant"] as const).map((side) => {
          const offer = flow.offers[side];
          const name = lease[side].name;
          const value = drafts[side];
          const valid = /^\d+$/.test(value) && Number(value) <= cap;
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
                    <Badge variant="secondary">Sealed</Badge>
                    <p className="break-all text-xs tabular-nums" title={offer.commit}>
                      commit {offer.commit}
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <label className="block space-y-1 text-xs text-muted-foreground">
                    <span>Final number, 0 to {cap} USDG</span>
                    <Input
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => setDrafts({ ...drafts, [side]: e.target.value.replace(/[^\d]/g, "") })}
                      aria-invalid={!valid}
                    />
                  </label>
                  {!valid && <p className="text-xs font-semibold text-destructive">Enter a whole number up to {cap}.</p>}
                  <Button size="sm" variant="secondary" disabled={!valid || !!busy || flow.phase !== "Sealed"} onClick={() => seal(side)}>
                    {busy ? "Sealing…" : "Seal my offer"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {flow.phase === "Revealed" && !flow.opened && (
        <Step title="Both offers sealed" hint="Each side reveals amount and salt; the vault checks them against the commits.">
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() =>
              act("revealOffer × 2", "revealOffer", [id, landlord?.amount, tenant?.amount], { opened: true })
            }
          >
            {busy ? "Opening…" : "Open both offers"}
          </Button>
        </Step>
      )}

      {flow.phase === "Revealed" && flow.opened && landlord && tenant && (
        <div className="space-y-3 rounded-sm border-2 border-border bg-primary p-4 text-primary-foreground">
          <h3 className="font-display text-2xl uppercase">{lease.arbiter.name} picks one number</h3>
          <p className="max-w-[60ch] text-sm">
            There is no split-the-difference button. The more reasonable offer wins whole, which is why both sides offered something close to fair.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={!!busy} onClick={() => pick("landlord")}>
              {lease.landlord.name.split(" ")[0]}&apos;s {formatUsdg(landlord.amount)}
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => pick("tenant")}>
              {lease.tenant.name.split(" ")[0]}&apos;s {formatUsdg(tenant.amount)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Payout({ lease, award }: { lease: Lease; award: number }) {
  const back = lease.deposit - award;
  return (
    <div className="space-y-3 rounded-sm border-2 border-border bg-card p-4">
      <h3 className="font-display text-2xl uppercase">Paid out in one transaction</h3>
      <div className="flex h-10 overflow-hidden rounded-sm border-2 border-border" aria-hidden>
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
