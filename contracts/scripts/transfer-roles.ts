import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * OPTIONAL — run this LATER, only when you decide to move admin control to a multisig.
 * NOT required for v1 (v1 keeps all roles on your main wallet).
 *
 * It grants every privileged role on all three contracts to `newAdmin` (your multisig),
 * then renounces those roles from the CURRENT admin wallet (the caller). No redeploy.
 *
 * Set the target with env NEW_ADMIN=0xYourMultisig, and run as the current admin wallet.
 * Verify on the explorer afterwards that the old wallet holds no roles.
 */
async function main() {
  const newAdmin = process.env.NEW_ADMIN;
  if (!newAdmin) throw new Error("Set NEW_ADMIN=0xYourMultisig to transfer control.");

  const depFile = network.name === "arcMainnet" ? "arc-mainnet.json" : "arc-testnet.json";
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", depFile), "utf8"));
  const [current] = await ethers.getSigners();

  const config = await ethers.getContractAt("LayeronConfig", dep.layeronConfig);
  const rep = await ethers.getContractAt("LayeronReputation", dep.layeronReputation);
  const gm = await ethers.getContractAt("LayeronGM", dep.layeronGM);

  // roles per contract (GM_ROLE on reputation stays with the GM contract — not transferred)
  const roleNames: Record<string, string[]> = {
    config: ["DEFAULT_ADMIN_ROLE", "CONFIG_ROLE", "PAUSER_ROLE", "UPGRADER_ROLE"],
    reputation: ["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"],
    gm: ["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"],
  };
  const contracts: Record<string, any> = { config, reputation: rep, gm };

  // grant to newAdmin first (so control is never lost), then renounce from current
  for (const [name, c] of Object.entries(contracts)) {
    for (const rn of roleNames[name]) {
      const role = await c[rn]();
      if (!(await c.hasRole(role, newAdmin))) { await (await c.grantRole(role, newAdmin)).wait(); console.log(`grant ${name}.${rn} -> ${newAdmin}`); }
    }
  }
  for (const [name, c] of Object.entries(contracts)) {
    for (const rn of roleNames[name]) {
      const role = await c[rn]();
      if (await c.hasRole(role, current.address)) { await (await c.renounceRole(role, current.address)).wait(); console.log(`renounce ${name}.${rn} from ${current.address}`); }
    }
  }
  console.log("Control moved to", newAdmin, "— verify on the explorer that", current.address, "holds no roles.");
}
main().catch((e) => { console.error(e); process.exit(1); });
