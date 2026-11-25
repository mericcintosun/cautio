# HANDOFF: Cautio

## Phase 1: walking skeleton (2026-11-25)

### Goal
All five steps of the 90 second demo (DEMO.md) are clickable on fake data, starting from `/`. Step 1 (tenant locks 3,000 USDG) gets its screen at `/?view=open`; steps 2 to 5 now read through the adapter seam.

### Status
- Slice 1 done: `DEMO.md`, `CLAUDE.md`.
- Slice 2 done: `lib/types.ts`, `lib/data/seed.ts`, `lib/data.ts` barrel, `lib/adapter/{index,fake}.ts`, `scripts/seed.ts`, `tsx` devDependency, `"openLease"` in `VaultWrite`. **Cut:** `fixtures/leases.json` was not hand-written (the photo hashes, salts and addresses come from sha256/keccak256 and cannot be reproduced by hand). The runner's first `npm run seed` creates it.
- Slice 3 done: `app/api/leases/route.ts`, `app/api/leases/[id]/route.ts`, `app/page.tsx` through `getAdapter()`, `app/loading.tsx`, empty state in `components/lease-desk.tsx`. `LayoutGroup` and `layoutId` untouched.
- Slice 4 done: title template, `components/ui/nav-link.tsx` (brand link and "How it works" both get `aria-current`), per-view `generateMetadata`, branded `error.tsx` and `not-found.tsx`, `lib/brand-colors.ts`, `.env.example` additions.
- Slice 5 done: `components/open-lease-panel.tsx` (mocked approve plus `sendVaultTx("openLease")`, photo SHA-256, idle, sending, done and error states), "Open a new deposit" link in the desk header.
- Slice 6 done: `contracts/test/DepositVault.t.sol` with `test_disputedPaintTenantOfferPicked` (local `Vm` interface, no forge-std). Not run: the agent has no shell.
- Build not run by the agent. Unverified until the runner's `npm run build`.

### Decisions
- `@/lib/data` became a compatibility barrel: it re-exports `lib/types.ts` and `lib/data/seed.ts` and keeps the format helpers. All old imports compile unchanged.
- Reads go through `getAdapter()` (server side: pages and API routes). Writes stay in the client-side `sendVaultTx` in `lib/vault.ts`, still mocked.
- `ADAPTER_MODE=real` returns the fake adapter for now (`TODO(Phase 2)` in `lib/adapter/index.ts`). The real adapter is pending.
- `seedParty(name)` is exported from the seed so the open-lease panel derives the same deterministic demo address the seed uses for a name.
- `OpenLeasePanel` takes a `template` prop (the `rua-harmonia-302` lease) for its defaults: Larissa Mendes, Otávio Ferraz, Camila Rocha, rent 1,000, 30 days.
- The contract test checks its deposit in plain `require`s and declares `IS_TEST = true` for older forge versions.
- README tech stack line now names majors: Next.js 15, React 19, Motion 14, viem 2, Tailwind v4.

### Failed attempts
None.

### Files changed
DEMO.md, CLAUDE.md, README.md, HANDOFF.md, .farm-commits.json, .env.example, package.json, lib/types.ts, lib/data.ts, lib/data/seed.ts, lib/adapter/index.ts, lib/adapter/fake.ts, lib/vault.ts, lib/brand-colors.ts, scripts/seed.ts, app/page.tsx, app/loading.tsx, app/layout.tsx, app/error.tsx, app/not-found.tsx, app/opengraph-image.tsx, app/about/page.tsx, app/api/leases/route.ts, app/api/leases/[id]/route.ts, components/lease-desk.tsx, components/open-lease-panel.tsx, components/ui/nav-link.tsx, contracts/test/DepositVault.t.sol.

### Commands run
none, agent has no shell; runner runs build

