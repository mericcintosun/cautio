import type { Metadata } from "next";
import { DeskPhaseProvider, DiagonalSplit } from "@/components/diagonal-split";
import { LeaseDesk } from "@/components/lease-desk";
import { OpenLeasePanel } from "@/components/open-lease-panel";
import { SceneSlot } from "@/components/scene-slot";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { getAdapter } from "@/lib/adapter";
import { DEFAULT_LEASE_ID } from "@/lib/data";

type HomeSearch = Promise<{ lease?: string; view?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: HomeSearch }): Promise<Metadata> {
  const { lease, view } = await searchParams;
  if (view === "open") return { title: "Open a deposit" };
  if (lease) {
    const found = await getAdapter().getLease(lease);
    if (found) return { title: found.street };
  }
  return { title: "Lease desk" };
}

// S1 single-surface + L7 diagonal: a slim claim band on the stock side, the live lease desk
// on the orange block. At lg the block is cut by a clip-path that follows the open lease's
// phase (DiagonalSplit); below lg the desk carries its own slanted top edge.
export default async function Home({ searchParams }: { searchParams: HomeSearch }) {
  const { lease, view } = await searchParams;
  const adapter = getAdapter();
  const [leases, source] = await Promise.all([adapter.listLeases(), adapter.describe()]);
  const fallbackId = leases.some((l) => l.id === DEFAULT_LEASE_ID) ? DEFAULT_LEASE_ID : (leases[0]?.id ?? DEFAULT_LEASE_ID);
  const initialId = leases.some((l) => l.id === lease) ? (lease as string) : fallbackId;
  const template = leases.find((l) => l.id === DEFAULT_LEASE_ID) ?? leases[0] ?? null;
  const initialPhase = leases.find((l) => l.id === initialId)?.phase ?? "Active";
  const example = leases.find((l) => l.id === DEFAULT_LEASE_ID);

  return (
    <DeskPhaseProvider initialPhase={initialPhase}>
      <section className="relative isolate overflow-hidden">
        <DiagonalSplit />

        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-6 lg:flex-row lg:items-start lg:gap-0 lg:px-8 lg:py-12">
          <div className="cautio-stagger space-y-4 lg:sticky lg:top-24 lg:w-[34%] lg:pr-10">
            <h1 className="riso-overprint text-5xl sm:text-6xl lg:text-7xl">Your deposit, held by neither of you.</h1>
            <p className="max-w-[65ch] text-base">
              Three months of São Paulo rent locked in USDG on Arbitrum, split line by line at move-out.
            </p>
            <Button asChild>
              <NavLink href="/?view=open">Lock a deposit</NavLink>
            </Button>
            {example && (
              <p className="max-w-[65ch] border-l-4 border-primary pl-3 text-sm text-muted-foreground">
                Example loaded: {example.tenant.name.split(" ")[0]} is leaving {example.street.split(",")[0]}, so accept the
                window, dispute the paint and seal both offers.
              </p>
            )}
            <SceneSlot n={1} alt="A São Paulo apartment door with a set of keys hanging from an orange strongbox that is locked by two padlocks, one blue and one orange" width={1200} height={600} className="hidden border-2 border-border md:block" />
            <details className="cautio-fold max-w-[65ch] text-sm">
              <summary className="font-semibold">Why São Paulo renters fight over the caução</summary>
              <p className="mt-2 text-muted-foreground">
                Brazilian tenants usually hand over up to three months of rent as a cash caução. The law expects it to sit
                in an account tied to the lease, but in practice it often lands in the landlord&apos;s own account. At
                move-out the landlord keeps one lump sum, the tenant has no line items to contest, and the argument ends
                up on Reclame Aqui or in small claims court.
              </p>
            </details>
          </div>

          <div className="relative -mx-4 space-y-6 px-4 pb-10 pt-12 lg:mx-0 lg:flex-1 lg:px-0 lg:pb-0 lg:pt-0">
            <div aria-hidden className="cautio-split-narrow absolute inset-0 -z-10 bg-primary lg:hidden" />
            <div aria-hidden className="cautio-split-narrow riso-halftone absolute inset-0 -z-10 opacity-25 mix-blend-multiply lg:hidden" />
            {view === "open" && <OpenLeasePanel template={template} />}
            <LeaseDesk leases={leases} initialId={initialId} source={source} />
          </div>
        </div>
      </section>
    </DeskPhaseProvider>
  );
}
