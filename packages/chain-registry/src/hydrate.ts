import { CHAIN_REGISTRY, ChainConfig } from "./registry";
export interface DeploymentArtifact {
  chain: string; chainId: string | number; usdc: string;
  layeronConfig: string; layeronGM: string; layeronReputation: string; explorerUrl?: string;
}
/** Merge a generated deployments/<key>.json into the registry entry. */
export function hydrateFromDeployment(key: string, d: DeploymentArtifact): ChainConfig | undefined {
  const c = CHAIN_REGISTRY[key];
  if (!c) return;
  c.chainId = Number(d.chainId) || c.chainId;
  c.usdc = d.usdc || c.usdc;
  c.contracts = { layeronConfig: d.layeronConfig, layeronGM: d.layeronGM, layeronReputation: d.layeronReputation };
  if (d.explorerUrl) c.explorerUrl = d.explorerUrl;
  return c;
}
