import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./lib/wagmi";
import { LOGO_DATA_URI, WALLET_SPRITE } from "./assets/brand";
import App from "./App";
import "./styles/layeron.css";

// brand assets: logo as CSS var + wallet-logo sprite + ritual gradient def
document.documentElement.style.setProperty("--logo", `url("${LOGO_DATA_URI}")`);
const holder = document.createElement("div");
holder.innerHTML = WALLET_SPRITE +
  `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="lgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C42BFF"/><stop offset=".5" stop-color="#8B2BFF"/><stop offset="1" stop-color="#2F6BFF"/></linearGradient></defs></svg>`;
document.body.appendChild(holder);

const qc = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={qc}><App /></QueryClientProvider>
  </WagmiProvider>
);
