// Minimal event ABIs the indexer listens to (from compiled artifacts).
export const gmEvent = {
  type: "event", name: "Gm", inputs: [
    { name: "user", type: "address", indexed: true },
    { name: "utcDay", type: "uint256", indexed: true },
    { name: "chainId", type: "uint256", indexed: false },
    { name: "fee", type: "uint256", indexed: false },
    { name: "devAmount", type: "uint256", indexed: false },
    { name: "rewardAmount", type: "uint256", indexed: false },
    { name: "xpAwarded", type: "uint256", indexed: false },
  ],
} as const;
export const xpEvent = {
  type: "event", name: "XPAwarded", inputs: [
    { name: "user", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "utcDay", type: "uint256", indexed: false },
    { name: "streak", type: "uint32", indexed: false },
    { name: "longestStreak", type: "uint32", indexed: false },
  ],
} as const;
