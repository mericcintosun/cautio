"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { PHASES, type Phase } from "@/lib/data";

interface DeskPhase {
  phase: Phase;
  setPhase: (phase: Phase) => void;
}

const DeskPhaseContext = createContext<DeskPhase | null>(null);

/** Holds the open lease's phase so the diagonal behind the desk can follow it. */
export function DeskPhaseProvider({ initialPhase, children }: { initialPhase: Phase; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const value = useMemo(() => ({ phase, setPhase }), [phase]);
  return <DeskPhaseContext.Provider value={value}>{children}</DeskPhaseContext.Provider>;
}

/** Called by the lease desk with the open lease's current flow phase. */
export function useReportDeskPhase(phase: Phase | null) {
  const ctx = useContext(DeskPhaseContext);
  const setPhase = ctx?.setPhase;
  useEffect(() => {
    if (phase && setPhase) setPhase(phase);
  }, [phase, setPhase]);
}

/** Top edge of the diagonal: 46% at Active, one even step per phase, 40% at Settled. */
function splitFor(phase: Phase): string {
  const i = Math.max(0, PHASES.indexOf(phase));
  const top = 46 - (6 * i) / Math.max(1, PHASES.length - 1);
  return `polygon(${top}% 0%, 100% 0%, 100% 100%, 31% 100%)`;
}

const SLIDE = { duration: 0.6, ease: "easeInOut" } as const;

/**
 * L7 showpiece at lg: the orange block and its halftone plate, cut by a clip-path whose top
 * edge slides left as the open deposit moves from Active to Settled. initial={false}, so the
 * server HTML already holds the final polygon; .cautio-split-wide stays as the no-JS shape.
 */
export function DiagonalSplit() {
  const ctx = useContext(DeskPhaseContext);
  const clipPath = splitFor(ctx?.phase ?? "Active");
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        aria-hidden
        className="cautio-split-wide absolute inset-0 -z-10 hidden bg-primary lg:block"
        initial={false}
        animate={{ clipPath }}
        transition={SLIDE}
      />
      <motion.div
        aria-hidden
        className="cautio-split-wide riso-halftone absolute inset-0 -z-10 hidden opacity-25 mix-blend-multiply lg:block"
        initial={false}
        animate={{ clipPath }}
        transition={SLIDE}
      />
    </MotionConfig>
  );
}
