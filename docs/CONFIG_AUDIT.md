# Layeron — Admin Configurability & Safety Audit (pre Arc-mainnet)

Audited against the actual contracts (LayeronConfig, LayeronGM, LayeronReputation), the admin dashboard (Admin.tsx / adminActions.ts) and the deployment architecture. No deployment performed.

## Headline findings
1. No admin function can edit user XP, streak, longest streak, lastXpDay, qualifyingGms, gmCount, lastGmDay or GM history. Reputation is append-only via GM_ROLE. GOOD.
2. LayeronGM holds no USDC (fees transferFrom straight to dev/reward each tx). No custody -> nothing to drain, no rescue needed. GOOD.
3. UPGRADER_ROLE is the master key: UUPS upgrade can replace logic and bypass every guarantee above. In v1 it is a single EOA. Govern this first.
4. setXpPerGm has no upper bound. setUsdc can swap the settlement token. setConfig/setReputation can rewire the contracts. All admin-only, but real surface.

## Master table
Columns: Setting | Configurable after deploy | Onchain/Frontend | Current value | No-upgrade change | Who can change | Limits/validation | v1 rec

### Network & chain
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| Chain id (UI) | Yes | Frontend | 5042 | Yes | dev (registry) | — | D |
| RPC url | Yes | Frontend | rpc.mainnet.arc.io | Yes | dev (env) | — | D |
| USDC address (settlement) | Yes | Onchain LayeronConfig.setUsdc | 0x3600..0000 | Yes | CONFIG_ROLE | !=0 only | C (make immutable) |
| USDC address (UI display) | Yes | Frontend | 0x3600..0000 | Yes | dev (registry) | — | D |
| Explorer url | Yes | Frontend | arc.etherscan.io | Yes | dev (registry) | — | D |
| Network enable/disable (real) | Yes | Onchain pause on that chain's GM | active | Yes | PAUSER_ROLE | — | A |
| Network enable/disable (registry flag) | Yes | Onchain LayeronConfig.upsertChain | Arc enabled | Yes | CONFIG_ROLE | cosmetic only | B |
| Future chain registration | Yes | Onchain upsertChain + new deploy | n/a | Yes | CONFIG_ROLE + deploy | — | B |

### Fees
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| GM fee | Yes | Onchain LayeronConfig.setGmFee | 10000 (0.01 USDC) | Yes | CONFIG_ROLE | MIN_FEE..MAX_FEE | A |
| Minimum fee | No | Onchain constant MIN_FEE | 10000 | No | nobody | constant | E |
| Maximum fee | No | Onchain constant MAX_FEE | 1000000 | No | nobody | constant | E |
| Dev allocation (bps) | Yes | Onchain setAllocation | 3000 | Yes | CONFIG_ROLE | dev+reward==10000 | A |
| Reward allocation (bps) | Yes | Onchain setAllocation | 7000 | Yes | CONFIG_ROLE | dev+reward==10000 | A |
| Dev wallet | Yes | Onchain setDevWallet | 0xCf33..0B47 | Yes | CONFIG_ROLE | !=0 | A |
| Reward wallet | Yes | Onchain setRewardWallet | 0xe888..2F3e | Yes | CONFIG_ROLE | !=0 | A |

