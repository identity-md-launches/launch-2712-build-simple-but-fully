"use client";

import { useState } from "react";
import type { Hash } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { errorLine } from "./format";

export type TxState = { busy: boolean; note: string; tone: "info" | "good" | "bad"; hash?: Hash };

/** Runs wallet steps one after another, waiting for each receipt, and keeps a one-line status. */
export function useTx() {
  const config = useConfig();
  const [state, setState] = useState<TxState>({ busy: false, note: "", tone: "info" });

  async function run(steps: Array<{ label: string; send: () => Promise<Hash> }>, done: string) {
    setState({ busy: true, note: "", tone: "info" });
    try {
      for (const step of steps) {
        setState({ busy: true, note: `${step.label}: confirm in your wallet`, tone: "info" });
        const hash = await step.send();
        setState({ busy: true, note: `${step.label}: waiting for Sepolia`, tone: "info", hash });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error(`${step.label} reverted on-chain.`);
      }
      setState((s) => ({ busy: false, note: done, tone: "good", hash: s.hash }));
      return true;
    } catch (e) {
      setState((s) => ({ busy: false, note: errorLine(e), tone: "bad", hash: s.hash }));
      return false;
    }
  }

  return { ...state, run };
}
