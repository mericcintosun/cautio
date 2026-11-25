"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// The state triad for the demo routes: skeleton while loading, error with a retry,
// empty with a call to action. Flat riso blocks faded in once through .cautio-enter.
// No shimmer, no pulse.

export function DeskSkeleton() {
  return (
    <section aria-busy="true" aria-live="polite" className="cautio-enter mx-auto max-w-7xl space-y-5 px-4 py-8 lg:px-8 lg:py-12">
      <p className="font-display text-3xl uppercase">Opening the lease desk</p>
      <div className="space-y-3 rounded-sm border-2 border-border bg-muted p-5">
        <div className="h-4 w-1/3 rounded-sm bg-background" />
        <div className="h-8 w-2/3 rounded-sm bg-background" />
        <div className="riso-halftone h-24 w-full rounded-sm border-2 border-border bg-background" />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-20 rounded-sm border-2 border-border bg-muted" />
        ))}
      </ul>
    </section>
  );
}

export function AboutSkeleton() {
  return (
    <section aria-busy="true" aria-live="polite" className="cautio-enter mx-auto max-w-6xl space-y-8 px-4 py-12 lg:px-8">
      <p className="font-display text-3xl uppercase">Loading how it works</p>
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="h-16 w-5/6 rounded-sm bg-muted" />
          <div className="h-4 w-full rounded-sm bg-muted" />
          <div className="h-4 w-2/3 rounded-sm bg-muted" />
        </div>
        <div className="riso-halftone h-48 rounded-sm border-2 border-border bg-background" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-28 rounded-sm border-2 border-border bg-muted" />
        ))}
      </ul>
    </section>
  );
}

/** Never prints error.message: it can carry RPC URLs or stack details. */
export function DeskErrorState({ reset }: { reset?: () => void }) {
  const router = useRouter();
  return (
    <section className="cautio-enter mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cautio</p>
      <h2 className="riso-overprint font-display text-5xl">Cautio hit a snag</h2>
      <p className="text-sm text-muted-foreground">The desk could not load this view. The deposits in the vault are untouched.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => (reset ? reset() : router.refresh())}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/?lease=rua-harmonia-302">Back to Rua Harmonia 302</Link>
        </Button>
      </div>
    </section>
  );
}

export function DeskEmptyState() {
  return (
    <div className="cautio-enter space-y-3 rounded-sm border-2 border-border bg-background p-6">
      <h2 className="text-3xl text-foreground">No deposits at the desk yet</h2>
      <p className="max-w-[52ch] text-sm text-muted-foreground">
        Lock the first one: the tenant deposits three months of rent in USDG, and neither side can move it alone.
      </p>
      <Button asChild>
        <Link href="/?view=open">Open a new deposit</Link>
      </Button>
    </div>
  );
}

/** /about without a vault address: one line pointing at the seeded walk-through. */
export function VaultEmptyState() {
  return (
    <p className="cautio-enter flex flex-wrap items-center gap-3 rounded-sm border-2 border-border bg-card px-4 py-3 text-sm">
      <span>No DepositVault address is configured in this build, so every write on the desk is simulated.</span>
      <Button asChild size="sm" variant="outline">
        <Link href="/?lease=rua-harmonia-302">Walk the seeded move-out</Link>
      </Button>
    </p>
  );
}
