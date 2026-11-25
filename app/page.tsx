import { LeaseDesk } from "@/components/lease-desk";
import { SceneSlot } from "@/components/scene-slot";
import { DEFAULT_LEASE_ID, leases } from "@/lib/data";

// S1 single-surface + L7 diagonal: the claim sits on the stock-colored side, the live
// lease desk sits on the orange block cut by a diagonal clip-path.
export default async function Home({ searchParams }: { searchParams: Promise<{ lease?: string }> }) {
  const { lease } = await searchParams;
  const initialId = leases.some((l) => l.id === lease) ? (lease as string) : DEFAULT_LEASE_ID;

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="cautio-split-wide absolute inset-0 -z-10 hidden bg-primary lg:block" />
      <div aria-hidden className="cautio-split-wide riso-halftone absolute inset-0 -z-10 hidden opacity-25 mix-blend-multiply lg:block" />

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-8 lg:flex-row lg:items-start lg:gap-0 lg:px-8 lg:py-12">
        <div className="cautio-stagger space-y-5 lg:sticky lg:top-24 lg:w-[34%] lg:pr-10">
          <h1 className="riso-overprint text-6xl sm:text-7xl">Your deposit, held by neither of you.</h1>
          <p className="max-w-[46ch] text-base">
            Cautio locks three months of rent in USDG on Arbitrum. At move-out every deduction is its own line with
            before-and-after photo hashes. If you disagree, both sides seal a final number and the arbiter has to pick
            one of them.
          </p>
          <p className="max-w-[46ch] border-l-4 border-primary pl-3 text-sm text-muted-foreground">
            Example loaded: Larissa is leaving Rua Harmonia 302. Accept the cracked window, dispute the paint, seal both
            offers, then let Camila choose.
          </p>
          <SceneSlot
            n={1}
            alt="A São Paulo apartment door with a set of keys hanging from an orange strongbox that is locked by two padlocks, one blue and one orange"
            width={960}
            height={640}
            className="max-w-sm border-2 border-border"
          />
          <details className="cautio-fold max-w-[60ch] text-sm">
            <summary className="font-semibold">Why São Paulo renters fight over the caução</summary>
            <p className="mt-2 text-muted-foreground">
              Brazilian tenants usually hand over up to three months of rent as a cash caução. The law expects it to sit
              in an account tied to the lease, but in practice it often lands in the landlord&apos;s own account. At
              move-out the landlord keeps one lump sum, the tenant has no line items to contest, and the argument ends
              up on Reclame Aqui or in small claims court.
            </p>
          </details>
        </div>

        <div className="relative -mx-4 px-4 pb-10 pt-16 lg:mx-0 lg:flex-1 lg:px-0 lg:pb-0 lg:pt-0">
          <div aria-hidden className="cautio-split-narrow absolute inset-0 -z-10 bg-primary lg:hidden" />
          <LeaseDesk leases={leases} initialId={initialId} />
        </div>
      </div>
    </section>
  );
}
