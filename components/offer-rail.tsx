"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MotionConfig, motion, useMotionValue, useTransform } from "motion/react";
import { formatUsdg } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Marker edge in px (h-11 w-11, the 44px touch target). */
const MARKER = 44;
const STEP = 10;
const BIG_STEP = 100;

interface OfferRailProps {
  /** The sealed number in USDG (the FinalOffers draft for this side). */
  value: number;
  /** The disputed total: the rail runs from 0 to this. */
  max: number;
  /** Accepted lines, already the landlord's. */
  accepted: number;
  deposit: number;
  landlordName: string;
  tenantName: string;
  disabled: boolean;
  onChange: (amount: number) => void;
}

function snap(raw: number, max: number): number {
  if (raw >= max) return max;
  if (raw <= 0) return 0;
  return Math.min(max, Math.round(raw / STEP) * STEP);
}

/**
 * K1 signature #2: the sealed offer as a draggable marker on a 0 to disputed-total rail.
 * Dragging writes the same draft number seal() reads, so the payout preview under the
 * rail moves live. The marker is a role="slider" with arrow keys (±10, Shift ±100), and
 * the number field next to it stays the exact-entry alternative.
 */
export function OfferRail({ value, max, accepted, deposit, landlordName, tenantName, disabled, onChange }: OfferRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [travel, setTravel] = useState(0);
  const x = useMotionValue(0);
  const amount = useTransform(x, (px) => (travel > 0 ? snap((px / travel) * max, max) : value));
  const fill = useTransform(x, (px) => px + MARKER / 2);

  // Track width minus the marker, re-measured on resize.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => setTravel(Math.max(0, rail.clientWidth - MARKER));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

  // The number field (or a key press) moved the value: put the marker under it.
  useEffect(() => {
    if (dragging.current || max <= 0) return;
    x.set((Math.min(value, max) / max) * travel);
  }, [value, max, travel, x]);

  const shown = Math.min(Math.max(value, 0), max);
  const toLandlord = accepted + shown;
  const toTenant = deposit - accepted - shown;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = e.shiftKey ? BIG_STEP : STEP;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = shown + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = shown - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(0, next)));
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-2">
        <div
          ref={railRef}
          className={cn(
            "riso-halftone relative h-11 border-2 border-border bg-background",
            disabled && "opacity-60"
          )}
        >
          <motion.div aria-hidden className="absolute inset-y-0 left-0 bg-primary mix-blend-multiply" style={{ width: fill }} />
          <motion.div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Sealed offer in USDG"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={shown}
            aria-valuetext={`${formatUsdg(shown)}: ${landlordName} gets ${formatUsdg(toLandlord)}, ${tenantName} gets back ${formatUsdg(toTenant)}`}
            aria-disabled={disabled || undefined}
            drag="x"
            dragListener={!disabled}
            dragConstraints={railRef}
            dragElastic={0}
            dragMomentum={false}
            onDragStart={() => {
              dragging.current = true;
            }}
            onDrag={() => {
              const a = amount.get();
              if (a !== value) onChange(a);
            }}
            onDragEnd={() => {
              dragging.current = false;
              const a = amount.get();
              onChange(a);
              if (max > 0) x.set((a / max) * travel);
            }}
            onKeyDown={onKeyDown}
            style={{ x }}
            className={cn(
              "riso-plate absolute -top-0.5 left-0 h-11 w-11 touch-none border-2 border-border bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
            )}
          />
        </div>
        <div className="flex justify-between text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>0</span>
          <span>{formatUsdg(max)} disputed</span>
        </div>
        <p aria-live="polite" className="text-sm">
          <span className="font-display text-2xl">{formatUsdg(shown)}</span>
          <span className="block">
            {landlordName} gets {formatUsdg(toLandlord)} · {tenantName} gets back {formatUsdg(toTenant)}
          </span>
        </p>
      </div>
    </MotionConfig>
  );
}
