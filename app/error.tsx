"use client";

import { DeskErrorState } from "@/components/desk-states";

// Never print error.message: it can carry RPC URLs or stack details.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DeskErrorState reset={reset} />;
}
