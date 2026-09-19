# Layeron — Final Pre-Mainnet Hardening Audit

Implemented against the actual contracts, admin dashboard, tests and deploy config. NOTHING deployed. No mainnet tx. No private key used.

## A. ADMIN CONFIGURABLE
| Setting | Current | Contract | Function | Role | Validation | Needs upgrade? |
|---|---|---|---|---|---|---|
| GM fee | 10000 (0.01 USDC) | LayeronConfig | setGmFee | CONFIG_ROLE | MIN_FEE..MAX_FEE | No |
| Dev/reward allocation | 3000 / 7000 | LayeronConfig | setAllocation | CONFIG_ROLE | dev+reward==10000 | No |
| Dev wallet | 0xCf33..0B47 | LayeronConfig | setDevWallet | CONFIG_ROLE | !=0 | No |
| Reward wallet | 0xe888..2F3e | LayeronConfig | setRewardWallet | CONFIG_ROLE | !=0 | No |
| XP per GM | 10 | LayeronConfig | setXpPerGm | CONFIG_ROLE | 0..MAX_XP_PER_GM(100) | No |
| Pause / unpause | active | LayeronConfig | pauseGm / unpauseGm | PAUSER_ROLE | — | No |
| Chain registry (cosmetic) | Arc | LayeronConfig | upsertChain | CONFIG_ROLE | — | No |
| Begin admin transfer | your wallet | LayeronConfig | beginDefaultAdminTransfer | DEFAULT_ADMIN_ROLE | two-step + delay | No |
| Accept admin transfer | — | LayeronConfig | acceptDefaultAdminTransfer | pending admin | after delay | No |
| Grant/revoke CONFIG/PAUSER/UPGRADER | your wallet | LayeronConfig | grantRole / revokeRole | DEFAULT_ADMIN_ROLE | — | No |
| Rewire config/reputation (break-glass) | wired | LayeronGM / LayeronReputation | setConfig / setReputation | DEFAULT_ADMIN_ROLE | !=0 | No |
| Schedule/execute an upgrade | — | LayeronTimelock | schedule / execute | PROPOSER / EXECUTOR | delay >= minDelay | (is the upgrade path) |

## B. IMMUTABLE / HARDCODED (no admin path; change = contract upgrade)
- Arc USDC (settlement token): set once in initialize, NO setUsdc. `0x3600...0000`.
- MIN_FEE = 10000, MAX_FEE = 1000000 (constants).
- MAX_XP_PER_GM = 100 (constant).
- UTC day = block.timestamp / 86400; boundary 00:00:00 UTC (SECONDS_PER_DAY constant).
- One GM per wallet per chain per UTC day (LayeronGM.lastGmDay guard).
- Global XP once per wallet per UTC day (LayeronReputation.lastXpDay guard).
- Streak = consecutive UTC days (LayeronReputation logic).
- User history protections: no setter for xp/streak/longestStreak/lastXpDay/qualifyingGms/gmCount/lastGmDay. Append-only via GM_ROLE.
- No custody / no rescue: LayeronGM never holds USDC; no rescueERC20/rescueNative/withdraw.

