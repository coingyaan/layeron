# Layeron (production)

Daily onchain GM + reputation. v1 on **Arc mainnet**, architected chain-agnostically for arbitrary EVM chains (only Arc enabled).

## Packages
- `packages/chain-registry/` — generic EVM registry (`registry.ts`) + deployment hydration. **The only place chains are defined.** No `if arc/base/robinhood` anywhere.
- `contracts/` — LayeronConfig / LayeronGM / LayeronReputation (UUPS), tests (`test/layeron.full.test.ts`), deploy/transfer-roles/verify scripts, deploy-config, generated deployments.
- `indexer/` — viem event indexer + Postgres schema + leaderboard queries + Express API. Rebuildable from events.
- `app/` — React/Vite frontend. Reuses the approved visual design (styles lifted into `src/styles/layeron.css`), wired to real wallet + GM flow + registry. `reference/` holds the approved prototype.

## Run locally (internal validation — NOT a public testnet campaign)
```
cd contracts && npm i && npx hardhat compile && npx hardhat test     # all §20 tests
cd ../indexer && npm i && npm run migrate                            # needs Postgres
cd ../app && npm i && npm run dev
```
Then follow `docs/MAINNET_CHECKLIST.md`.

## Adding a future EVM chain (no rewrite)
1. Add a config entry in `packages/chain-registry/src/registry.ts` (`enabled:false`).
2. Deploy the three contracts on that chain.
3. Register addresses via a generated `deployments/<chain>.json` + hydrate.
4. Flip `enabled:true`.
5. Verify USDC + infra. The frontend and core logic are unchanged.

## Guardrails honored
No hardcoded Arc/wallets/fee in the frontend; no fake tx state; no localStorage XP authority; historical reputation not admin-editable; deployer keeps no roles; Base/Robinhood not in active config; no rewards/NFT/factory in v1.
