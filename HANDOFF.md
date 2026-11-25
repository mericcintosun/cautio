# HANDOFF: Cautio

## Phase 3: the whole demo path on chain, one wallet per role (2026-11-25)

### Goal
DEMO.md steps 1, 2, 3 and 5 run as real DepositVault transactions on Arbitrum Sepolia from three browser profiles (tenant Larissa, landlord Otávio, arbiter Camila), starting from an on-chain state that `npm run demo:reset` rebuilds. Each wallet acts only in its own role. Seed reads and simulated writes stay the fallback.

### Status
- Slice 1 done: `lib/wallet-state.ts` (`WalletState` with the eight kinds, `Role`, `roleOf`, `accountOf`), `lib/errors.ts` (`user_rejected`, `wrong_network`, cause-chain walk, one sentence per vault custom error, `isCoreError`), `lib/vault.ts` (error ABI, `assertNotInFlight`, `switchToVaultChain` with the 4902 `addChain` retry, `origin` fourth argument, `simulateContract` dry run before each write except `openLease`, `recallSalt`), `components/wallet-provider.tsx`, `components/wallet-button.tsx`, `app/layout.tsx`, IDENTITY Amendments line.
- Slice 2 done: `Lease.origin`, `SeedOffer.commit` and `revealed`, `DEMO_ANCHORS` plus `resolveAnchors` in `lib/adapter/real.ts` (newest 24 ids, 5 second memo kept), `leaseSignature` re-derive and "Refresh from chain" in `lease-desk.tsx`, role gating, "Open my offer", salt read-back and "Download salt backup" in `lease-detail.tsx`, `components/tx-status.tsx` replacing the receipt row.
- Slice 3 done: `contracts/script/SeedDemo.s.sol`, `scripts/demo-reset.mjs`, `demo:reset` and `demo:seed-chain` scripts, `.env.example` keys, proof `demo-state` block plus README markers, README "Demo reset" section and the line 92 rewrite.
- Slice 4 done: `components/desk-states.tsx` (`DeskSkeleton`, `AboutSkeleton`, `DeskErrorState`, `DeskEmptyState`, `VaultEmptyState`), `app/loading.tsx`, `app/error.tsx`, `app/about/loading.tsx`, `/about` empty state, `scene-slot.tsx` on `next/image` with `unoptimized`.
- Nothing was built, tested or run by the agent. `npm run build`, `forge build`, `npm run demo:reset` and `npm run proof` are unverified.

