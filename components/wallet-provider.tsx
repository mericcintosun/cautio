"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { CHAIN_ID, VAULT_ADDRESS } from "@/lib/config";
import { toCoreError } from "@/lib/errors";
import type { Lease } from "@/lib/types";
import {
  browserWallet,
  connectBrowserWallet,
  readBrowserWallet,
  sendVaultTx,
  switchToVaultChain,
  type LeaseOrigin,
  type VaultTx,
  type VaultWrite,
} from "@/lib/vault";
import { accountOf, type WalletState } from "@/lib/wallet-state";

/** The parties of the lease open on the desk, so the header can show this wallet's role. */
export type WalletFocus = Pick<Lease, "tenant" | "landlord" | "arbiter" | "origin" | "street">;

interface WalletContextValue {
  state: WalletState;
  /** True once the browser reports a wallet and a vault address is configured: real writes are possible. */
  canSign: boolean;
  /** True once the browser reports window.ethereum (false on the server and in the first render). */
  hasProvider: boolean;
  focus: WalletFocus | null;
  setFocus: (focus: WalletFocus | null) => void;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  /** Back to idle (or disconnected) after reading a confirmed, rejected or failed tx. */
  clear: () => void;
  /**
   * Sends one vault write through sendVaultTx and walks the state machine:
   * tx-pending, then tx-confirmed (only after the receipt), tx-rejected or tx-failed.
   * Returns the tx, or null when it did not go through. Never throws.
   */
  send: (label: string, fn: VaultWrite, leaseId: number, args: readonly unknown[], origin?: LeaseOrigin) => Promise<VaultTx | null>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function settled(account: Address, chainId: number): WalletState {
  return chainId === CHAIN_ID ? { kind: "idle", account } : { kind: "wrong-network", account };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Server HTML and the first client render agree: disconnected, no provider.
  const [state, setState] = useState<WalletState>({ kind: "disconnected" });
  const [hasProvider, setHasProvider] = useState(false);
  const [focus, setFocus] = useState<WalletFocus | null>(null);
  const stateRef = useRef<WalletState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const sync = useCallback(async () => {
    try {
      const found = await readBrowserWallet();
      setState((prev) => {
        // Never interrupt a transaction that is on its way.
        if (prev.kind === "tx-pending") return prev;
        return found ? settled(found.account, found.chainId) : { kind: "disconnected" };
      });
    } catch {
      setState((prev) => (prev.kind === "tx-pending" ? prev : { kind: "disconnected" }));
    }
  }, []);

  useEffect(() => {
    const provider = browserWallet();
    if (!provider) return;
    setHasProvider(true);
    void sync();
    const onAccounts = () => void sync();
    const onChain = () => void sync();
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
    };
  }, [sync]);

  const connect = useCallback(async () => {
    if (!browserWallet()) return;
    setState({ kind: "connecting" });
    try {
      const { account, chainId } = await connectBrowserWallet();
      setState(settled(account, chainId));
    } catch {
      // Closing the connect prompt sends nothing; the button goes back to "Connect wallet".
      setState({ kind: "disconnected" });
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToVaultChain();
    } catch {
      // The wallet keeps its network; the chainChanged listener reports any change.
    }
    await sync();
  }, [sync]);

  const clear = useCallback(() => {
    setState((prev) => {
      const account = accountOf(prev);
      if (prev.kind === "tx-pending") return prev;
      return account ? { kind: "idle", account } : { kind: "disconnected" };
    });
  }, []);

  const send = useCallback<WalletContextValue["send"]>(
    async (label, fn, leaseId, args, origin) => {
      const account = accountOf(stateRef.current);
      setState({ kind: "tx-pending", label, account });
      try {
        const tx = await sendVaultTx(fn, leaseId, args, origin);
        setState({ kind: "tx-confirmed", label, hash: tx.hash, simulated: tx.simulated, account });
        return tx;
      } catch (err) {
        const core = toCoreError(err);
        if (core.error === "user_rejected") {
          setState({ kind: "tx-rejected", label, account });
        } else {
          setState({ kind: "tx-failed", label, hint: core.hint, account });
        }
        return null;
      }
    },
    []
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      state,
      canSign: hasProvider && VAULT_ADDRESS !== null,
      hasProvider,
      focus,
      setFocus,
      connect,
      switchNetwork,
      clear,
      send,
    }),
    [state, hasProvider, focus, connect, switchNetwork, clear, send]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