### Manual checklist
- `git rm contracts/src/App.sol` (template leftover; the agent cannot delete files).
- `npm run seed` once, then commit `fixtures/leases.json`. Run it a second time and check that `git diff fixtures/leases.json` is empty.
- `cd contracts && forge build && forge test` should pass `test_disputedPaintTenantOfferPicked` without `forge install`.
- Before Phase 2: fund the farm wallet (`FARM_EVM_PRIVATE_KEY`) with about 0.02 Arbitrum Sepolia ETH (https://arbitrum.faucet.dev/, https://sepoliafaucet.com/, https://ethfaucet.com/networks/arbitrum). RPC `https://sepolia-rollup.arbitrum.io/rpc`, chain 421614.

### Open questions
- `fixtures/leases.json` is not in the repo yet (see Status). Nothing in the app imports it.
- Pre-existing: `sendVaultTx` uses `Date.now()` for its fake hash. It is allowed (it is not in the seed), but the fake hashes are not reproducible.
- Pre-existing: party addresses in `lease-detail.tsx` render as `shortHex` without an `overflow-x-auto` wrapper, and sealed commits use `break-all`. Both fit on mobile, but a strict reading of the "hash line in overflow-x-auto" rule would want a wrapper. Left as is to keep the step 2 and 3 flow untouched.
- Choosing a lease cell while `?view=open` is showing replaces the URL with `?lease=<id>`, which closes the panel. That is intended, but worth confirming.

### Next best step
Phase 2: deploy DepositVault and MockUSDG on Arbitrum Sepolia, add wagmi writes behind `sendVaultTx`, create `npm run proof` and `.farm-live.json`, implement the real adapter behind `ADAPTER_MODE=real`, and record the live URL here.

---

You are picking up a working Next.js 15 scaffold for **Cautio**. Read this whole file, then `IDENTITY.md`, then start on the Mission list in order.

## 1. Context

**Product.** Cautio holds a rental deposit in a shared USDG vault on Arbitrum, splits every move-out deduction into photo-backed line items, and settles disputes by having an arbiter pick one of two sealed final offers.

**Plain pitch.** The deposit you hand over when renting goes neither to the landlord's pocket nor yours. It sits in a vault that neither of you can touch alone. At move-out the landlord lists every deduction separately, with the move-in photo and the move-out photo side by side. You accept or dispute each line. On disputed lines you both write your final number without seeing the other's; the agency picks the more reasonable of the two, and the money goes to both sides at once. If the landlord writes nothing for a month, the whole deposit opens back to you.

**Hackathon.** Arbitrum Open House São Paulo: Online Buildathon (HackQuest, Arbitrum Foundation).
- Submission window: 8 Feb 2027 03:01 to 1 Mar 2027 02:59, **time zone not stated**. Treat **28 Feb 2027** as the real deadline.
- Target track: **Overall Prize First Place** (30,000 USDC). Second ticket: **Promising Products Track** (7,000 USDC first place), if the HackQuest form lets one project enter both. Check the form.
- Verified requirements:
  - The project must be deployed on an Arbitrum chain to qualify (Arbitrum Sepolia, Arbitrum One, Robinhood Chain or others).
  - Contracts in Solidity or Stylus.
  - Submission through HackQuest. No video, repo or deck requirement is written on the page; the Terms and Conditions PDF was not readable, so check it.
  - Paxos USDG integration is not required but gets extra consideration.
  - In each track at least 1 of 3 prizes is reserved for a Robinhood Chain project and at least 1 for an Arbitrum project.
  - Overall prizes are paid against development milestones.
  - Existing projects are allowed.
- Judging: smart contract quality (best practices, logical structure, minimal vulnerabilities), product-market fit, innovation and creativity, real problem solving, plus extra consideration for USDG.

## 2. Current state

Identity: see IDENTITY.md (direction D13, structure S1, archetype L7, kit K1)

Riso print look: stock ground, ink lines, orange and blue plates printed 3px off register, Anton for display, Work Sans for body, square corners everywhere.

### Routes (Structure S1 single-surface)

| Route | File | What it shows |
| --- | --- | --- |
| `/` | `app/page.tsx` | The lease desk itself, seeded and usable in the first viewport. Claim on the stock side of a diagonal clip-path, desk on the orange side. `?lease=<slug>` selects the open lease, so any lease has a shareable link. |
| `/about` | `app/about/page.tsx` | Why it exists, the phase walk-through, final-offer rules, timeout table, Arbitrum and USDG, comparison table. Reached from the header link "How it works". |

Header (in `app/layout.tsx`) holds the mark, one link (`/about`) and one action (`/?lease=rua-harmonia-302`). One-mark proof, quoted from the header:

```tsx
<Link href="/" className="flex items-center gap-2.5 font-display text-2xl uppercase tracking-wide">
  <BrandMark size={30} />
  Cautio
</Link>
```

### File map

- `lib/data.ts`: types (`Lease`, `DeductionItem`, `Phase`) and 10 seeded São Paulo leases, at least one in every phase. Photo hashes are real SHA-256 values, salts and wallet addresses are derived deterministically with viem.
- `lib/vault.ts`: the chain integration module. `readVaultStatus()` is **real** (reads the block number over the public Arbitrum Sepolia RPC, plus `leaseCount()` and `token()` when `NEXT_PUBLIC_CONTRACT_ADDRESS` is set). `offerCommit()` is **real** and byte-compatible with `DepositVault.revealOffer`. `sha256Hex()` is **real** (Web Crypto). `newSalt()` and `rememberSalt()` are real. **`sendVaultTx()` is the only mock**: it waits 450ms and returns a labelled fake hash.
- `components/lease-desk.tsx`: client component; the desk, the shared-layout transition, the live chain status line.
- `components/lease-detail.tsx`: client component; the whole move-out flow per phase (`initFlow`, `LeaseDetail`, `DeductionRow`, `FinalOffers`, `Payout`). Flow state is a local mirror of on-chain state while writes are mocked.
- `components/ui/*`: shadcn primitives restyled for riso (ink border, offset blue plate, `rounded-sm` = 0.125rem).
- `app/globals.css`: tokens (IDENTITY hexes only), `riso-*` surface utilities, the L7 clip-paths, the `cautio-fade` keyframe with its reduced-motion block.
- `app/opengraph-image.tsx`, `app/icon.svg`, `public/logo.svg`, `public/illustrations/scene-{1,2,3}.svg`: brand pack. `<SceneSlot n={1}>` on `/`, `n={2}` and `n={3}` on `/about`.
- `contracts/src/DepositVault.sol`: the vault. `contracts/src/MockUSDG.sol`: testnet USDG with `isFrozen`. `contracts/script/Deploy.s.sol`, `contracts/script/Smoke.s.sol`, `contracts/README.md`. `contracts/src/App.sol` is the template's leftover placeholder: delete it (`git rm contracts/src/App.sol`).

### Interaction kit (K1 motion)

- **Shipped: #1 shared-layout transition.** On `/`, clicking a lease cell under "Other deposits at the desk" grows it into the detail view through `layoutId={"lease-" + id}`; the previous detail shrinks back into its cell. Driven by the seed leases, and the URL updates to `?lease=<slug>`.
- **To build: #2 pointer-tracked artifact.** Make the sealed-offer amount a draggable marker on a 0 to disputed-total rail (`drag="x"`, `useMotionValue`, `useTransform`), so dragging changes the number and the "landlord gets / tenant gets back" preview live.
- **To build: #3 AnimatePresence staging.** Wrap the `PhaseBody` swap in `AnimatePresence mode="wait"` so pending, result and error states exit and enter, and stagger the deduction rows through `variants`.

## 3. Mission (in order)

1. **Contract phase: DepositVault tests, deploy, verify (about 4h).** Add forge-std (`forge install foundry-rs/forge-std`) and write `contracts/test/DepositVault.t.sol`: happy path, dispute with tenant offer picked, dispute with landlord offer picked, non-revealing side loses, arbiter silence, landlord silence full refund, tenant silence, frozen recipient goes to `owed` then `withdraw`, wrong-phase and wrong-caller reverts, reveal with wrong salt. Then deploy and verify with the commands in `contracts/README.md`:
   ```bash
   cd contracts && forge build && forge test
   PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
   DEPLOYED_CONTRACT=0x... PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Smoke.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
   forge verify-contract 0x... src/DepositVault.sol:DepositVault --chain-id 421614 --etherscan-api-key $ARBISCAN_API_KEY --constructor-args $(cast abi-encode "constructor(address)" 0xUSDG)
   ```
   Get Arbitrum Sepolia ETH first; the farm wallet has none. Search once more for an official USDG address on Arbitrum Sepolia; if found, set `USDG_ADDRESS`. Done = verified contract on Arbiscan, test output pasted in README.
2. **Wallet writes (about 2h).** Add `wagmi`, `@rainbow-me/rainbowkit`, `@tanstack/react-query`; add a providers client component and a connect button in the header action slot. Replace the body of `sendVaultTx()` with `writeContract` + `waitForTransactionReceipt`. Add the open-lease form: landlord, arbiter, amount, window; USDG `approve` then `openLease`; move-in photos hashed in the browser. Done = a tenant locks 3,000 MockUSDG and the status line shows the new lease count.
3. **Move-out list on chain (about 2.5h).** Landlord form for `addItem` (amount, two photo files hashed with `sha256Hex`) and `submitItems`; tenant answers via `respond` with the bitmask already computed in `PhaseBody`. Read items back from the contract when `VAULT_ADDRESS` is set, seed data otherwise. Done = the window 400 and paint 900 lines render from chain reads.
4. **Sealed offers and arbiter panel on chain (about 2.5h). THE WOW MOMENT.** Commit from two browser profiles (landlord and tenant), salt stored with `rememberSalt` plus a "download salt backup" button, reveal both, arbiter wallet sees only the two pick buttons, `settle()` in one tx. Done = two windows each show only a hash, both open together, Camila clicks the tenant's 300, one Arbitrum tx sends 700 to the landlord and 2,300 to the tenant, link to Arbiscan in the receipt row. Rehearse this end to end twice before recording.
5. **Demo timeout mode (about 1h).** The open-lease form takes a short window (60 seconds minimum in the contract). Wire "Claim full refund" to `resolveTimeout` then `settle`. Done = a second lease with a silent landlord pays the full 3,000 back in one click.
6. **Kit signatures #2 and #3 (about 1.5h)** as described above.
7. **Ship (about 1h).** Vercel deploy with env vars, README test output and Arbiscan links, record the 90 second video following the script below.

Demo script (90s): 0-15s tenant locks 3,000 USDG. 15-45s landlord lists window 400 and paint 900, photo pairs with anchored hashes, tenant accepts the window and disputes the paint. 45-75s two windows seal 900 and 300, open, arbiter picks 300, one tx pays 700 and 2,300. 75-85s verified contract and settle tx on Arbiscan, test output. 85-90s silent landlord lease, "Claim full refund", 3,000 back.

## 4. Constraints

- Next.js 15 App Router, TypeScript strict, Tailwind v4 (no tailwind.config), deploys to Vercel: no custom server, no runtime file writes.
- `IDENTITY.md` is law for every color, font, route, layout and animation. Colors only through tokens in `app/globals.css`. Square corners. Display font on every h1 and h2. Motion entrance is `cautio-fade` only (opacity, linear, 280ms). The header keeps one mark, one link, one action. Append to its Amendments section if you must record a change; never edit above it.
- Every interactive element goes through `components/ui/`. No bare buttons or inputs.
- Server HTML must stay readable with JavaScript off; motion components never render at opacity 0 on the server.
- Copy: plain English, human tone, concrete numbers. No em dashes or en dashes. Avoid the words seamless, leverage, empower, revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock, elevate, harness, effortless.
- Keep `npm run build` passing after every change. If time runs short, cut scope (kit #2, Robinhood Chain deploy) before polishing.

## 5. Definition of done

- DepositVault deployed and verified on Arbitrum Sepolia, address in `NEXT_PUBLIC_CONTRACT_ADDRESS`, smoke tx recorded.
- Live on https://cautio.vercel.app, README demo link and Arbiscan links filled.
- The 90 second flow above works end to end with real wallet writes, starting from the seeded desk.
- The wow moment (two sealed offers open together, arbiter picks one, one tx splits the deposit) rehearsed twice.
- Submitted on HackQuest before 28 Feb 2027, track choice checked on the form.
