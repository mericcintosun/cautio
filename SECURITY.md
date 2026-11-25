# Security: Cautio

## Contracts and chain

- `DepositVault` and `MockUSDG` (testnet stand-in for Paxos USDG) on Arbitrum Sepolia, chain id 421614.
- DepositVault address: set by the deploy step in NEXT_PUBLIC_CONTRACT_ADDRESS
- Explorer: https://sepolia.arbiscan.io
- Reentrancy guard (`nonReentrant`) on every function that moves tokens: `openLease`, `settle`, `withdraw`. Each one writes state and emits its event before the transfer.
- `openLease` measures the vault's USDG balance before and after `transferFrom` and reverts unless it received exactly the deposit. `transferFrom` only ever pulls from `msg.sender`.
- Payouts never fail the other side: a frozen or rejecting recipient's share goes to `owed`, and `withdraw` pays only the caller's own `owed` balance.
- No division, so no rounding path. No sweep or admin withdraw function exists.
- The owner (the deployer) can only `setPaused`. Pause stops new deposits only. It never blocks moves, timeouts, settle or withdraw, so a paused vault still returns every locked deposit.

## Wallet permissions

- `eth_accounts` on page load, silent: it only reads an account the wallet already authorized for this site.
- `eth_requestAccounts` only after a click on "Connect wallet" or on a send button.
- `wallet_switchEthereumChain` to 421614, and `wallet_addEthereumChain` for Arbitrum Sepolia when the wallet does not know it yet.
- No message signing: the app never calls `eth_sign`, `personal_sign` or `signTypedData`.
- Every write first runs as a dry run (`simulateContract`), so a wrong role or a wrong phase shows one sentence before any wallet prompt.

## Approvals

- Exactly the deposit amount: one `approve(DepositVault, deposit)` before `openLease`, never an unlimited allowance.
- The spender is the DepositVault contract address from `NEXT_PUBLIC_CONTRACT_ADDRESS`; the token is whatever `DepositVault.token()` returns.
- The sentence above every send button states the amount before the wallet opens, for example "Approve exactly 3,000 USDG for DepositVault, then lock it for Rua Harmonia 302."

Forms: the open-lease panel and the landlord listing form send only to DepositVault through `sendVaultTx` in `lib/vault.ts`. The `/api/leases` routes are read-only. Photos are hashed in the browser and never uploaded.

**Known limits.** Blockaid warnings on a new domain are partly reputation based, so a wallet may flag the site even though the calls are the ones listed above.

## Source

https://github.com/mericcintosun/cautio
