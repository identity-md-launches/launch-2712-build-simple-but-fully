"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { chain } from "@/lib/config";
import { errorLine, short } from "@/lib/format";
import { OPEN_IN, isMobileBrowser } from "@/lib/open-in";
import { WALLET_ICONS } from "@/lib/wallet-icons";

const svgSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** The connect control and its sheet: the site's own type and colors, the network's structure. */
export function ConnectSheet() {
  const [mobile, setMobile] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, variables, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMobile(isMobileBrowser()), []);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (isConnected) setOpen(false); }, [isConnected]);

  const close = () => { setOpen(false); reset(); opener.current?.focus(); };

  // EIP-6963 names each installed extension; wagmi's generic injected row is only for a browser
  // where discovery found nothing, and then it is called what it is.
  const named = connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const listed = [...connectors.filter((c) => c.type === "injected"), ...connectors.filter((c) => c.type !== "injected")]
    .filter((c) => !(c.id === "injected" && named));
  const label = (c: Connector) =>
    c.id === "injected" ? "Browser wallet" : c.id === "coinbaseWalletSDK" && mobile ? "Coinbase Smart Wallet" : c.name;
  const icon = (c: Connector) => c.icon ?? (WALLET_ICONS[c.id] ? svgSrc(WALLET_ICONS[c.id]!) : undefined);

  if (isConnected && address) {
    if (chainId !== chain.id) {
      return (
        <button className="btn btn-primary" onClick={() => switchChain({ chainId: chain.id })} disabled={switching}>
          {switching ? "Switching…" : `Switch to ${chain.name}`}
        </button>
      );
    }
    return (
      <button className="btn btn-quiet tabular-nums" onClick={() => disconnect()} title="Disconnect">
        {short(address)}
        {/* Below 640px the header has room for the address only; the name still says what it does. */}
        <span className="max-sm:sr-only"> · Disconnect</span>
      </button>
    );
  }
  return (
    <>
      <button ref={opener} className="btn btn-primary" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Connect
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={close}>
          <div
            className="w-full max-w-[420px] rounded-t-2xl bg-surface p-4 shadow-lift sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 id="connect-title" className="text-lg font-semibold">Connect a wallet</h2>
              <button ref={closeRef} className="btn-icon" aria-label="Close" onClick={close}>×</button>
            </div>
            <ul className="flex flex-col gap-1">
              {mobile && OPEN_IN.map((w) => (
                <li key={w.id}>
                  <a className="wallet-row" href={w.href(location.href)}>
                    <img width={28} height={28} className="rounded-md" src={svgSrc(WALLET_ICONS[w.id]!)} alt="" />
                    <span>Open in {w.name}</span>
                  </a>
                </li>
              ))}
              {listed.filter((c) => !mobile || c.type !== "injected").map((c) => {
                const src = icon(c);
                return (
                  <li key={c.uid}>
                    <button className="wallet-row" onClick={() => connect({ connector: c })} disabled={isPending}>
                      {src ? <img width={28} height={28} className="rounded-md" src={src} alt="" /> : <span className="size-7 rounded-md bg-line" aria-hidden />}
                      <span>{label(c)}{isPending && variables?.connector === c ? " · opening…" : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && <p className="mt-2 text-sm text-danger" role="status">{errorLine(error)}</p>}
          </div>
        </div>
      )}
    </>
  );
}
