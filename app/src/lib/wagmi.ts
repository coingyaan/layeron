import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { defineChain } from "viem";
import { enabledChains } from "./registry";
// Build wagmi chains dynamically from the registry — no hardcoded chain objects.
const chains = enabledChains().map((c) =>
  defineChain({
    id: c.chainId, name: c.displayName,
    nativeCurrency: c.nativeToken,
    rpcUrls: { default: { http: c.rpc.http } },
    blockExplorers: { default: { name: c.displayName, url: c.explorerUrl } },
  })
);
export const wagmiConfig = createConfig({
  chains: chains as any,
  connectors: [ injected({ target: "metaMask" }), injected({ target: "rabby" as any }), coinbaseWallet({ appName: "Layeron" }) ],
  transports: Object.fromEntries(enabledChains().map((c) => [c.chainId, http(c.rpc.http[0])])),
});
