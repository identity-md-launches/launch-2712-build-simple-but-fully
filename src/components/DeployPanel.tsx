"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, useConfig, useDeployContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { squeekYieldAbi, squeekYieldBytecode } from "@/lib/abi.generated";
import { chain, SQUEEK_CORE } from "@/lib/config";
import { errorLine } from "@/lib/format";

/** Shown while this page has no pool address: deploy one from the connected wallet, or paste one. */
export function DeployPanel({ onPool }: { onPool: (a: Address) => void }) {
  const { isConnected, chainId } = useAccount();
  const config = useConfig();
  const { deployContractAsync } = useDeployContract();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const ready = isConnected && chainId === chain.id;

  async function deploy() {
    setBusy(true);
    try {
      setNote("Confirm the deployment in your wallet.");
      const hash = await deployContractAsync({ abi: squeekYieldAbi, bytecode: squeekYieldBytecode, args: [SQUEEK_CORE] });
      setNote("Waiting for Sepolia to include the deployment.");
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (!receipt.contractAddress) throw new Error("The deployment did not create a contract.");
      onPool(receipt.contractAddress);
    } catch (e) {
      setNote(errorLine(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="deploy-title" className="card flex flex-col gap-4">
      <h2 id="deploy-title" className="text-lg font-semibold">Set up the pool</h2>
      <p className="text-base text-muted">
        This page has no SqueekYield pool yet. Deploy one on {chain.name} from your wallet in one transaction, then share the
        link it gives you.
      </p>
      <button className="btn btn-primary w-full" onClick={deploy} disabled={!ready || busy}>
        {busy ? "Deploying…" : "Deploy pool"}
      </button>
      {!ready && <p className="text-sm text-muted">Connect a wallet on {chain.name} to deploy.</p>}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => { e.preventDefault(); if (isAddress(paste.trim())) onPool(paste.trim() as Address); else setNote("That is not a contract address. It starts with 0x and has 40 more characters."); }}
      >
        <label htmlFor="pool-address" className="text-sm text-muted">Or use a deployed pool</label>
        <div className="flex gap-2">
          <input id="pool-address" className="field min-w-0 flex-1" placeholder="0x…" value={paste} onChange={(e) => setPaste(e.target.value)} autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn btn-quiet">Use</button>
        </div>
      </form>
      <p className="min-h-5 text-sm text-muted" role="status" aria-live="polite">{note}</p>
    </section>
  );
}