### Admin / security
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| Admin wallet (roles) | Yes | Onchain AccessControl grant/renounce | your wallet | Yes | DEFAULT_ADMIN_ROLE | role-gated | A |
| Multisig | Yes (later) | Onchain transfer-roles.ts | none (v1) | Yes | DEFAULT_ADMIN_ROLE | — | B |
| Transfer admin role | Yes | Onchain grantRole/renounceRole | — | Yes | DEFAULT_ADMIN_ROLE | — | B |
| Transfer config role | Yes | Onchain grant/renounce CONFIG_ROLE | — | Yes | DEFAULT_ADMIN_ROLE | — | B |
| Pause / unpause GM | Yes | Onchain pauseGm/unpauseGm | not paused | Yes | PAUSER_ROLE | — | A |
| Upgrade authorization | Yes | Onchain _authorizeUpgrade | your wallet | Yes | UPGRADER_ROLE | role-gated | B (move to timelock) |
| Role management | Yes | Onchain grant/revoke/renounce | your wallet | Yes | DEFAULT_ADMIN_ROLE | — | A/B |
| Rewire config (GM/Reputation) | Yes | Onchain setConfig | wired | Yes | DEFAULT_ADMIN_ROLE | !=0 | C-ish (break-glass) |
| Rewire reputation (GM) | Yes | Onchain setReputation | wired | Yes | DEFAULT_ADMIN_ROLE | !=0 | C-ish (break-glass) |

### Reputation & rewards
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| XP per GM | Yes | Onchain setXpPerGm | 10 | Yes | CONFIG_ROLE | NONE (no max) | A (add a max) |
| Streak rules | No | Onchain logic (Reputation) | consecutive-day | No | nobody | hardcoded | E |
| Daily GM rule | No | Onchain logic (GM) | 1/wallet/UTC day | No | nobody | hardcoded | E |
| Global XP once/UTC day | No | Onchain logic (Reputation) | lastXpDay guard | No | nobody | hardcoded | E |
| User XP / streak / history | No | Onchain (no setter) | per-user | — | NOBODY | immutable | C |
| Reward pool / distribution | n/a v1 | future LayeronRewards | disabled | — | — | not built | B |
| XP caps / decay | No | none | none | No | nobody | none | E if wanted |

### GM configuration
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| One GM per chain per UTC day | No | Onchain (GM.lastGmDay) | enforced | No | nobody | hardcoded | E |
| Global XP qual per UTC day | No | Onchain (Reputation.lastXpDay) | enforced | No | nobody | hardcoded | E |
| Supported chains (real) | Yes | deploy contracts per chain | Arc only | Yes | deploy + CONFIG | — | B |
| GM enable/disable per chain | Yes | Onchain pause on that chain | active | Yes | PAUSER_ROLE | — | A |
| Cooldown / anti-abuse | No | Onchain (once/day) | once/day only | No | nobody | hardcoded | E |
| UTC day boundary | No | Onchain SECONDS_PER_DAY | 86400 / 00:00 UTC | No | nobody | constant | E |

### Treasury & funds
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| Fee recipient wallets | Yes | Onchain setDev/RewardWallet | set | Yes | CONFIG_ROLE | !=0 | A |
| Withdrawal controls | n/a | none (no custody) | n/a | — | — | contract holds no funds | — |
| Rescue / token recovery | No | none (not implemented) | absent | No | nobody | — | B (optional) |
| Native token recovery | No | none | absent | No | nobody | — | B (optional) |
| Accounting params | No | totals are counters | totalGms/Usdc | No | nobody | append-only | C |

