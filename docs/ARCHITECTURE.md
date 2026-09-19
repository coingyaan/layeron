# Layeron Production Architecture (chain-agnostic)

## Multi-chain model
The system is a **generic EVM application driven by a chain registry**, not a hardcoded Arc/Base/Robinhood system. Every per-chain difference (chain id, native gas token, RPC, USDC address, contract addresses, explorer, explorer tx-url format, funding url, enabled flag, metadata) is **configuration data** in `packages/chain-registry`. The app iterates `enabledChains()` and treats each through one EVM abstraction. There is no `if arc` / `if base` branching anywhere. Adding any EVM chain later = add config + deploy + register addresses + enable. v1 enables **Arc only**.

## Contracts (modular, UUPS)
LayeronConfig (fee + bounds + allocation + wallets + XP + chain registry + pause + roles), LayeronGM (one GM/wallet/UTC-day on its chain, USDC fee via SafeERC20, fee routing, reputation call, ReentrancyGuard, CEI), LayeronReputation (XP + streak + qualifying-GM state, append-only via GM_ROLE, no admin history setters). Chain id comes from `block.chainid`; contracts contain no chain names.

## XP + UTC (chain-agnostic rule)
`utcDay = block.timestamp / 86400`. One GM per chain per UTC day (LayeronGM). XP once per wallet per UTC day globally, enforced by `lastXpDay >= utcDay` in LayeronReputation — order of chains is irrelevant. v1 single-chain: Arc's reputation is authoritative. Multi-chain future: a canonical reputation ledger fed by a messaging layer (LayeronCrossChain) or indexer-settled XP; the guard already in place needs no rule change. Never localStorage/cookies/frontend.

## Upgradeability & config vs upgrade
UUPS. Config (no redeploy): fee, allocation, wallets, XP, active chains, pause. Upgrade (implementation): new reward/reputation/cross-chain logic. Storage gaps reserved; user history immutable.

## Admin security
RBAC (DEFAULT_ADMIN / CONFIG / PAUSER / UPGRADER) all to a multisig; UPGRADER behind a timelock recommended; PAUSER on an ops-multisig; deployer renounces everything post-deploy (transfer-roles.ts).

## Indexer / leaderboard
contracts → events → viem indexer → Postgres → API → frontend. Daily/monthly/all-time via SQL over event timestamps (UTC), never browser time. DB is a rebuildable cache; chain is truth.

## Frontend
Registry-driven wallet (wagmi chains built from `enabledChains()`), real GM flow (detect/switch network → balance → allowance → approve → gm → receipt → event → UI), explorer links via per-chain tx-url format, funding via universal jumper.xyz, wrong-network via registry, disconnect clears session. Visual design preserved from the approved prototype.

## Admin dashboard
Reads config contract + indexer overview; writes via signed onchain txs (confirm → signature → tx → receipt → re-read). No fake settings.

See MAINNET_CHECKLIST.md for required values and the deploy sequence.
