"use client";

import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Hex } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatUsdg, seedParty, type Lease, type OpenLeaseInput, type Party } from "@/lib/data";
import { EXPLORER } from "@/lib/config";
import { sendVaultTx, sha256Hex, type VaultTx } from "@/lib/vault";

/** How many months of rent the caução holds. */
const RENT_MONTHS = 3;

type PanelState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; input: OpenLeaseInput; tx: VaultTx }
  | { kind: "error"; message: string };

type PhotoState = { kind: "none" } | { kind: "hashing" } | { kind: "hashed"; hash: Hex; name: string } | { kind: "error" };

/**
 * Demo step 1: the tenant locks the deposit. sendVaultTx approves USDG and calls
 * openLease through the browser wallet when a vault address is configured, and
 * simulates both calls otherwise; the receipt says which.
 */
export function OpenLeasePanel({ template }: { template: Lease | null }) {
  const ids = useId();
  const [tenant, setTenant] = useState(template?.tenant.name ?? "Larissa Mendes");
  const [landlord, setLandlord] = useState(template?.landlord.name ?? "Otávio Ferraz");
  const [arbiter, setArbiter] = useState(template?.arbiter.name ?? "Camila Rocha");
  const agency = template?.arbiter.agency ?? "Rocha Imóveis, Pinheiros";
  const [rent, setRent] = useState(String(template?.monthlyRent ?? 1000));
  const [windowDays, setWindowDays] = useState(String(template?.windowDays ?? 30));
  const [photo, setPhoto] = useState<PhotoState>({ kind: "none" });
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  const rentNumber = /^\d+$/.test(rent) ? Number(rent) : 0;
  const deposit = rentNumber * RENT_MONTHS;
  const windowNumber = /^\d+$/.test(windowDays) ? Number(windowDays) : 0;

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhoto({ kind: "none" });
      return;
    }
    setPhoto({ kind: "hashing" });
    try {
      setPhoto({ kind: "hashed", hash: await sha256Hex(file), name: file.name });
    } catch {
      setPhoto({ kind: "error" });
    }
  }

  function validate(): string | null {
    const names = [tenant.trim(), landlord.trim(), arbiter.trim()];
    if (names.some((n) => n.length === 0)) return "Fill in the tenant, landlord and arbiter names.";
    if (new Set(names.map((n) => n.toLowerCase())).size !== 3) return "Tenant, landlord and arbiter must be three different people.";
    if (rentNumber <= 0) return "Monthly rent must be a whole number above zero.";
    if (windowNumber < 1 || windowNumber > 30) return "The move-out window must be between 1 and 30 days.";
    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setState({ kind: "error", message: problem });
      return;
    }
    // A name that matches the template keeps the template's address: on a chain-backed desk
    // that is the real demo wallet of Otávio or Camila, so the new lease is one they can act on.
    const party = (name: string, fromTemplate: Party | undefined): Party =>
      fromTemplate && fromTemplate.name === name ? { name, address: fromTemplate.address } : seedParty(name);
    const input: OpenLeaseInput = {
      tenant: party(tenant.trim(), template?.tenant),
      landlord: party(landlord.trim(), template?.landlord),
      arbiter: { ...party(arbiter.trim(), template?.arbiter), agency },
      deposit,
      windowDays: windowNumber,
      entryPhoto: photo.kind === "hashed" ? photo.hash : null,
    };
    setState({ kind: "sending" });
    try {
      // buildVaultArgs in lib/vault.ts turns the USDG amount and the window into contract units.
      // openLease always creates a chain lease, so origin is "chain": real with a vault address
      // and a browser wallet, simulated otherwise.
      const tx = await sendVaultTx(
        "openLease",
        0,
        [input.landlord.address, input.arbiter.address, input.deposit, input.windowDays * 86_400],
        "chain"
      );
      setState({ kind: "done", input, tx });
    } catch (err) {
      const cause = err instanceof Error ? (err.cause as { hint?: unknown } | undefined) : undefined;
      const message =
        cause && typeof cause.hint === "string" ? cause.hint : err instanceof Error ? err.message : "The vault call failed.";
      setState({ kind: "error", message });
    }
  }

  const sending = state.kind === "sending";

  return (
    <Card id="open-a-deposit" className="mx-auto w-full max-w-xl bg-background">
      <div className="space-y-1 border-b-2 border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step 1 · move-in day</p>
        <h2 className="text-4xl">Open a deposit</h2>
        <p className="text-sm text-muted-foreground">
          The tenant locks {RENT_MONTHS} months of rent in USDG. Landlord and arbiter are fixed now and cannot be changed later.
        </p>
      </div>

      {state.kind === "done" ? (
        <div className="cautio-enter space-y-4 p-5">
          <h3 className="font-display text-2xl uppercase">{formatUsdg(state.input.deposit)} locked</h3>
          <ol className="space-y-2 text-sm">
            <li className="rounded-sm border-2 border-border bg-card px-3 py-2">
              <span className="font-semibold">1. approve {formatUsdg(state.input.deposit)}</span>
              <span className="text-muted-foreground">
                {" "}
                · USDG allowance for DepositVault, {state.tx.simulated ? "simulated" : "confirmed on Arbitrum Sepolia"}
              </span>
            </li>
            <li className="space-y-1 rounded-sm border-2 border-border bg-card px-3 py-2">
              <p className="font-semibold">
                2. openLease · {state.input.windowDays} day window · arbiter {state.input.arbiter.name}
              </p>
              <div className="overflow-x-auto">
                <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {state.tx.simulated ? (
                    <>simulated tx {state.tx.hash}</>
                  ) : (
                    <>
                      confirmed on Arbitrum Sepolia ·{" "}
                      <a
                        className="underline decoration-primary decoration-2"
                        href={`${EXPLORER}/tx/${state.tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {state.tx.hash} on Arbiscan
                      </a>
                    </>
                  )}
                </p>
              </div>
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">
            {state.input.tenant.name}&apos;s deposit is now held by the vault. Neither {state.input.landlord.name} nor{" "}
            {state.input.tenant.name} can move it alone.
            {state.tx.simulated && " Simulated: no vault address or browser wallet."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Back to the desk</Link>
            </Button>
            <Button variant="outline" onClick={() => setState({ kind: "idle" })}>
              Open another
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
          <Field id={`${ids}-tenant`} label="Tenant">
            <Input id={`${ids}-tenant`} value={tenant} onChange={(e) => setTenant(e.target.value)} autoComplete="off" />
          </Field>
          <Field id={`${ids}-landlord`} label="Landlord">
            <Input id={`${ids}-landlord`} value={landlord} onChange={(e) => setLandlord(e.target.value)} autoComplete="off" />
          </Field>
          <Field id={`${ids}-arbiter`} label={`Arbiter (agency: ${agency})`}>
            <Input id={`${ids}-arbiter`} value={arbiter} onChange={(e) => setArbiter(e.target.value)} autoComplete="off" />
          </Field>
          <Field id={`${ids}-rent`} label="Monthly rent in USDG">
            <Input
              id={`${ids}-rent`}
              inputMode="numeric"
              value={rent}
              onChange={(e) => setRent(e.target.value.replace(/[^\d]/g, ""))}
              aria-describedby={`${ids}-deposit`}
            />
          </Field>
          <p id={`${ids}-deposit`} className="text-sm">
            Deposit: {RENT_MONTHS} × rent = <span className="font-display text-2xl">{formatUsdg(deposit)}</span>
          </p>
          <Field id={`${ids}-window`} label="Move-out window in days (the landlord's time to list deductions)">
            <Input
              id={`${ids}-window`}
              inputMode="numeric"
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value.replace(/[^\d]/g, ""))}
            />
          </Field>
          <Field id={`${ids}-photo`} label="Move-in photo (hashed in your browser, never uploaded)">
            <Input id={`${ids}-photo`} type="file" accept="image/*" onChange={onPhoto} />
          </Field>
          {photo.kind === "hashing" && <p className="text-xs text-muted-foreground">Hashing…</p>}
          {photo.kind === "hashed" && (
            <div className="overflow-x-auto">
              <p className="whitespace-nowrap text-xs tabular-nums" title={photo.hash}>
                sha256 {photo.hash} · {photo.name}
              </p>
            </div>
          )}
          {photo.kind === "error" && (
            <p className="text-xs font-semibold text-destructive">This browser could not hash the file.</p>
          )}

          {state.kind === "error" && (
            <p role="alert" className="rounded-sm border-2 border-destructive bg-background px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sending}>
              {sending ? "Locking…" : `Lock ${formatUsdg(deposit)}`}
            </Button>
            <Button asChild variant="link">
              <Link href="/">Back to the desk</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs two calls: approve {formatUsdg(deposit)}, then openLease. With a vault address and a browser wallet both
            go to Arbitrum Sepolia; otherwise they are simulated.
          </p>
        </form>
      )}
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