### Frontend / indexer / admin
| Setting | Cfg after deploy | On/Front | Current | No-upgrade | Who | Limits | v1 rec |
|---|---|---|---|---|---|---|---|
| Leaderboard config | Yes | Indexer/API | SQL | Yes | dev | — | D |
| Daily/monthly/all-time periods | Yes | Indexer SQL (UTC) | UTC day/month/all | Yes | dev | — | D |
| Indexer settings | Yes | Infra/env | start block, RPC, DB | Yes | dev | — | D |
| Admin dashboard fields | Yes | Frontend | current set | Yes | dev | — | D |
| Contract addresses | Yes | deployments/*.json | generated | Yes | deploy | — | D |
| Contract version | Yes (upgrade) | Onchain impl | v1 | No | UPGRADER_ROLE | — | E |
| Deployment status | Yes | off-chain | pre-deploy | Yes | dev | — | D |

## A–E classification
A. MUST be configurable in v1 (onchain, CONFIG/PAUSER_ROLE): GM fee (setGmFee), dev/reward allocation (setAllocation), dev wallet (setDevWallet), reward wallet (setRewardWallet), XP per GM (setXpPerGm — add a max), pause/unpause (pauseGm/unpauseGm), role/admin management (AccessControl).

B. SHOULD be configurable later: move roles to multisig (transfer-roles.ts), UPGRADER_ROLE -> Timelock, on-chain chain registry for new chains (upsertChain) + per-chain deploys, optional rescue function, future reward-pool settings (LayeronRewards).

C. SHOULD NEVER be admin configurable: user XP/streak/longestStreak/lastXpDay/qualifyingGms, user gmCount/lastGmDay/GM history (already no setters — keep it), the once-per-day and once-per-UTC-day rules, streak logic, fee MIN/MAX bounds. Treat setUsdc/setConfig/setReputation as break-glass only (or remove setUsdc).

D. FRONTEND/INDEXER config only: chain registry (rpc, explorer, chainId display, usdc display, funding url, UI enabled flag), leaderboard periods, indexer start block/RPC/DB, API URL, contract addresses (deployments json), admin dashboard field set, deployment status.

E. REQUIRES CONTRACT UPGRADE: fee MIN/MAX constants, SECONDS_PER_DAY / UTC boundary, one-per-day + XP-once-per-day + streak logic, fee-routing/custody model, adding a rescue function or an xpPerGm cap if not added before deploy, contract version, cross-chain XP finalization.

## Dangerous admin controls (flagged)
1. UPGRADER_ROLE (all 3 contracts) — master key; a malicious/compromised upgrade can rewrite user XP/streak/history or redirect funds. Mitigate: move UPGRADER to a Timelock (delay) and later a multisig; consider renouncing upgradeability once stable.
2. setXpPerGm — unbounded; admin can inflate future XP arbitrarily. Not retroactive. Add require(x <= MAX_XP).
3. setUsdc — admin can change the settlement token. Never needed on Arc (USDC fixed). Consider removing (make usdc immutable) to shrink surface.
4. setConfig (GM, Reputation) + setReputation (GM) — admin can rewire which config/reputation is used, changing economics or XP source. Keep as documented break-glass; be aware.
5. setDevWallet / setRewardWallet / setAllocation — admin controls 100% of fee revenue and the split (allocation may be 10000/0). Expected for a fee protocol; no user funds at risk.
6. pauseGm — admin can halt GM (DoS). Cannot take funds. Acceptable emergency control.
Not dangerous / good: no user-state setters; no custody so no drain/rescue risk; minimal per-tx USDC approval in the app (approves exactly the fee).

## What you may have missed
- Upgrade governance is the single most important control. Plan a Timelock for UPGRADER_ROLE even in v1.
- setUsdc immutability decision (recommend immutable for Arc).
- xpPerGm needs an upper bound.
- The on-chain chain registry (upsertChain.enabled) is cosmetic — it does NOT gate GM; real disable = pause; real enable = deploy contracts on that chain.
- No rescue function: tokens accidentally sent to a contract are stuck. Decide if you want a narrowly-scoped rescue (adds admin surface).
- Allocation can be 100/0 — add a reward floor if your community expects a guaranteed reward share.
- Sybil / multi-wallet farming is not prevented onchain (one-per-day is per wallet). Known limitation, not a config.
- Changing xpPerGm is not retroactive; leaderboards mix XP earned at different rates over time.

## Recommended before Arc mainnet
1. Add require(x <= MAX_XP_PER_GM) to setXpPerGm (one line).
2. Decide setUsdc: recommend removing it (immutable USDC) for Arc.
3. Deploy a Timelock and grant it UPGRADER_ROLE (keep DEFAULT_ADMIN/CONFIG/PAUSER on your wallet for day-to-day). Gives upgrade-delay safety without needing a multisig yet.
4. (Optional) Add a guarded rescueERC20/rescueNative that cannot touch reputation state.
Items 1-2 and 4 are contract changes, so decide now — after these, run compile + full test, then deploy.
