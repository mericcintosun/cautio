"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { EXPLORER } from "@/lib/config";
import { shortHex } from "@/lib/data";
import type { WalletState } from "@/lib/wallet-state";

/** MOTION M5: opacity only, linear, 280ms. */
const LINE_FADE: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.28, ease: "linear" } },
  shown: { opacity: 1, transition: { duration: 0.28, ease: "linear" } },
};

/**
 * The receipt row under a lease: one branch per wallet state. Pending, confirmed and error
 * lines swap inside their own AnimatePresence (K1 #3); initial={false} keeps first paint visible.
 */
export function TxStatus({ state }: { state: WalletState }) {
  const line = txLine(state);
  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {line && (
          <motion.div key={state.kind} variants={LINE_FADE} initial="hidden" animate="shown" exit="hidden">
            {line}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function txLine(state: WalletState): ReactNode {
  switch (state.kind) {
    case "disconnected":
    case "connecting":
    case "idle":
      return null;
    case "wrong-network":
      return (
        <p className="border-t-2 border-dashed border-border pt-3 text-xs text-warn">
          Your wallet is on another network. Use &quot;Switch to Arbitrum Sepolia&quot; in the header before signing.
        </p>
      );
    case "tx-pending":
      return (
        <p className="border-t-2 border-dashed border-border pt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{state.label}</span> · waiting for the wallet and the block. Buttons are
          paused until it lands.
        </p>
      );
    case "tx-confirmed":
      return (
        <p className="border-t-2 border-dashed border-border pt-3 text-xs text-muted-foreground">
          Last call: <span className="font-semibold text-foreground">{state.label}</span> ·{" "}
          {state.simulated ? (
            <>tx {shortHex(state.hash, 10, 6)} (simulated: no vault address, no browser wallet or a sample lease)</>
          ) : (
            <>
              confirmed on Arbitrum Sepolia ·{" "}
              <a className="underline decoration-primary decoration-2" href={`${EXPLORER}/tx/${state.hash}`} target="_blank" rel="noopener noreferrer">
                {shortHex(state.hash, 10, 6)} on Arbiscan
              </a>
            </>
          )}
        </p>
      );
    case "tx-rejected":
      return (
        <p role="status" className="border-t-2 border-dashed border-border pt-3 text-xs text-warn">
          <span className="font-semibold">{state.label}</span> · You closed the wallet. Nothing was sent.
        </p>
      );
    case "tx-failed":
      return (
        <p role="alert" className="rounded-sm border-2 border-destructive bg-background px-3 py-2 text-sm text-destructive">
          <span className="font-semibold">{state.label} did not go through.</span> {state.hint}
        </p>
      );
  }
}
