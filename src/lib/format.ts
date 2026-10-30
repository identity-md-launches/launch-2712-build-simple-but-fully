import { formatUnits } from "viem";

/** Token amount with at most `digits` decimals and grouping, e.g. 1,234.5678 */
export function fmtToken(value: bigint | undefined, digits = 4): string {
  if (value === undefined) return "–";
  const n = Number(formatUnits(value, 18));
  return n.toLocaleString("en-US", { maximumFractionDigits: n !== 0 && n < 1 ? 6 : digits });
}

export const fmtApy = (bps: bigint | undefined) => (bps === undefined ? "–" : `${(Number(bps) / 100).toFixed(2)}%`);

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** The first line of a wallet or contract error, without viem's stack of details. */
export function errorLine(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string };
  if (err?.name === "UserRejectedRequestError" || /rejected|denied/i.test(err?.message ?? "")) return "You rejected the request in your wallet.";
  if (/FaucetCooldown/.test(err?.message ?? "")) return "The faucet gives 1,000 SEED once an hour. Try again later.";
  return (err?.shortMessage ?? err?.message ?? "Something went wrong.").split("\n")[0];
}