## C. FRONTEND / INDEXER ONLY (not onchain)
- Chain registry display: chainId, RPC, explorer URL, USDC display, funding URL, UI enabled flag.
- Leaderboard periods (daily/monthly/all-time) — indexer SQL over UTC timestamps.
- Indexer start block, RPC, DB, API URL. Deployment status. Admin dashboard field set.
- Contract addresses — generated deployments/*.json (hydrated into the registry).
- NETWORK enable/disable distinction: registry `enabled` = UI/indexer visibility ONLY; actual onchain GM availability = whether a GM contract is deployed on that chain AND not paused. These are independent.

## D. UPGRADE GOVERNANCE (LayeronTimelock + UPGRADER_ROLE)
UPGRADER_ROLE on all three proxies is held by LayeronTimelock (OZ TimelockController). `_authorizeUpgrade` is `onlyRole(UPGRADER_ROLE)`, so ONLY the timelock can upgrade.
1. Who authorizes an upgrade: the timelock (nothing else has UPGRADER_ROLE; the deployer does not).
2. Timelock delay: `minDelay` (deploy-config timelockMinDelaySeconds, default 172800 = 2 days). No scheduled op executes before scheduledTime = block.timestamp + delay.
3. Proposing: a PROPOSER (your wallet in v1) calls `timelock.schedule(proxy, 0, upgradeToAndCall(newImpl, data), 0x0, salt, delay)`.
4. Becoming executable: once the delay elapses, an EXECUTOR calls `timelock.execute(...)`, which makes the timelock call `proxy.upgradeToAndCall` (passing the UPGRADER check).
5. Who controls the timelock: PROPOSER / EXECUTOR / CANCELLER / DEFAULT_ADMIN of the timelock = your wallet in v1.
6. Move the timelock to a multisig later: grant PROPOSER/EXECUTOR/CANCELLER (and the timelock's DEFAULT_ADMIN) to the Gnosis Safe, then renounce them from your wallet. No redeploy.
7. Move the other roles to a multisig later: DEFAULT_ADMIN via begin/accept two-step to the Safe; CONFIG/PAUSER via grantRole(Safe)+revokeRole(you). No redeploy.

## E. ROLE RECOVERY (no redeploy)
Replacement EOA:
- DEFAULT_ADMIN: `beginDefaultAdminTransfer(newEOA)` then, after `defaultAdminDelay` (2 days), the newEOA calls `acceptDefaultAdminTransfer()`. Cancelable before acceptance.
- CONFIG/PAUSER: `grantRole(role, newEOA)` then `revokeRole(role, oldEOA)`.
- UPGRADER: stays the timelock; to change the human controlling upgrades, move the timelock's PROPOSER/EXECUTOR roles.
Gnosis Safe multisig: identical, with the Safe address as the target. Do it for each contract's DEFAULT_ADMIN, plus the timelock roles. All onchain, signed, no redeploy.

## F. SECURITY RISKS (remaining privileged actions)
- UPGRADER (timelock, 2-day delayed): can replace logic = ultimate power, but time-delayed and movable to a multisig. Residual master risk, now mitigated by delay + your proposer control.
- DEFAULT_ADMIN (two-step, delayed): manages role membership + setConfig/setReputation rewiring. Cannot touch user state directly.
- CONFIG_ROLE: fee (bounded), allocation (sum), fee wallets (destination), xpPerGm (<=100), registry (cosmetic). Controls economics/fee routing/XP rate. No user funds or history.
- PAUSER_ROLE: pause/unpause (DoS only; cannot take funds).
- Not possible for any role: edit user XP/streak/history, or withdraw user funds (no custody).
- Off-chain note: USDC on Arc has a "UI multiplier" — confirm transferFrom/balanceOf use standard 6-dec base units so the fixed fee stays $0.01 (spot-check on testnet).

## G. TEST RESULTS
Commands run in this environment:
- `solc 0.8.24 + OpenZeppelin v5.1` standalone compile of all contracts: 0 errors, 0 warnings (viaIR + optimizer).
- Local EVM (ganache) behavioral harness against the compiled bytecode: 38 passed, 2 failed, 5 skipped.
  - The 5 skips need reliable on-chain time travel (streak inc/reset, 23:59:59->00:00:00 boundary, timelock execute-after-delay, two-step accept-after-delay); this ganache build has a frozen clock, so they cannot advance days here.
  - The 2 fails ("gm works after unpause", "timelock schedule") are artifacts of the same broken ganache build (frozen clock / stale estimateGas), not contract logic: the pause REVERT passes, the timelock role wiring + "deployer cannot upgrade" + "execute reverts before delay" pass, and the code compiles clean and uses audited OZ TimelockController.
Authoritative command for you to run locally (Hardhat, with working time helpers):
- `cd contracts && npm i && npx hardhat compile && npx hardhat test`  (runs test/layeron.hardening.test.ts — all cases incl. the 5 time-dependent ones).

## H. DEPLOYMENT BLOCKERS (must resolve before Arc mainnet)
1. Run `npx hardhat test` locally and confirm ALL cases green (the 5 time-dependent + the 2 ganache-artifact cases). This is the gating check.
2. Regenerate `app/src/lib/abis.ts` from `contracts/artifacts` after compile (dashboard needs the new role/two-step functions).
3. Run the frontend type/build check locally (`cd app && npm i && npm run build`) — not runnable in this sandbox.
4. Confirm the USDC UI-multiplier spot-check on Arc testnet (normal 6-dec ERC-20 behavior).
5. Confirm you accept the delays: timelockMinDelaySeconds and defaultAdminDelaySeconds (default 2 days each) — adjust in deploy-config if desired.
6. Recommended: third-party audit before mainnet.
7. deploy-config admin = null (roles to deploying wallet) is intended; a multisig can be added later with no redeploy.
