# IDENTITY (contract; every later phase obeys this file)

DIRECTION: D13 riso
GROUND: #f3efe6 riso-stock
SURFACE: #e9e4d8
DEEP: #ddd7c8
LINE: #1c1b3b
INK: #1c1b3b
ACCENT: #ff6a2b riso-orange
ON_ACCENT: #1c1b3b
SECOND: #2f55d4 riso-blue
OK: #2e7d4f
WARN: #a8641c
BAD: #b3382c
FONT_DISPLAY: F14 Anton (next/font/google: Anton, weight: ["400"] is required)
FONT_BODY: Work Sans (next/font/google: Work_Sans)
FONT_MONO: none
STRUCTURE: S1 single-surface
ARCHETYPE: L7 diagonal
MOTION: M5 fade, prefix cautio-
KIT: K1 motion
RADIUS: sharp
HEADER: solid ground, border-b in LINE, sticky
LOGO_POLICY: brand-mark

## Why

The farm assigned this identity so that no two projects share a look, a route map or an interaction style. The most recent projects it differs from: Code for Change (D4, S5, L4, K7); AI for Medicine: A Global Student Hackathon on the Future of Care (D9, S2, L1, K2); Global AI Builder’s Challenge (D17, S3, L5, K5). It is not a suggestion. Tie the product's own nouns to it; do not swap any row for a familiar one.

## Direction: D13 riso

Two-ink risograph print: fluorescent ink overprinted on off-white stock.

Surface treatment: Overprint blends (mix-blend-mode: multiply) where two inks overlap, halftone dot fields built from radial-gradient patterns, a deliberate 2 to 3px misregistration between a shape and its outline, flat fills only.

Every hex in app/globals.css comes from the key block above. RADIUS sharp means 0 to 0.125rem on every card, panel and control. ON_ACCENT is the text color on an ACCENT fill. The semantic colors (OK, WARN, BAD) mark state only, never brand.

## Structure: S1 single-surface

The product IS the home route. There is no marketing landing page.

Route map (name the bracketed parts with the product's own words):
- `/` : the working tool, seeded and usable in the first viewport, with the claim in a slim band
- `/about` : why it exists, how it works, the sponsor tech (reached from the header)
- shareable state lives in the URL (search params such as `?view=` or `?id=`), so a result has a link

Rules:
- the first viewport is the tool, not copy about the tool
- onboarding is inline (hints, an example already loaded), never a separate page
- the header holds the mark, one link and one action; no multi-link nav

## Archetype: L7 diagonal (the composition of the home route)

The first screen is split by a diagonal or curved clip-path between the ground and an accent or surface block; the headline sits on one side and the live product on the other.

MUSTs: the split is a clip-path, not a rectangular grid; both halves use IDENTITY colors; mobile stacks the halves.
Bans: a straight vertical two-column grid at lg; a masked image wash.

## Motion: M5 fade (the entrance signature)

opacity only, linear, 280ms, no transform. One keyframe block implements it; every keyframe name starts with `cautio-`. A `prefers-reduced-motion: reduce` block disables it.

## Interaction kit: K1 motion

Motion (the successor of Framer Motion): layout animation, gestures and presence.

Packages for package.json dependencies: "motion": "^14.14.0".

Typical import: `import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform } from "motion/react";`

Signature interactions (the scaffold ships the first; all three exist by the end of the frontend phase):
1. a shared-layout transition: the core result grows from its list or summary cell into the detail view with `layoutId`, no cut
2. a draggable or pointer-tracked hero artifact (`drag`, `whileHover`, `useMotionValue`) bound to a real seed value, so moving it changes the number on screen
3. `AnimatePresence` staging on the demo route: loading, result and error swap with exit animations, and list items stagger through `variants`

Rules:
- use `initial={false}` on content that must be readable in server HTML
- add the packages above to package.json `dependencies` (and `devDependencies` where listed) with exactly these ranges; the runner installs them
- every import of a kit package lives in a component that starts with `"use client"`
- server HTML must be readable with JavaScript off: never server-render content at opacity 0 or off screen; animate from the visible state or on interaction
- honor `prefers-reduced-motion: reduce`: the content and every control stay usable with motion off
- every interaction is driven by the real seed data; a decorative animation with no product meaning does not count as a signature

## Amendments (append-only; later phases add dated lines here, never edit anything above)
- 2026-11-25 (Phase 3): Header action is now the wallet button; still one action.
- 2026-11-25 (Phase 4): below md the one header link becomes a Menu disclosure listing the three demo entry points; desktop header unchanged.
- 2026-11-25 (Phase 5): header no-wallet state is a status badge in the action slot; diagonal clip-path tracks lease phase; scene slots 1-6 placed.
- 2026-11-25 (Phase 5): header treatment confirmed: solid ground, border-b LINE, sticky.
