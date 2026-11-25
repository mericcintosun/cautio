"use client";

import { ShortHex } from "@/components/ui/address";
import { EXPLORER, VAULT_ADDRESS, describeTx, type LeaseOrigin, type VaultWrite } from "@/lib/vault";

/**
 * What the next send does, in one sentence, plus the contract it goes to. Rendered right
 * above every send button, so the wallet popup never shows an amount the page did not.
 */
export function TxIntent({
  fn,
  street,
  deposit,
  amount,
  origin,
}: {
  fn: VaultWrite;
  street: string;
  deposit?: number;
  amount?: number;
  /** Only "chain" leases sign real writes (lib/vault.ts canSendRealTx); anything else is simulated. */
  origin?: LeaseOrigin;
}) {
  return (
    <div className="w-full space-y-0.5 border-l-4 border-secondary pl-3 text-xs">
      <p className="font-semibold text-foreground">{describeTx(fn, { deposit, amount, street })}</p>
      <p className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
        {origin !== "chain" ? (
          <span>Simulated: this sample lease is not on chain, so nothing is signed.</span>
        ) : VAULT_ADDRESS ? (
          <>
            <span>Sent to DepositVault</span>
            <ShortHex value={VAULT_ADDRESS} href={`${EXPLORER}/address/${VAULT_ADDRESS}`} />
            <span>on Arbitrum Sepolia.</span>
          </>
        ) : (
          <span>Simulated: no vault address in this build</span>
        )}
      </p>
    </div>
  );
}
