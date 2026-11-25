"use client";

import type { Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet, type WalletFocus } from "@/components/wallet-provider";
import { ROLE_LABEL, roleOf } from "@/lib/wallet-state";

const short = (a: Address): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

function RoleBadge({ focus, account }: { focus: WalletFocus | null; account: Address }) {
  if (!focus) return null;
  const role = roleOf(focus, account);
  return (
    <Badge variant={role === "viewer" ? "outline" : "secondary"} title={`Your role on ${focus.street}`}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}

/** The header's one action. One Button, one named branch per wallet state. */
export function WalletButton() {
  const { state, hasProvider, focus, connect, switchNetwork, clear } = useWallet();

  switch (state.kind) {
    case "disconnected":
      // No injected wallet: the action slot becomes a status, not a dead button.
      if (!hasProvider) {
        return (
          <Badge
            variant="outline"
            role="status"
            title="No browser wallet found, so every write is simulated"
            className="min-h-11 max-w-[8rem] whitespace-normal text-center leading-tight text-foreground sm:max-w-none sm:whitespace-nowrap"
          >
            No wallet: writes simulated
          </Badge>
        );
      }
      return (
        <Button size="sm" onClick={() => void connect()}>
          Connect wallet
        </Button>
      );
    case "connecting":
      return (
        <Button size="sm" disabled>
          Connecting…
        </Button>
      );
    case "wrong-network":
      return (
        <Button size="sm" variant="secondary" onClick={() => void switchNetwork()}>
          Switch to Arbitrum Sepolia
        </Button>
      );
    case "idle":
      return (
        <Button size="sm" variant="outline" onClick={() => void connect()} title={`${state.account}. Click to pick another account in your wallet.`}>
          {short(state.account)}
          <RoleBadge focus={focus} account={state.account} />
        </Button>
      );
    case "tx-pending":
      return (
        <Button size="sm" variant="outline" disabled title={state.label}>
          Waiting for the chain…
        </Button>
      );
    case "tx-confirmed":
      return (
        <Button size="sm" variant="outline" onClick={clear} title={`${state.label} confirmed`}>
          {state.account ? short(state.account) : "Done"}
          {state.account && <RoleBadge focus={focus} account={state.account} />}
        </Button>
      );
    case "tx-rejected":
      return (
        <Button size="sm" variant="outline" onClick={clear} title={`${state.label}: nothing was sent`}>
          {state.account ? short(state.account) : "Not sent"}
          {state.account && <RoleBadge focus={focus} account={state.account} />}
        </Button>
      );
    case "tx-failed":
      return (
        <Button size="sm" variant="outline" onClick={clear} title={state.hint}>
          {state.account ? short(state.account) : "Call failed"}
          {state.account && <RoleBadge focus={focus} account={state.account} />}
        </Button>
      );
  }
}
