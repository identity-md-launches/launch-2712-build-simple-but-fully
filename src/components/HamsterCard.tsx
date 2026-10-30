"use client";

import { isSpinning, useHamster } from "@/lib/hamster";

/** Live wheel telemetry from the SqueekChain status API. */
export function HamsterCard({ onChainWork }: { onChainWork?: bigint }) {
  const { data, isError, isPending } = useHamster();
  const spinning = data ? isSpinning(data) : false;
  const online = data?.freshness === "online";
  const state = isPending ? "Checking…" : isError || !data ? "Status unavailable" : !online ? "Wheel offline" : spinning ? "Spinning" : "Idle";

  return (
    <section aria-labelledby="hamster-title" className="card flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Wheel spinning={spinning && online} />
        <div className="min-w-0">
          <h2 id="hamster-title" className="text-lg font-semibold">Hamster</h2>
          <p className="flex items-center gap-2 text-base" aria-live="polite">
            <span className={`size-2 rounded-full ${spinning && online ? "bg-good" : "bg-muted"}`} aria-hidden />
            {state}
          </p>
        </div>
        <p className="ms-auto text-end">
          <span className="block text-2xl font-semibold tabular-nums">{data ? data.rpm.toFixed(1) : "–"}</span>
          <span className="text-sm text-muted">RPM</span>
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
        <div>
          <dt className="text-sm text-muted">Speed</dt>
          <dd className="tabular-nums">{data ? `${(data.speedMmPerSecond / 1000).toFixed(2)} m/s` : "–"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Distance run</dt>
          <dd className="tabular-nums">{data ? `${(data.distanceMm / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} km` : "–"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Work settled on Sepolia</dt>
          <dd className="tabular-nums">{onChainWork !== undefined ? onChainWork.toLocaleString("en-US") : "–"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Last reading</dt>
          <dd className="tabular-nums">{data?.observedAt ? new Date(data.observedAt).toLocaleTimeString() : "–"}</dd>
        </div>
      </dl>
    </section>
  );
}

function Wheel({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden className={`shrink-0 text-accent ${spinning ? "wheel-spin" : ""}`}>
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="4" fill="currentColor" />
      {[0, 45, 90, 135].map((a) => (
        <line key={a} x1="24" y1="3" x2="24" y2="45" stroke="currentColor" strokeWidth="2" transform={`rotate(${a} 24 24)`} />
      ))}
    </svg>
  );
}
