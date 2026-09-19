const fs = require("fs"), path = require("path");
const A = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "src", n + ".sol", n + ".json"), "utf8")).abi;
let out = "// AUTO-GENERATED from contracts/artifacts - do not hand-edit.\n";
out += "export const LayeronConfigAbi = " + JSON.stringify(A("LayeronConfig")) + " as const;\n";
out += "export const LayeronGMAbi = " + JSON.stringify(A("LayeronGM")) + " as const;\n";
out += "export const LayeronReputationAbi = " + JSON.stringify(A("LayeronReputation")) + " as const;\n";
const dest = path.join(__dirname, "..", "..", "app", "src", "lib", "abis.ts");
fs.writeFileSync(dest, out);
console.log("wrote", dest);