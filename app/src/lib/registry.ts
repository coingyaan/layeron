// Self-contained Arc registry (Vite). Values default to the live deployment; VITE_* env can override.
export interface ChainConfig {
  key: string; chainId: number; name: string; displayName: string;
  nativeToken: { name: string; symbol: string; decimals: number };
  rpc: { http: string[] }; usdc: string;
  contracts: { layeronConfig: string; layeronGM: string; layeronReputation: string; layeronTimelock: string };
  explorerUrl: string; explorerTxUrlFormat: string; explorerAddressUrlFormat: string;
  fundingUrl: string; enabled: boolean;
}
export const UNIVERSAL_FUNDING_URL = "https://jumper.xyz/";
const env = (import.meta as any).env || {};
export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  arc: {
    key: "arc",
    chainId: Number(env.VITE_ARC_CHAIN_ID) || 5042,
    name: "arc", displayName: "Arc",
    nativeToken: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpc: { http: [env.VITE_ARC_RPC_URL || "https://rpc.mainnet.arc.io"] },
    usdc: env.VITE_ARC_USDC || "0x3600000000000000000000000000000000000000",
    contracts: {
      layeronConfig: "0x04c55Ff16a7CDA8169B26a7B60a8D7744042fef5",
      layeronGM: "0x83694B85b90eE2B0CE2B2Ce42FFEF9B08f7de78A",
      layeronReputation: "0x9431FA2D4a75fD985fABd131234Ab5a433429848",
      layeronTimelock: "0x417c4de6f1b30E60ABEF76D4a39316a1140f0C69",
    },
    explorerUrl: env.VITE_ARC_EXPLORER_URL || "https://arc.etherscan.io",
    explorerTxUrlFormat: "{explorer}/tx/{hash}",
    explorerAddressUrlFormat: "{explorer}/address/{address}",
    fundingUrl: UNIVERSAL_FUNDING_URL,
    enabled: true,
  },
};
export const allChains = () => Object.values(CHAIN_REGISTRY);
export const enabledChains = () => allChains().filter((c) => c.enabled);
export const defaultChain = () => enabledChains()[0];
export const getChainById = (id: number) => allChains().find((c) => c.chainId === id);
export const isSupported = (id: number) => !!getChainById(id)?.enabled;
export function txUrl(c: ChainConfig, hash: string) { return c.explorerTxUrlFormat.replace("{explorer}", c.explorerUrl).replace("{hash}", hash); }
export function addressUrl(c: ChainConfig, a: string) { return c.explorerAddressUrlFormat.replace("{explorer}", c.explorerUrl).replace("{address}", a); }