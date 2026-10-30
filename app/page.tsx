"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { ConnectSheet } from "@/components/ConnectSheet";
import { DeployPanel } from "@/components/DeployPanel";
import { HamsterCard } from "@/components/HamsterCard";
import { StakePanel, usePool } from "@/components/StakePanel";
import { ETHERSCAN, rememberPool, resolvePool, SQUEEK_CORE } from "@/lib/config";
import { short } from "@/lib/format";

export default function Home() {
  const [pool, setPool] = useState<Address | undefined>(undefined);
  const [resolved, setResolved] = useState(false);
  useEffect(() => { setPool(resolvePool()); setResolved(true); }, []);
  const { overview, token, error, refetch } = usePool(pool);

  const choose = (a: Address) => { rememberPool(a); setPool(a); };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex items-center justify-between gap-3">
        <a href="./" className="flex items-center gap-2 text-lg font-semibold">
          <img src="./favicon.svg" width={28} height={28} alt="" />
          SqueekYield
        </a>
        <ConnectSheet />
      </header>

      <main className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="flex flex-col gap-3 lg:pt-6">
          <h1 className="text-4xl font-semibold text-balance">Earn while the hamster runs</h1>
          <p className="max-w-[46ch] text-base text-muted text-pretty">
            Stake test SEED on Sepolia. The APY follows the hamster work SqueekCore settles on-chain.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:row-span-2">
          {!resolved ? (
            <div className="card min-h-80" aria-busy="true" />
          ) : pool ? (
            <>
              <StakePanel pool={pool} overview={overview} token={token} refetch={refetch} />
              {error && <p className="text-sm text-danger" role="alert">Unable to read the pool at {short(pool)}. Check that it is a SqueekYield contract on Sepolia.</p>}
            </>
          ) : (
            <DeployPanel onPool={choose} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <HamsterCard onChainWork={overview?.[1]} />
          <section aria-labelledby="how-title" className="flex flex-col gap-2 text-base">
            <h2 id="how-title" className="text-lg font-semibold">How rewards work</h2>
            <p className="text-muted">
              Each staked SEED earns 5% a year plus 0.0000001 SEED per unit of wheel work SqueekCore settles.
            </p>
            <p className="text-muted">The pool mints rewards, so other stakers never dilute your rate. SEED is a test token.</p>
          </section>
        </div>
      </main>

      <footer className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm text-muted">
        {pool && <a className="link" href={`${ETHERSCAN}/address/${pool}`} target="_blank" rel="noreferrer">Pool {short(pool)}</a>}
        {token && <a className="link" href={`${ETHERSCAN}/token/${token}`} target="_blank" rel="noreferrer">SEED {short(token)}</a>}
        <a className="link" href={`${ETHERSCAN}/address/${SQUEEK_CORE}`} target="_blank" rel="noreferrer">SqueekCore {short(SQUEEK_CORE)}</a>
        <a className="link" href="https://api.squeekchain.com/v1/status" target="_blank" rel="noreferrer">Status API</a>
      </footer>
    </div>
  );
}
