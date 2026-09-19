import { readContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { keccak256, toBytes } from "viem";
import { wagmiConfig } from "./wagmi";
import { LayeronConfigAbi } from "./abis";

// role ids
export const ROLE = {
  DEFAULT_ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000",
  CONFIG:   keccak256(toBytes("CONFIG_ROLE")),
  PAUSER:   keccak256(toBytes("PAUSER_ROLE")),
  UPGRADER: keccak256(toBytes("UPGRADER_ROLE")),
} as const;

export const readCfg = (address: `0x${string}`, fn: string, args: any[] = []) =>
  readContract(wagmiConfig, { address, abi: LayeronConfigAbi, functionName: fn, args });

async function tx(address: `0x${string}`, fn: string, args: any[]) {
  const hash = await writeContract(wagmiConfig, { address, abi: LayeronConfigAbi, functionName: fn, args });
  await waitForTransactionReceipt(wagmiConfig, { hash });
  return hash;
}

// every action is a real signed onchain tx, then the dashboard re-reads the value
export const adminActions = {
  // protocol
  setGmFee: (a: `0x${string}`, fee: bigint) => tx(a, "setGmFee", [fee]),
  setAllocation: (a: `0x${string}`, dev: number, reward: number) => tx(a, "setAllocation", [dev, reward]),
  setDevWallet: (a: `0x${string}`, w: string) => tx(a, "setDevWallet", [w]),
  setRewardWallet: (a: `0x${string}`, w: string) => tx(a, "setRewardWallet", [w]),
  setXpPerGm: (a: `0x${string}`, x: bigint) => tx(a, "setXpPerGm", [x]),
  pause: (a: `0x${string}`) => tx(a, "pauseGm", []),
  unpause: (a: `0x${string}`) => tx(a, "unpauseGm", []),
  // security / roles
  beginDefaultAdminTransfer: (a: `0x${string}`, next: string) => tx(a, "beginDefaultAdminTransfer", [next]),
  acceptDefaultAdminTransfer: (a: `0x${string}`) => tx(a, "acceptDefaultAdminTransfer", []),
  cancelDefaultAdminTransfer: (a: `0x${string}`) => tx(a, "cancelDefaultAdminTransfer", []),
  grantRole: (a: `0x${string}`, role: `0x${string}`, who: string) => tx(a, "grantRole", [role, who]),
  revokeRole: (a: `0x${string}`, role: `0x${string}`, who: string) => tx(a, "revokeRole", [role, who]),
};
