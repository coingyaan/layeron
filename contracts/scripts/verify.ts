import { run, network } from "hardhat";
import * as fs from "fs"; import * as path from "path";
/** Verifies the implementation contracts on the Arc explorer (needs explorer API config in hardhat). */
async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments",
    network.name === "arcMainnet" ? "arc-mainnet.json" : "arc-testnet.json"), "utf8"));
  for (const [name, addr] of Object.entries({
    LayeronConfig: dep.layeronConfig, LayeronGM: dep.layeronGM, LayeronReputation: dep.layeronReputation,
  })) {
    try { await run("verify:verify", { address: addr }); console.log("verified", name, addr); }
    catch (e) { console.log("verify skipped/failed for", name, (e as Error).message); }
  }
}
main().catch((e)=>{console.error(e);process.exit(1);});
