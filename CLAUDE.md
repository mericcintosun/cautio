# CLAUDE.md: Cautio

Read `IDENTITY.md` first (it overrides taste), then `DEMO.md`, then `HANDOFF.md`.

## Commands (for humans and the runner)
- `npm run build`
- `npm run seed` (writes `fixtures/leases.json` from `lib/data/seed.ts`, byte-identical each run)
- `cd contracts && forge build && forge test`

## Stack
Next.js 15 App Router, TypeScript strict, Tailwind v4 with no tailwind.config, `motion` 14, `viem` 2. npm only, no pnpm.

## Layout
- Reads: `getAdapter()` in `lib/adapter` (server side, `ADAPTER_MODE`, default fake).
- Writes: `sendVaultTx()` in `lib/vault.ts` (client side, mocked until Phase 2).
- Types in `lib/types.ts`, seed in `lib/data/seed.ts`, `lib/data.ts` is the compatibility barrel.

## Pitfalls
- `searchParams` and `params` are Promises in Next 15. Await them.
- Kit imports (`motion/react`) only in `"use client"` files.
- `@/lib/data` resolves to `lib/data.ts`, not the `lib/data/` folder.
- Colors only through tokens in `app/globals.css`. Hex literals are allowed only in `lib/brand-colors.ts` (Satori OG image) and `app/icon.svg`.
- Every interactive element goes through `components/ui/`.

## Never touch
- `IDENTITY.md` above its Amendments section.
- `public/illustrations/`, `public/logo.svg`, `components/brand-mark.tsx`.
- `contracts/src/DepositVault.sol` storage or signatures without a HANDOFF note.

## Vercel guardrails
- No request-time filesystem writes.
- `useSearchParams` only under `Suspense`.
- No Node-only APIs in edge paths.
- No custom server and no `output: export`.
- Every `process.env.X` mirrored in `.env.example`.

## Writing rules
No em or en dashes. Never use: seamless, seamlessly, leverage, empower, revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock, elevate, harness, effortless, "in today's world".

When compacting preserve the list of modified files and test commands.
