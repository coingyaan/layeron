import { ChainConfig } from "../registry";
export const FUNDING_LABEL = "get usdc/eth";
export function openFunding(chain?: ChainConfig) {
  const url = chain?.fundingUrl || "https://jumper.xyz/";
  window.open(url, "_blank", "noopener,noreferrer");
}
