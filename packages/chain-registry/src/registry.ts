/**
 * Generic EVM chain registry — the single source of truth for every network.
 *
 * The application NEVER branches on a chain name (no `if arc / if base / if robinhood`).
 * It reads whichever chains are `enabled` here and treats them through one generic
 * EVM abstraction. Adding a new EVM chain later = add a config entry + deploy contracts
 * + register addresses + flip `enabled`. No frontend/core rewrite.
 */
export interface RpcConfig {
  http: string[];            // resolved from env at load time (never hardcode secrets)
  ws?: string[];
}
export interface ContractSet {
  layeronConfig: string;
  layeronGM: string;
  layeronReputation: string;
}
export interface ChainConfig {
  /** stable machine key, e.g. "arc" — used only as a map key, never for logic branching */
  key: string;
  chainId: number;
  name: string;               // technical name
  displayName: string;        // shown in UI
  nativeToken: { name: string; symbol: string; decimals: number };
  rpc: RpcConfig;
  usdc: string;               // USDC token (6 decimals) on this chain
  contracts: ContractSet;     // filled from generated deployments
  explorerUrl: string;        // base, e.g. https://explorer.example
  explorerTxUrlFormat: string;// e.g. "{explorer}/tx/{hash}"
  explorerAddressUrlFormat: string;
  fundingUrl: string;         // universal onramp/bridge (jumper)
  enabled: boolean;
  metadata?: Record<string, unknown>; // chain-specific config data, not logic
}

/** Universal funding/onramp/bridge entry point (get usdc/eth). */
export const UNIVERSAL_FUNDING_URL = "https://jumper.xyz/";

/** env helper — arrays from comma-separated env, empty if unset. */
const envList = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/**
 * Registry. Every field that differs per chain (gas token, rpc, explorer, usdc,
 * contract addresses) is DATA here, not logic elsewhere. v1 enables Arc only.
 * Contract addresses stay empty until hydrated from deployments/<key>-<net>.json.
 */
export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  arc: {
    key: "arc",
    chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 0, // REQUIRED at deploy config
    name: "arc",
    displayName: "Arc",
    nativeToken: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpc: { http: envList(process.env.NEXT_PUBLIC_ARC_RPC_URL) },
    usdc: process.env.NEXT_PUBLIC_ARC_USDC || "",
    contracts: { layeronConfig: "", layeronGM: "", layeronReputation: "" },
    explorerUrl: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "",
    explorerTxUrlFormat: "{explorer}/tx/{hash}",
    explorerAddressUrlFormat: "{explorer}/address/{address}",
    fundingUrl: UNIVERSAL_FUNDING_URL,
    enabled: true,
    metadata: {},
  },
  // Examples of *potential* future chains — DISABLED. Not special-cased anywhere.
  // Any EVM chain can be added the same way; arc/base/robinhood are not the limit.
  // base:      { ...disabled example... }
  // robinhood: { ...disabled example... }
};

// ---- generic helpers (used everywhere instead of chain-name checks) ----
export const allChains = () => Object.values(CHAIN_REGISTRY);
export const enabledChains = () => allChains().filter((c) => c.enabled);
export const defaultChain = () => enabledChains()[0];
export const getChainById = (id: number) => allChains().find((c) => c.chainId === id);
export const isSupported = (id: number) => !!getChainById(id)?.enabled;

export function txUrl(c: ChainConfig, hash: string) {
  return c.explorerTxUrlFormat.replace("{explorer}", c.explorerUrl).replace("{hash}", hash);
}
export function addressUrl(c: ChainConfig, address: string) {
  return c.explorerAddressUrlFormat.replace("{explorer}", c.explorerUrl).replace("{address}", address);
}
