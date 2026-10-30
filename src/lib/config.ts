import { createConfig, fallback, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { isAddress, type Address } from "viem";

export const SITE_NAME = "SqueekYield";
export const SITE_DESCRIPTION =
  "Stake SEED on Sepolia and earn a yield that rises while the SqueekChain hamster runs.";

export const chain = sepolia;

/** Public Sepolia RPCs; the second is used when the first fails. */
export const PUBLIC_RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
] as const;

/** SqueekCore on Sepolia, the on-chain source of hamster work the pool reads. */
export const SQUEEK_CORE: Address = "0x74665dAecA35A2303e767E76a2FF1FB6F93e119f";

/** Live hamster telemetry, polled for the status card. */
export const SQUEEK_STATUS_URL = "https://api.squeekchain.com/v1/status";

/**
 * The deployed SqueekYield pool. Owner setting: put the address printed by
 * `forge script script/Deploy.s.sol` (or by the in-app deploy) here and rebuild. Until then a visitor
 * can open the page with `?pool=0x…`, or deploy one from the page.
 */
export const POOL_ADDRESS: Address | "" = "";

export const ETHERSCAN = "https://sepolia.etherscan.io";

const STORAGE_KEY = "squeekyield.pool";

/** The pool this page talks to: `?pool=` first, then the built-in address, then this browser's last deploy. */
export function resolvePool(): Address | undefined {
  if (typeof window === "undefined") return POOL_ADDRESS || undefined;
  const fromUrl = new URLSearchParams(window.location.search).get("pool");
  if (fromUrl && isAddress(fromUrl)) return fromUrl;
  if (POOL_ADDRESS) return POOL_ADDRESS;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved && isAddress(saved) ? saved : undefined;
}

export function rememberPool(address: Address) {
  window.localStorage.setItem(STORAGE_KEY, address);
  const url = new URL(window.location.href);
  url.searchParams.set("pool", address);
  window.history.replaceState(null, "", url);
}

export const config = createConfig({
  chains: [chain],
  // EIP-6963 discovery lists every installed extension under its own name
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: SITE_NAME })],
  transports: { [chain.id]: fallback(PUBLIC_RPC_URLS.map((url) => http(url))) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
