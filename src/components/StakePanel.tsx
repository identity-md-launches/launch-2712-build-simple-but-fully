"use client";

import { useState } from "react";
import { maxUint256, parseUnits, zeroAddress, type Address } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { seedTokenAbi, squeekYieldAbi } from "@/lib/abi.generated";
import { chain, ETHERSCAN } from "@/lib/config";
import { fmtApy, fmtToken } from "@/lib/format";
import { useTx } from "@/lib/useTx";

type Mode = "deposit" | "withdraw";

export type Overview = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];

function parseAmount(text: string): bigint | undefined {
  if (!/^\d*\.?\d{0,18}$/.test(text) || text === "" || text === ".") return undefined;
  try {
    const v = parseUnits(text, 18);
    return v > 0n ? v : undefined;
  } catch {
    return undefined;
  }
}

export function StakePanel({ pool, overview, token, refetch }: { pool: Address; overview?: Overview; token?: Address; refetch: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const ready = isConnected && chainId === chain.id && !!token;
  const [mode, setMode] = useState<Mode>("deposit");
  const [text, setText] = useState("");
  const { writeContractAsync } = useWriteContract();
  const tx = useTx();

  const [apy, , , staked, pending, balance, allowance] = overview ?? [];
  const amount = parseAmount(text);
  const limit = mode === "deposit" ? balance : staked;
  const tooMuch = amount !== undefined && limit !== undefined && amount > limit;
  const needsApproval = mode === "deposit" && amount !== undefined && allowance !== undefined && allowance < amount;

  const after = async (ok: boolean) => { refetch(); if (ok) setText(""); };

  async function submit() {
    if (!amount || !token) return;
    const steps = [];
    if (needsApproval) {
      steps.push({ label: "Approve SEED", send: () => writeContractAsync({ address: token, abi: seedTokenAbi, functionName: "approve", args: [pool, maxUint256] }) });
    }
    steps.push(
      mode === "deposit"
        ? { label: "Deposit", send: () => writeContractAsync({ address: pool, abi: squeekYieldAbi, functionName: "deposit", args: [amount] }) }
        : { label: "Withdraw", send: () => writeContractAsync({ address: pool, abi: squeekYieldAbi, functionName: "withdraw", args: [amount] }) },
    );
    after(await tx.run(steps, mode === "deposit" ? `Deposited ${fmtToken(amount)} SEED.` : `Withdrew ${fmtToken(amount)} SEED.`));
  }

  async function claim() {
    after(await tx.run([{ label: "Claim", send: () => writeContractAsync({ address: pool, abi: squeekYieldAbi, functionName: "claim" }) }], "Rewards claimed to your wallet."));
  }

  async function faucet() {
    if (!token) return;
    after(await tx.run([{ label: "Faucet", send: () => writeContractAsync({ address: token, abi: seedTokenAbi, functionName: "faucet" }) }], "1,000 test SEED sent to your wallet."));
  }

  const action = mode === "deposit" ? (needsApproval ? "Approve and deposit" : "Deposit") : "Withdraw";
  const hint = !isConnected
    ? "Connect a wallet to stake."
    : chainId !== chain.id
      ? `Switch your wallet to ${chain.name} to stake.`
      : tooMuch
        ? `That is more than your ${mode === "deposit" ? "wallet balance" : "staked amount"}.`
        : text && amount === undefined
          ? "Enter an amount above zero, like 100 or 2.5."
          : "";

  return (
    <section aria-labelledby="stake-title" className="card flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="stake-title" className="text-lg font-semibold">Your position</h2>
        <p className="text-end">
          <span className="text-2xl font-semibold tabular-nums text-accent-ink">{fmtApy(apy)}</span>{" "}
          <span className="text-sm text-muted">APY now</span>
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Wallet" value={address ? fmtToken(balance, 2) : "–"} />
        <Stat label="Staked" value={address ? fmtToken(staked, 2) : "–"} />
        <Stat label="Rewards" value={address ? fmtToken(pending, 4) : "–"} />
      </dl>

      <div role="radiogroup" aria-label="Action" className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className="seg" onClick={() => { setMode(m); setText(""); }}>
            {m === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="amount" className="text-sm text-muted">
          Amount of SEED to {mode}
        </label>
        <div className="flex gap-2">
          <input
            id="amount"
            className="field min-w-0 flex-1 tabular-nums"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.0"
            value={text}
            onChange={(e) => setText(e.target.value.replace(",", "."))}
            aria-invalid={tooMuch || (!!text && amount === undefined)}
            aria-describedby="amount-hint"
          />
          <button type="button" className="btn btn-quiet" disabled={!limit} onClick={() => limit !== undefined && setText(String(Number(limit) / 1e18 === 0 ? "" : formatExact(limit)))}>
            Max
          </button>
        </div>
        <p id="amount-hint" className="min-h-5 text-sm text-muted">{hint}</p>
        <button type="submit" className="btn btn-primary w-full" disabled={!ready || !amount || tooMuch || tx.busy}>
          {tx.busy ? "Working…" : action}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-quiet" onClick={claim} disabled={!ready || !pending || tx.busy}>Claim rewards</button>
        <button className="btn btn-quiet" onClick={faucet} disabled={!ready || tx.busy}>Get test SEED</button>
      </div>

      <p className={`min-h-5 text-sm ${tx.tone === "bad" ? "text-danger" : tx.tone === "good" ? "text-good" : "text-muted"}`} role="status" aria-live="polite">
        {tx.note}
        {tx.hash && (
          <>
            {" "}
            <a className="link" href={`${ETHERSCAN}/tx/${tx.hash}`} target="_blank" rel="noreferrer">View transaction</a>
          </>
        )}
      </p>
    </section>
  );
}

const formatExact = (v: bigint) => {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-paper p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums" title={value}>{value}</dd>
    </div>
  );
}

/** Reads the pool and its token for the connected address, refreshed every 8 seconds. */
export function usePool(pool: Address | undefined) {
  const { address } = useAccount();
  const enabled = !!pool;
  const overview = useReadContract({
    address: pool, abi: squeekYieldAbi, functionName: "overview", args: [address ?? zeroAddress], chainId: chain.id,
    query: { enabled, refetchInterval: 8_000 },
  });
  const token = useReadContract({ address: pool, abi: squeekYieldAbi, functionName: "token", chainId: chain.id, query: { enabled } });
  return { overview: overview.data as Overview | undefined, token: token.data as Address | undefined, error: overview.error, isLoading: overview.isLoading, refetch: () => void overview.refetch() };
}
