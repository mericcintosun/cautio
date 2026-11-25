"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Never print error.message: it can carry RPC URLs or stack details.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="cautio-enter mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cautio</p>
      <h2 className="riso-overprint font-display text-5xl">Cautio hit a snag</h2>
      <p className="text-sm text-muted-foreground">
        The desk could not load this view. The deposits in the vault are untouched.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/?lease=rua-harmonia-302">Back to Rua Harmonia 302</Link>
        </Button>
      </div>
    </section>
  );
}
