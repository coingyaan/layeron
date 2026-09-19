import { ethers, upgrades, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy order: LayeronTimelock -> LayeronConfig -> LayeronReputation -> LayeronGM (UUPS proxies).
 * Roles (v1): DEFAULT_ADMIN + CONFIG + PAUSER = deploying wallet; UPGRADER_ROLE = LayeronTimelock.
 * DEFAULT_ADMIN uses a two-step, delayed transfer (AccessControlDefaultAdminRules).
 * Fails on: missing allocation, allocation != 10000, fee out of bounds, xp > 100, wrong chain id.
 */
async function main() {
  const cfgFile = network.name === "arcMainnet" ? "arc-mainnet.json" : "arc-testnet.json";
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deploy-config", cfgFile), "utf8"));

  for (const k of ["usdc", "explorerUrl"]) {
    if (!cfg[k] || String(cfg[k]).startsWith("REQUIRED")) throw new Error(`deploy-config.${k} must be set`);
  }
  if (cfg.devBps === null || cfg.rewardBps === null) throw new Error("deploy-config.devBps/rewardBps must be set");
  if (Number(cfg.devBps) + Number(cfg.rewardBps) !== 10000) throw new Error("devBps + rewardBps must equal 10000");
  if (Number(cfg.gmFee) < 10000 || Number(cfg.gmFee) > 1000000) throw new Error("gmFee out of [10000,1000000]");
  if (Number(cfg.xpPerGm) > 100) throw new Error("xpPerGm must be <= 100");

  const [deployer] = await ethers.getSigners();
  const netChainId = (await ethers.provider.getNetwork()).chainId;
  if (cfg.expectedChainId && Number(cfg.expectedChainId) !== Number(netChainId)) {
    throw new Error(`Wrong chain: connected ${netChainId}, expected ${cfg.expectedChainId}.`);
  }
  const admin: string = cfg.admin && !String(cfg.admin).startsWith("REQUIRED") ? cfg.admin : deployer.address;
  const adminDelay = Number(cfg.defaultAdminDelaySeconds || 172800);
  const tlDelay = Number(cfg.timelockMinDelaySeconds || 172800);
  console.log("deployer:", deployer.address, "| admin:", admin, "| chain:", netChainId.toString());

  // 1) Timelock (proposer/executor/admin = admin wallet in v1; move to a Safe later)
  const Timelock = await ethers.getContractFactory("LayeronTimelock");
  const timelock = await Timelock.deploy(tlDelay, [admin], [admin], admin);
  await timelock.waitForDeployment();
  const tlAddr = await timelock.getAddress();

  // 2) Config
  const Config = await ethers.getContractFactory("LayeronConfig");
  const config = await upgrades.deployProxy(Config,
    [admin, tlAddr, adminDelay, cfg.usdc, cfg.gmFee, cfg.devWallet, cfg.rewardWallet, cfg.devBps, cfg.rewardBps, cfg.xpPerGm],
    { kind: "uups" });
  await config.waitForDeployment();
  const configAddr = await config.getAddress();

  // 3) Reputation
  const Reputation = await ethers.getContractFactory("LayeronReputation");
  const reputation = await upgrades.deployProxy(Reputation, [admin, tlAddr, adminDelay, configAddr], { kind: "uups" });
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();

  // 4) GM
  const GM = await ethers.getContractFactory("LayeronGM");
  const gm = await upgrades.deployProxy(GM, [admin, tlAddr, adminDelay, configAddr, reputationAddr], { kind: "uups" });
  await gm.waitForDeployment();
  const gmAddr = await gm.getAddress();

  // 5) wire GM_ROLE + register chain (deployer is admin)
  if (admin.toLowerCase() === deployer.address.toLowerCase()) {
    await (await reputation.grantRole(await reputation.GM_ROLE(), gmAddr)).wait();
    await (await config.upsertChain({ name: "Arc", chainId: netChainId, usdc: cfg.usdc, gmContract: gmAddr, explorerUrl: cfg.explorerUrl, enabled: true })).wait();
    console.log("granted GM_ROLE + registered chain");
  } else {
    console.log("admin must grant GM_ROLE(", gmAddr, ") and upsertChain via the admin wallet");
  }

  const out = { chain: "arc", network: network.name, chainId: netChainId.toString(),
    usdc: cfg.usdc, layeronTimelock: tlAddr, layeronConfig: configAddr, layeronGM: gmAddr,
    layeronReputation: reputationAddr, explorerUrl: cfg.explorerUrl, admin,
    upgraderTimelock: tlAddr, timelockMinDelaySeconds: tlDelay, defaultAdminDelaySeconds: adminDelay,
    deployedAt: new Date().toISOString() };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, cfgFile), JSON.stringify(out, null, 2));
  console.log("wrote deployments/" + cfgFile, out);
  console.log("UPGRADER_ROLE = timelock", tlAddr, "| DEFAULT_ADMIN/CONFIG/PAUSER =", admin);
}
main().catch((e) => { console.error(e); process.exit(1); });
