# DEMO: Cautio in 90 seconds

**Problem.** São Paulo tenants hand over three months of rent as caução and fight to get it back.

**Trigger.** Move-out day.

**Wow moment.** Two sealed final offers open together, the arbiter clicks one, and one Arbitrum tx splits the USDG deposit between landlord and tenant (700 and 2,300).

**Closing.** The silent-landlord refund: a landlord who lists nothing in time hands the whole deposit back to the tenant in one click.

**Demo start route.** `/` (it opens `rua-harmonia-302`).

## Click path

1. **`/?view=open`: the tenant locks 3,000 USDG.** Larissa Mendes fills the open-lease panel (landlord Otávio Ferraz, arbiter Camila Rocha, rent 1,000, window 30 days), hashes a move-in photo in the browser, and clicks "Lock 3,000 USDG". The receipt shows "approve 3,000 USDG" and the `openLease` hash, labelled simulated until Phase 2.
   File: `app/page.tsx` plus `components/open-lease-panel.tsx`.
2. **`/?lease=rua-harmonia-302`: the landlord's list.** Otávio listed "Cracked bedroom window pane" for 400 USDG and "Repaint living room walls" for 900 USDG, each with a move-in and move-out photo hash pair. The tenant accepts the window and disputes the paint, then sends the answers to the vault.
   File: `app/page.tsx` plus `components/lease-detail.tsx`.
3. **Same lease: seal, open, pick, settle.** Otávio seals 900 and Larissa seals 300; only the commit hashes show. "Open both offers" reveals both numbers together. Camila picks Larissa's 300. "Settle in one transaction" pays 700 to Otávio (400 accepted plus 300 picked) and 2,300 back to Larissa.
   File: `components/lease-detail.tsx`.
4. **`/about`: how it works.** The DepositVault phase walk-through, the timeout table ("Silence loses"), and the Arbitrum and USDG notes. Arbiscan links arrive in Phase 2.
   File: `app/about/page.tsx`.
5. **`/?lease=alameda-santos-1140`: the silent landlord.** Helena Vasconcelos never listed a deduction and the 30 day window closed on 18 Nov. Click "Claim full refund of 3,600 USDG"; Rafael Okamoto gets the full deposit back.
   File: `app/page.tsx` plus `components/lease-detail.tsx`.

## Verbs and contract events

| Demo verb | DepositVault event |
| --- | --- |
| lock | `LeaseOpened` |
| list | `ItemAdded` |
| seal | `OfferSealed` |
| open | `OfferRevealed` |
| pick | `OfferPicked` |
| settle | `Settled` |
| claim full refund | `TimeoutResolved`, then `Settled` |

The contract test `contracts/test/DepositVault.t.sol` walks step 2 and step 3 on chain and checks the 700 and 2,300 split.
