# Cautio contracts (Foundry)

`src/DepositVault.sol` is the one contract the product needs. `src/MockUSDG.sol` is a
testnet stand-in for Paxos USDG with the same `isFrozen` surface, deployed only when
`USDG_ADDRESS` is not set. Neither file has external imports, so `forge build` works
on a fresh clone without `forge install`.

Target chain: **Arbitrum Sepolia** (chain id 421614). Public RPC:
`https://sepolia-rollup.arbitrum.io/rpc`.

```bash
cd contracts
forge build

# Deploy (deploys MockUSDG too unless USDG_ADDRESS is set)
PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast

# One real interaction: mint 30 MockUSDG and lock it as a deposit
DEPLOYED_CONTRACT=0xYourVault PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Smoke.s.sol \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast

# Verify on Arbiscan (constructor arg = the USDG token address)
forge verify-contract 0xYourVault src/DepositVault.sol:DepositVault \
  --chain-id 421614 --etherscan-api-key $ARBISCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" 0xYourUSDG)
```

TESTNET ONLY. The farm app's contract-deploy step reads the chain id first and
refuses mainnet ids, writes the deployed address back into `.env.local` and
README, and saves the explorer link.

## Environment

- `PRIVATE_KEY`: deployer key (testnet wallet), read with `vm.envUint` and passed to
  `vm.startBroadcast(pk)`, so it never appears on argv. The farm runner sets it from
  `FARM_EVM_PRIVATE_KEY`.
- `RPC_URL`: testnet RPC (the runner uses `FARM_EVM_RPC_URL`).
- `USDG_ADDRESS` (optional): the real USDG token on the target chain. Unset means MockUSDG.
- `DEPLOYED_CONTRACT`: the vault address, read by `script/Smoke.s.sol`.
- `ARBISCAN_API_KEY`: only for `forge verify-contract`.

## State machine

```
Active -> MoveOut -> Itemized -> Sealed -> Revealed -> Ruled -> Settled
            |           |           |          |
            +-----------+-----------+----------+-- resolveTimeout() after each deadline
```

| Deadline passes in | Who was silent | Result |
| --- | --- | --- |
| MoveOut | landlord listed nothing | full refund to tenant |
| Itemized | tenant did not answer | every listed item stands |
| Sealed | one side did not commit | the committed side wins the disputed amount |
| Revealed | one side did not reveal | the revealed offer stands |
| Revealed | arbiter did not pick | the tenant's offer stands |

`settle()` pays both sides in one transaction. A recipient that USDG reports as frozen
(or that rejects the transfer) is credited in `owed` and pulls later with `withdraw()`.

`src/App.sol` is the template's placeholder contract and can be deleted.
