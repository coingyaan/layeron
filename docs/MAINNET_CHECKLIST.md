# Arc Mainnet Deployment Checklist

Do NOT run `deploy:mainnet` until every REQUIRED value below is filled and `npx hardhat test` passes locally. The deploy script itself refuses to run if allocation or the required config fields are missing — this list is the human confirmation.

## Values you must supply (not invented, not defaulted)
| # | Value | Where it goes | Status |
|---|-------|---------------|--------|
| 1 | **Fee allocation** devBps / rewardBps (sum = 10000) | `deploy-config/arc-mainnet.json` | **REQUIRED — you said you'll provide** |
| 2 | **Admin multisig** address (Gnosis Safe) | `deploy-config/arc-mainnet.json` `adminMultisig` | **REQUIRED** |
| 3 | **Arc chain id** | `.env` + registry | **REQUIRED** |
| 4 | **Arc RPC URL** | `.env` | **REQUIRED** |
| 5 | **Arc USDC address** (6 decimals) | `deploy-config` + `.env` | **REQUIRED** |
| 6 | **Arc explorer base URL** | `deploy-config` + `.env` | **REQUIRED** |
| 7 | **Deployer EOA** (gas only) | `.env DEPLOYER_PRIVATE_KEY` | your key |

## Already fixed (from spec)
- GM fee: 0.01 USDC = `10000` (min `10000`, max `1000000`)
- Dev wallet: `0xCf33E654BF6189546352eC1E871f8652dd670B47`
- Reward wallet: `0xe888dC2b798F246380750fddC47f91ceE9822F3e`
- XP per qualifying GM: `10`
- Funding: `https://jumper.xyz/`

## Confirm before deploy
- [ ] `npx hardhat test` — all §20 tests green
- [ ] deploy-config values 1–6 filled, allocation sums to 10000
- [ ] Arc chain id / RPC / USDC verified against a block explorer
- [ ] Multisig created, signers confirmed, threshold set
- [ ] Frontend `.env` + indexer `.env` prepared

## Deploy sequence
1. `cd contracts && npx hardhat run scripts/deploy.ts --network arcMainnet` → writes `deployments/arc-mainnet.json`.
2. `npx hardhat run scripts/transfer-roles.ts --network arcMainnet` → all roles to multisig; **deployer renounces**.
3. `npx hardhat run scripts/verify.ts --network arcMainnet` → verify on Arc explorer.
4. Copy `deployments/arc-mainnet.json` to `packages/chain-registry/deployments/`; copy compiled ABIs into `app/src/lib/abis.ts`.
5. Configure frontend + indexer envs from the generated deployment (no manual address copying elsewhere).
6. Start indexer + API; deploy frontend.

## Controlled mainnet smoke test (before public launch)
connect real wallet → verify network → verify USDC → approve 0.01 USDC → real GM → verify fee routing (dev + reward balances) → verify Gm event → verify XP → verify streak → verify leaderboard → verify explorer tx → verify admin dashboard read/write → verify disconnect clears session.

## Post-deploy role model
- `DEFAULT_ADMIN_ROLE`, `CONFIG_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE` → multisig.
- Recommended: `UPGRADER_ROLE` behind a Timelock; `PAUSER_ROLE` may sit on a faster ops-multisig.
- Deployer EOA holds nothing after step 2 — verify on-chain.