### Decisions
- **No wagmi, no RainbowKit, no react-query.** RainbowKit needs a WalletConnect project id the farm does not hold, and its modal breaks the sharp riso look. A small context (`WalletProvider`) over viem and `window.ethereum` covers connect, network switch, account and chain listeners and the tx lifecycle. No new npm dependency.
- **Wallet states carry the account** on `wrong-network` and every `tx-*` kind (not only `idle`), so role gating does not flicker while a transaction is pending.
- **`send` never throws.** It returns the tx or null; `tx-confirmed` is set only after `sendVaultTx` returns, which is after the receipt.
- **Anchor fingerprints** (`DEMO_ANCHORS`, raw `LeaseRow`): `rua-harmonia-302` = deposit `3000e6`, itemCount `2`, claimedTotal `1300e6`; `alameda-santos-1140` = deposit `3600e6`, itemCount `0`, window `60`. None of these fields change during the flow, so the anchor stays recognized through settle. The newest matching id wins. Chain leases without an anchor show as "Lease #N" only above the newest anchor id (for example the step 1 lease); older ones (Smoke lease #1, earlier cycles) are hidden. The other eight seed leases render with `onchainId: 0` and `origin: "seed"`, so their writes stay simulated. The same fingerprints are duplicated in `scripts/proof.mjs` (it cannot import TS).
- **Chain store row.** The decision-table row is "the step's proof IS the chain": DepositVault plus `lib/config.ts`, no store. Rejected: KV (nothing to cache that the chain does not already hold, and a second source of truth for phase) and Postgres (same, plus a schema push and a secret the live app does not need). Schema-push commands: not applicable. The salt in localStorage (`cautio:salt:*`, plus `cautio:amount:*` for the amount) is per-user browser state, not a store.
- **Append-only reset.** The chain cannot be rewound, so `demo:reset` opens two fresh anchors each run and the newest-anchor rule makes older ones invisible. Every cycle shows the same desk. Salts are keyed `chain-<onchainId>` for chain leases, so a new cycle never reads an old salt.
- **Both anchors use the same three wallets.** Alameda Santos shows the seed names Rafael and Helena, but on chain its tenant, landlord and arbiter are the Larissa, Otávio and Camila wallets. Step 5 ("Claim full refund") is open to anyone, so any profile can run it.
- **Chain deadlines use the real clock**; seed leases still use `SEED_NOW`. A chain lease in MoveOut shows "Check the window again" instead of "run the clock out", because `resolveTimeout` reverts before the deadline.
- **Step 1 on a chain desk** keeps the template's addresses when the names match, so the new lease names the real Otávio and Camila wallets instead of derived seed addresses. `openLease` passes `origin: "chain"`.
- **Dry run before each write.** `simulateContract` decodes reverts (`NotAllowed`, `WrongPhase`...) before the wallet prompt, so a wrong role sees one sentence and spends no gas.
- **Kit #1 untouched.** The `layoutId` cell to detail transition in `lease-desk.tsx` is unchanged.
- **`brand-mark.tsx` keeps its own image markup**; it is the one exception to the `next/image` switch because it is on the never-touch list.
- On-chain guards that back the client-side idempotency (quoted from `DepositVault.sol`, untouched): `modifier inPhase(uint256 id, Phase expected)` (line 109) on every step, `if (o.commit != bytes32(0)) revert AlreadyDone();` (line 226) and `if (o.revealed) revert AlreadyDone();` (line 245).

### Demo path, real and fallback
- Step 1: `components/open-lease-panel.tsx` calls `sendVaultTx("openLease", 0, [...], "chain")`; the simulated branch is in `lib/vault.ts` (`sendVaultTx`, no vault address or no wallet).
- Steps 2, 3 and 5: `components/lease-detail.tsx` (role-gated `act` through `useWallet().send`) on leases read by `lib/adapter/real.ts`; the seed fallback is in `real.ts` (`realAdapter` returns `seedLeases` when the read fails, and non-anchor seed leases carry `origin: "seed"`).
- Step 4: `/about`, static.

### Failed attempts
None.

### Files changed
lib/wallet-state.ts (new), lib/errors.ts, lib/vault.ts, lib/types.ts, lib/adapter/real.ts, components/wallet-provider.tsx (new), components/wallet-button.tsx (new), components/tx-status.tsx (new), components/desk-states.tsx (new), components/lease-desk.tsx, components/lease-detail.tsx, components/open-lease-panel.tsx, components/scene-slot.tsx, app/layout.tsx, app/loading.tsx, app/error.tsx, app/about/page.tsx, app/about/loading.tsx (new), contracts/script/SeedDemo.s.sol (new), scripts/demo-reset.mjs (new), scripts/proof.mjs, package.json, .env.example, README.md, IDENTITY.md (Amendments only), HANDOFF.md, .farm-commits.json.

### Commands run
none, agent has no shell

### Manual checklist
- Before the run: generate three keys with `cast wallet new`, put `DEMO_TENANT_KEY`, `DEMO_LANDLORD_KEY` and `DEMO_ARBITER_KEY` in `.env.local`, import each into its own browser profile. The farm wallet needs at least 0.01 Arbitrum Sepolia ETH extra (https://arbitrum.faucet.dev/, https://sepoliafaucet.com/, https://ethfaucet.com/networks/arbitrum).
- `npm run build` with zero TypeScript errors.
- `cd contracts && forge build` (SeedDemo.s.sol has not been compiled by the agent).
- `npm run proof` fills the `demo-state` block.
- `npm run demo:reset`, then walk DEMO.md three cycles in a row: identical screens, no step over 5 seconds.
- On the live URL in a private window: connect, the wrong-network switch, one confirmed tx linking to Arbiscan, one rejected tx showing "You closed the wallet. Nothing was sent."
- Re-run the tripwire greps (hexes, keyframes, `--delay`, `backdrop-blur`, one `<BrandMark` in `app/layout.tsx`).
- `git rm contracts/src/App.sol` if still present.

### Open questions
- **No live push between windows.** Realtime was out of scope, so after the other window signs, press "Refresh from chain". The wow moment therefore needs one refresh click in each window after the second reveal. Polling every few seconds would remove it; confirm before adding.
- **Memo after a tx.** The 5 second read memo can serve a pre-tx read if a refresh lands within 5 seconds of an earlier read. The flow does not regress (an unchanged signature keeps the local flow), but the desk may need a second refresh. Lowering `MEMO_MS` after writes would need a cache tag or a request flag.
- **Clock-based `clockRunOut` on chain leases** is computed during render with `Date.now()`, so a server and client render straddling the 60 second deadline can mismatch once. Rare; a client-only effect would fix it.
- **No salt import.** "Download salt backup" writes the file, but there is no upload to read it back in another browser. Reveal works from the sealing browser's localStorage.
- **Landlord listing UI.** `addItem` and `submitItems` have no form; SeedDemo does them. DEMO step 2 starts with the list already on chain, which matches the script, but a live listing step would need a landlord form.
- **The Alameda names** (Rafael, Helena) sit on the same three wallets as Rua Harmonia. Separate role keys for the second lease would mean three more keys; confirm whether that matters for the video.
- **`demo:seed-chain`** is written exactly as specified (`forge script ... --broadcast` without `--rpc-url`), so it needs `ETH_RPC_URL` or an `rpc_endpoints` entry; `demo:reset` passes the RPC explicitly.

### Next best step
Phase 4: kit signatures #2 (draggable offer marker on the 0 to disputed-total rail, bound to the sealed amount) and #3 (`AnimatePresence` staging of pending, result and error), a landlord listing form, optional short polling of the selected chain lease, then the Robinhood Chain deploy and the 90 second recording.

---

## Phase 2: DepositVault goes real on Arbitrum Sepolia (2026-11-25)

### Goal
DEMO.md step 3 (seal, open, pick, settle on `/?lease=rua-harmonia-302`) runs as real DepositVault transactions on Arbitrum Sepolia when `NEXT_PUBLIC_CONTRACT_ADDRESS` is set and a browser wallet is present, with the receipt row linking to Arbiscan. Lease reads come from the chain through `realAdapter` behind `ADAPTER_MODE=real`. Fake reads and simulated writes stay the default.

**What went real:** DepositVault reads (`leaseCount`, `leases`, `items`, `offers` via multicall) and writes (`openLease` with USDG `approve` first, `startMoveOut`, `respond`, `commitOffer`, `revealOffer`, `pickOffer`, `resolveTimeout`, `settle`) on Arbitrum Sepolia.

**Still on fixtures:** human labels and notes (street, neighborhood, party names, item labels, photo notes, rent, opened and move-out dates) are overlaid from `lib/data/seed.ts` by `onchainId`; every write is simulated when no wallet or no vault address is present; the whole desk falls back to the seed when the address is missing, the RPC fails or the vault holds zero leases.

**Env keys:**
- App (all public, read only in `lib/config.ts`): `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_CHAIN_ID` (written by the Kontrat deploy step), `NEXT_PUBLIC_RPC_URL` (optional override), `ADAPTER_MODE` (`real` for chain reads).
- Forge `vm.env*` names: `PRIVATE_KEY` comes from the farm wallet (`Deploy.s.sol`, `DeployWithUsdg.s.sol`, `Smoke.s.sol`); `DEPLOYED_CONTRACT` is set by the deploy step (`Smoke.s.sol`, read with `vm.envAddress`); `USDG_ADDRESS` is used only by `DeployWithUsdg.s.sol`.
- `.farm-live.json` has an empty `requiredEnv` because reads use the keyless public Arbitrum Sepolia RPC and writes are signed by the user's own browser wallet, so the live app needs no secret.

### Status
- Slice 1 done: `lib/config.ts` (the only chain `process.env` reader), `lib/errors.ts` (`ErrorCode` union, `CoreError`, `toCoreError`), `lib/schemas.ts` (`leaseSlugSchema`), `ApiResponse` failure branch is `{ ok:false, source, error, hint }`, `[id]` route parses the slug first (400 `invalid_input`, 404 `not_found`), both routes return 502 with `toCoreError` on a throw. `zod ^3.25.0` added.
- Slice 2 done: `sendVaultTx` real branch in `lib/vault.ts` (`createWalletClient` + `custom(window.ethereum)`, `requestAddresses`, `switchChain`, `writeContract`, `waitForTransactionReceipt` with `TX_RECEIPT_TIMEOUT_MS`), `buildVaultArgs`, `approve` before `openLease`, `[core]` log lines, failures throw `Error` with a `CoreError` cause. Simulated branch unchanged and still returns `simulated: true`. Receipt copy updated in `lease-detail.tsx` and `open-lease-panel.tsx`; `act` shows the hint.
- Slice 3 done: `DataSource` type, `describe()` on both adapters, `lib/adapter/real.ts`, `getAdapter()` switches on `ADAPTER_MODE_ENV`, `app/page.tsx` passes `source`, `ChainLine` renders the source line above the RPC line.
- Slice 4 done: `MockUSDG` (`owner`, `NotOwner`, `MAX_MINT` with NatSpec), seven new tests including the fuzz test, `Deploy.s.sol` reads only `PRIVATE_KEY` and always deploys MockUSDG, `DeployWithUsdg.s.sol` holds the `USDG_ADDRESS` path, `Smoke.s.sol` untouched, `test:contracts` script.
- Slice 5 done: `scripts/proof.mjs`, `proof` script, README "On-chain proof" section with both PROOF blocks, Quickstart lines, `.farm-live.json`, `.env.example` comments.
- Nothing was built, tested or run by the agent. `npm run build`, `forge test` and `npm run proof` are unverified until the runner and the human run them.

### DepositVault security notes (quoted from `contracts/src/DepositVault.sol`, untouched)
- Checks, effects, interactions in `openLease`: checks at lines 134 to 139 (`InvalidParty`, `InvalidAmount`, `InvalidWindow`), effects at lines 141 to 149 (`id = ++leaseCount`, lease fields, `emit LeaseOpened`), the only interaction `_pullIn(msg.sender, deposit)` last at line 151; the function is `nonReentrant` (line 131).
- `settle` (line 304, `nonReentrant inPhase(id, Phase.Ruled)`): `l.phase = Phase.Settled` at line 308 and `emit Settled` at line 309 happen before the two `_payOut` transfers at lines 311 and 312.
- `withdraw` (line 316, `nonReentrant`): checks at lines 318 and 319, `owed[msg.sender] = 0` at line 320 and `emit Withdrawn` at line 321 before the transfer at line 322.
- Loop cap: `uint8 public constant MAX_ITEMS = 16;` at line 60, enforced in `addItem` at line 170 (`if (l.itemCount >= MAX_ITEMS) revert TooManyItems();`), so the only loop, in `respond` at line 196, runs at most 16 times.
- Events for every displayed state change: lines 88 to 100 (`LeaseOpened`, `MoveOutStarted`, `ItemAdded`, `ItemsSubmitted`, `ItemsAnswered`, `OfferSealed`, `OfferRevealed`, `OfferPicked`, `TimeoutResolved`, `Ruled`, `Settled`, `PaymentHeld`, `Withdrawn`).

### Decisions
- **viem `custom(window.ethereum)` instead of wagmi.** Phase 2 adds no wallet dependency; a viem wallet client over the injected provider is enough to sign the four wow-step calls. wagmi and RainbowKit come in Phase 3 behind the same `sendVaultTx` signature.
- **`Deploy.s.sol` is MockUSDG-only.** No official USDG exists on Arbitrum Sepolia, and `Smoke.s.sol` mints, which only works on the mock. The real-token path lives in `DeployWithUsdg.s.sol`.
- **The `mint` cap.** `mint` stays an open faucet so any demo wallet can fund a deposit, capped at `MAX_MINT = 10_000e6` per call. The old `MINT_CAP` and `freezer` names were renamed to `MAX_MINT` and `owner`, and the `require` strings became custom errors (`MintCapExceeded`, `NotOwner`). The `Approval` event parameter was renamed from `owner` to `holder` to avoid shadowing (ABI topics unchanged).
- Call sites no longer pass the lease id: `buildVaultArgs` prepends `BigInt(leaseId)` and converts USDG amounts with `parseUnits`. `revealOffer` now sends the real `(amount, salt)` pair instead of the old placeholder args.
- `act` in `lease-detail.tsx` takes an optional follow-up list so "Open both offers" sends both reveals and "Claim full refund" sends `resolveTimeout` then `settle`. Same path in fake and real mode; no real-only branch in `PhaseBody`.
- `realAdapter` memoizes one chain read for 5 seconds so `listLeases`, `describe` and `generateMetadata`'s `getLease` share it. A vault with zero leases falls back to the seed so the desk is never empty.
- `readVaultStatus` now reports the `toCoreError` hint instead of the first line of the provider message.
- `/api/leases/[id]` reports `source: "fake"` on a 400, because the slug is rejected before `getAdapter()` is called.

### Failed attempts
None.

### Files changed
lib/config.ts (new), lib/errors.ts (new), lib/schemas.ts (new), lib/adapter/real.ts (new), lib/adapter/index.ts, lib/adapter/fake.ts, lib/vault.ts, lib/types.ts, app/api/leases/route.ts, app/api/leases/[id]/route.ts, app/page.tsx, components/lease-desk.tsx, components/lease-detail.tsx, components/open-lease-panel.tsx, contracts/src/MockUSDG.sol, contracts/test/DepositVault.t.sol, contracts/script/Deploy.s.sol, contracts/script/DeployWithUsdg.s.sol (new), contracts/README.md, scripts/proof.mjs (new), package.json, .env.example, .farm-live.json (new), .farm-commits.json, README.md, CLAUDE.md, HANDOFF.md.

### Commands run
none, agent has no shell

### Manual checklist
- `git rm contracts/src/App.sol` (still there; the agent cannot delete files).
- `npm install` (adds zod), `npm run build`.
- `npm run test:contracts` must pass all 8 tests, including `testFuzz_settleConservesDeposit`.
- Fund the farm wallet with about 0.02 Arbitrum Sepolia ETH, set `PRIVATE_KEY` in `.env.local`, press Kontrat deploy, then `npm run proof`.
- Vercel: set `ADAPTER_MODE=real` and the two `NEXT_PUBLIC_*` values from the deploy step, redeploy, check the "Live: DepositVault" line.

### Open questions
- **The wow step needs three wallets.** DepositVault checks `msg.sender` for each side (`commitOffer`, `revealOffer`, `pickOffer`), and `openLease` forbids tenant == landlord. One browser wallet can therefore only play one role: "Open both offers" sends both reveals in sequence, and the reveal for the side the wallet does not own reverts with `NotAllowed`, which shows the error hint. Phase 3 (wallet connect plus `SeedDemo.s.sol` with derived landlord and arbiter keys) should split this into per-side buttons. Confirm that split is acceptable as layout work in Phase 3.
- **Seed overlay versus Smoke lease.** The overlay is by `onchainId`, and `Smoke.s.sol` creates on-chain lease #1 (30 MockUSDG, demo landlord and arbiter). With `ADAPTER_MODE=real` that lease will display as "Rua Harmonia 302" with Larissa's names but 30 USDG in phase Active, until `SeedDemo.s.sol` builds the real state. Should the overlay also require matching addresses?
- **Unrevealed offers on chain.** The chain keeps only the commit until reveal; the salt lives in the sealing browser's localStorage (`rememberSalt`). For a chain lease that is sealed but not revealed and has no seed overlay, the desk shows the seal input again (a second commit reverts with `AlreadyDone`). Phase 3 should read `cautio:salt:*` back.
- `switchChain` fails if the wallet does not know Arbitrum Sepolia yet; there is no `addChain` fallback, and the user sees the generic hint. Add it with the Phase 3 connect flow?
- Window lengths below one day show as fractions of a day (`windowDays` is seconds / 86,400, two decimals) for chain leases.

### Next best step
Phase 3:
- wagmi and RainbowKit connect in the header action slot
- `SeedDemo.s.sol` that builds the rua-harmonia-302 state on chain with derived landlord and arbiter keys
- tx lifecycle UX (per-step pending, confirmed and error states)
- salt backup download next to "Seal my offer"

---

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
