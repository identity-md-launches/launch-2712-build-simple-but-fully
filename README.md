# SqueekYield

A small staking dapp on Sepolia. Stake SEED, earn SEED. Every staked token earns a 5% base rate per
year plus a fixed reward for each unit of hamster work that SqueekCore
(`0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`) settles on-chain. So the APY goes up while the hamster
runs and drops back to 5% while it rests. The page also shows the live wheel status (RPM, spinning
or idle) from `https://api.squeekchain.com/v1/status`.

- `contracts/`: Foundry project with `SqueekYield.sol` (the pool), `SeedToken.sol` (the ERC-20 with
  a faucet; the pool deploys it and is its only minter), tests and a deploy script.
- `app/`, `src/`: the Next.js 16 + Tailwind 4 frontend (wagmi 3 + viem 2).
- `dist/`: the committed static export. Asset URLs are relative (`./_next/...`), so it works from an
  IPFS gateway subpath or an ENS name.
- `DESIGN.md`: design tokens, type, components and responsive behaviour.
- `artifacts/validation.md`: what was checked, the results, and the limitations.

## Deployment status: read this first

**No contract has been deployed to Sepolia yet, so there is no live address to give you.** Deploying
needs a funded Sepolia key, and this build machine had none I was allowed to use. I did not make up
an address or use a stand-in. Two ways to deploy, both take a few minutes:

1. **From the site.** Open the page, connect a wallet that holds some Sepolia ETH, and click
   **Deploy pool**. That sends one transaction (about 1.9M gas). The page then switches to the new
   pool and adds `?pool=0x…` to the URL. Share that link.
2. **With Foundry.**
   ```sh
   cd contracts
   forge script script/Deploy.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
     --broadcast --account <your-keystore-name>
   ```
   The script prints the `SqueekYield` and `SEED token` addresses.

After deploying, put the pool address into `POOL_ADDRESS` in `src/lib/config.ts` and rebuild. From
then on, every visitor sees that pool by default. Until you do, the page picks the pool in this order:
`?pool=` in the URL, then `POOL_ADDRESS`, then the last pool deployed from this browser.

A live link comes from the publisher, which pins the committed `dist/` after this job.

## How the rewards work

- `rewardIndex` grows by `BASE_RATE_PER_SECOND * dt + REWARD_PER_WORK * dWork`. `dWork` is the
  growth in `SqueekCore.state().cumulativeWork` since the last transaction. A position earns
  `staked * Δindex / 1e18`.
- The base rate is 5% a year. `REWARD_PER_WORK` is 1e-7 SEED per staked SEED per work unit. At the
  hamster's recent pace (about 9k units a day) that adds roughly 30% APY.
- `currentApyBps()` is the base rate plus the work settled since an older snapshot (kept at least an
  hour apart), annualised.
- Rewards are minted, not paid from a fixed budget, so the pool never runs dry and other stakers
  never dilute your rate.
- If the SqueekCore read fails or the core is paused, the pool counts zero work. Deposits,
  withdrawals and claims never depend on SqueekCore. Each jump in work is capped at SqueekCore's own
  limit (10,000 per 600 s round).
- `SeedToken.faucet()` gives 1,000 SEED per address once an hour. SEED is a test token with no value.

## Install, preview, rebuild

Requires Node 20+ (built with Node 24) and, for the contracts, Foundry.

```sh
npm ci                 # install the exact versions in package-lock.json
npm run preview        # serve the committed dist/ at http://localhost:4173
npm run dev            # dev server with hot reload
npm run build          # refresh the ABI from contracts/out if present, then export to dist/
npm run typecheck      # tsc --noEmit
cd contracts && forge test   # contract tests (forge-std sources are vendored in contracts/lib)
```

`npm run build` regenerates `src/lib/abi.generated.ts` from `contracts/out` when you have run
`forge build`. Otherwise it keeps the committed file. The build writes `public/og.png` and
`public/favicon.svg` into `dist/`.

The site uses the public Sepolia RPCs `https://ethereum-sepolia-rpc.publicnode.com` and, if that
fails, `https://sepolia.drpc.org` (`src/lib/config.ts`).

## Wallets

There is one **Connect** control. Desktop extensions are found by EIP-6963 and listed under their
own names and icons. Coinbase Wallet / Smart Wallet comes from wagmi's `coinbaseWallet()`. On a
phone with no injected wallet, the sheet offers "Open in MetaMask / Coinbase Wallet / Rabby /
Phantom". There is no WalletConnect relay and no project ID. If the wallet is on the wrong chain,
the control reads "Switch to Sepolia".

## Checks run (summary; full record in `artifacts/validation.md`)

| Command | Result |
| --- | --- |
| `cd contracts && forge test` | 10/10 passed |
| `npx tsc --noEmit` | passed, no errors |
| `npm run build` | passed; static export in `dist/` with relative URLs |
| Playwright end-to-end against an anvil fork of Sepolia (real SqueekCore state) | 15/15 passed: in-app deploy, connect, faucet, approve + deposit, over-balance guard, withdraw, rewards accrue, claim, APY, live hamster status, no 390px overflow, no console errors, Escape closes the sheet |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs` | 16/16 checks passed at 320/390/1440 |

Limitations: no transaction was sent on Sepolia itself, because there is no deployer key (see
above). The end-to-end run used a mock EIP-1193 wallet backed by anvil, not a real wallet extension
or phone. The Rabby "Open in" link format is unverified.
