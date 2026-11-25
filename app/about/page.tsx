import type { Metadata } from "next";
import Link from "next/link";
import { VaultEmptyState } from "@/components/desk-states";
import { SceneSlot } from "@/components/scene-slot";
import { VAULT_ADDRESS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LEASE_ID } from "@/lib/data";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Why Cautio exists, how a deposit moves through the DepositVault state machine, and what runs on Arbitrum and USDG.",
};

const phases = [
  ["Active", "The tenant locks the deposit in USDG. Tenant, landlord and arbiter are fixed at this moment."],
  ["Move-out", "Either side announces it. The landlord now has 30 days to list deductions."],
  ["Items listed", "Each deduction carries an amount and the SHA-256 of a move-in and a move-out photo."],
  ["Offers sealing", "For the disputed total, each side commits keccak256(id, sender, amount, salt)."],
  ["Offers open", "Both reveal. The arbiter picks one of the two numbers, never something in between."],
  ["Settled", "One settle() call pays the landlord's award and returns the rest to the tenant."],
] as const;

const timeouts = [
  ["Landlord lists nothing in time", "Full refund to the tenant"],
  ["Tenant never answers the list", "Every listed item stands"],
  ["Only one side seals an offer", "That side wins the disputed amount"],
  ["Only one side reveals", "The revealed offer stands"],
  ["Arbiter stays silent", "The tenant's offer stands"],
] as const;

const compared = [
  ["Cautio", "Arbitrum, USDG", "Per item, photo hashes on chain", "Sealed final offers, arbiter picks one", "30 day silence refunds the tenant"],
  ["Rentible", "Solidity escrow", "No item split", "None: landlord takes it if nobody objects", "Not documented"],
  ["RentSafe", "Stellar / Soroban", "Partial deduction needs tenant approval", "No path found when approval fails", "Not documented"],
  ["Kleros Escrow, Trustless Work", "General escrow", "Not rent specific", "General jury or approver", "Not rent specific"],
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 lg:px-8">
      <header className="cautio-enter grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div className="space-y-4">
          <h1 className="riso-overprint-blue text-6xl sm:text-7xl">A deposit nobody can quietly keep.</h1>
          <p className="max-w-[65ch] text-base">
            Cautio is for the São Paulo tenant waiting on three months of rent after handing back the keys, and for the
            small agency that wants to run deposits fairly across a few hundred leases. The money sits in a contract.
            Deductions are itemized and backed by photos. Disagreements end with one of two sealed numbers, picked by
            someone both sides named on day one.
          </p>
        </div>
        <SceneSlot
          n={2}
          alt="Two photo prints side by side of the same bedroom window, the left one intact and the right one with a diagonal crack, each stamped with a hash check mark"
          width={960}
          height={640}
          className="border-2 border-border"
        />
      </header>

      {VAULT_ADDRESS === null && <VaultEmptyState />}

      <section className="space-y-6">
        <h2 className="text-4xl">The move-out problem</h2>
        <details className="cautio-fold max-w-[70ch]">
          <summary className="font-semibold">One lump sum, no line items, no one to appeal to.</summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>
              In Brazil a cash caução is capped at three months of rent and is supposed to sit in an account tied to the
              lease. Legal blogs we read agree that this rarely happens: the money usually lands in the landlord&apos;s
              personal account. When the tenant moves out, the landlord announces one number. There is nothing to
              contest line by line, so disputes go to Reclame Aqui complaints or the small claims court, months later.
            </p>
            <p>
              The fix is not a nicer escrow. It is changing what each side is allowed to do: the landlord must itemize
              with evidence, the tenant must answer each line, and anyone who goes quiet loses by default.
            </p>
          </div>
        </details>
      </section>

      <section className="space-y-6">
        <h2 className="text-4xl">How a deposit moves through the vault</h2>
        <ol className="cautio-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {phases.map(([name, text], i) => (
            <li key={name}>
              <Card className="h-full">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phase {i + 1}</p>
                  <CardTitle>{name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{text}</CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
        <SceneSlot
          n={3}
          alt="Two sealed envelopes with wax seals, one orange and one blue, and an agent's hand lifting only the blue envelope"
          width={960}
          height={640}
          className="border-2 border-border"
        />
        <div className="space-y-4">
          <h2 className="text-4xl">Final-offer arbitration, sealed</h2>
          <p className="max-w-[65ch]">
            Baseball salary arbitration has a simple rule: the arbiter cannot split the difference, only pick one side&apos;s
            number. That rule pulls both offers toward fair, because an extreme number loses whole. Cautio puts it on chain
            with commit-reveal, so neither side can wait to see the other&apos;s number first. The arbiter is named when the
            deposit is locked, usually the agency that wrote the lease.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-border text-left text-sm">
              <caption className="pb-2 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Every waiting step has a deadline. Silence loses.
              </caption>
              <thead className="bg-muted">
                <tr>
                  <th className="border-b-2 border-border px-3 py-2">If this happens</th>
                  <th className="border-b-2 border-border px-3 py-2">resolveTimeout() decides</th>
                </tr>
              </thead>
              <tbody>
                {timeouts.map(([when, result]) => (
                  <tr key={when} className="border-b border-border">
                    <td className="px-3 py-2">{when}</td>
                    <td className="px-3 py-2 font-semibold">{result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-4xl">What runs on Arbitrum</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>DepositVault</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                One Solidity contract on Arbitrum Sepolia (chain 421614) with an explicit state machine, custom errors,
                a reentrancy guard and checks-effects-interactions on every payout.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Paxos USDG</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Deposits are denominated in USDG. Before paying anyone, the vault asks USDG&apos;s isFrozen(). A frozen
                recipient&apos;s share is held in the vault and pulled later, so one frozen wallet cannot block the other
                side&apos;s refund.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>In the browser</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                viem reads the chain over the public RPC and computes the exact commit hash the contract checks. Photo
                hashes are SHA-256 from Web Crypto, so the photo itself never leaves your device.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-4xl">Compared with</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-2 border-border text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {["Product", "Rails", "Deductions", "Disputes", "Silent landlord"].map((h) => (
                  <th key={h} className="border-b-2 border-border px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compared.map((row) => (
                <tr key={row[0]} className="border-b border-border">
                  {row.map((cell, i) => (
                    <td key={i} className={i === 0 ? "px-3 py-2 font-semibold" : "px-3 py-2"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-[65ch] text-xs text-muted-foreground">
          Based on each project&apos;s public docs as of November 2026. Tell us if we got one wrong.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t-2 border-border pt-8">
        <Button asChild size="lg">
          <Link href={`/?lease=${DEFAULT_LEASE_ID}`}>Walk the disputed move-out</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Seeded with ten São Paulo leases, one in every phase.</p>
      </div>
    </div>
  );
}
