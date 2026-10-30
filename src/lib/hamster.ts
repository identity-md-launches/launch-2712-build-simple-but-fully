import { useQuery } from "@tanstack/react-query";
import { SQUEEK_STATUS_URL } from "./config";

export type HamsterStatus = {
  freshness: string;
  observedAt: string;
  coreStatus: string;
  rpm: number;
  speedMmPerSecond: number;
  distanceMm: number;
  cumulativeWorkUnits: string;
};

type StatusResponse = { measurement?: Partial<Record<string, unknown>> };

export function parseStatus(body: StatusResponse): HamsterStatus {
  const m = body.measurement ?? {};
  return {
    freshness: String(m.freshness ?? "unknown"),
    observedAt: String(m.observedAt ?? ""),
    coreStatus: String(m.coreStatus ?? "UNKNOWN"),
    rpm: Number(m.rpmMilli ?? 0) / 1000,
    speedMmPerSecond: Number(m.speedMmPerSecond ?? 0),
    distanceMm: Number(m.distanceMm ?? 0),
    cumulativeWorkUnits: String(m.cumulativeWorkUnits ?? "0"),
  };
}

/** Spinning when the wheel reports any RPM or a non-idle core status. */
export const isSpinning = (s: HamsterStatus) => s.rpm > 0 || (s.coreStatus !== "IDLE" && s.coreStatus !== "UNKNOWN");

export function useHamster() {
  return useQuery({
    queryKey: ["squeek-status"],
    queryFn: async () => {
      const res = await fetch(SQUEEK_STATUS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Status API answered ${res.status}`);
      return parseStatus(await res.json());
    },
    refetchInterval: 5_000,
    retry: 1,
  });
}
