# SUBMISSION: Cautio on HackQuest

Arbitrum Open House São Paulo: Online Buildathon. The HackQuest form fields were not captured, so this file follows HackQuest's standard order. Copy each field into the form.

## Project name

Cautio

## Tagline

Your rental deposit, held by neither of you: USDG on Arbitrum, split line by line at move-out.

## Description

São Paulo tenants hand over up to three months of rent as a caução, and at move-out the landlord usually announces one lump sum with nothing to contest line by line. Cautio puts that deposit in DepositVault, a Solidity contract on Arbitrum Sepolia that neither side can move alone.

What the demo shows (DEMO.md steps 1 to 6):

1. The tenant, Larissa, locks 3,000 USDG: the browser approves exactly the deposit, then calls `openLease`. A move-in photo is hashed in the browser.
2. The landlord, Otávio, has listed two deductions, a cracked window (400) and a repaint (900), each with the SHA-256 of a move-in and a move-out photo. Larissa accepts the window and disputes the paint.
3. Both sides seal a final number on the 900 in dispute by dragging a marker on a 0 to 900 rail; only the commit hashes go on chain. Both offers open together, the arbiter Camila picks Larissa's 300, and one `settle()` transaction pays 700 to Otávio and 2,300 back to Larissa.
4. `/about` walks the vault's phases and the timeout rules: silence always loses.
5. On a second lease the landlord listed nothing inside the window, so one click claims the full 3,600 refund for the tenant.
6. On the lease opened in step 1, the landlord lists the two deductions live from his wallet with `addItem` and `submitItems`.

USDG: the vault's only token is Paxos USDG (`IUSDG`). Before every payout `_payOut` checks `isFrozen()`; a frozen recipient's share is held in `owed` and pulled later with `withdraw()`, so one frozen wallet cannot block the other side's refund. On testnet the vault runs on MockUSDG, which has the same surface.

## Track(s)

- Overall Prize First Place
- Promising Products Track First Place: if the form allows one track, pick Overall Prize First Place.

## Tech stack

Next.js 15, React 19, TypeScript, Tailwind CSS v4, Motion 14, viem 2, zod 3, Solidity 0.8.24 with Foundry, Arbitrum Sepolia, Paxos USDG (MockUSDG on testnet).

## GitHub repo

https://github.com/mericcintosun/cautio

## Live demo URL

https://cautio-beta.vercel.app (DEMO step 2: https://cautio-beta.vercel.app/?lease=rua-harmonia-302)

## Deployed contract address

<!-- PROOF:BEGIN addresses -->
| What | Where |
| --- | --- |
| Live URL | https://cautio-beta.vercel.app |
| DepositVault | Not run in this build: NEXT_PUBLIC_CONTRACT_ADDRESS is not configured. |
<!-- PROOF:END addresses -->

Contract tests, written by `npm run proof`:

<!-- PROOF:BEGIN forge-test -->
```
Suite result: ok. 12 passed; 0 failed; 0 skipped; finished in 126.55ms (130.43ms CPU time)
Ran 1 test suite in 127.62ms (126.55ms CPU time): 12 tests passed, 0 failed, 0 skipped (12 total tests)
```

`forge test` in contracts/, exit code 0, 2026-11-25T11:55:42.509Z.
<!-- PROOF:END forge-test -->
