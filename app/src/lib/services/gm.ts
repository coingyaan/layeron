import { readContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { erc20Abi, decodeEventLog } from "viem";
import { wagmiConfig } from "../wagmi";
import { ChainConfig } from "../registry";
import { LayeronConfigAbi, LayeronGMAbi } from "../abis";

export type GmResult =
  | { ok: false; reason: "insufficient-usdc"; fee: bigint }
  | { ok: true; hash: `0x${string}`; xpAwarded: bigint };

/** §16 real flow: fee -> balance -> allowance -> approve -> gm -> receipt -> event. */
export async function runGm(c: ChainConfig, account: `0x${string}`): Promise<GmResult> {
  const cfg = c.contracts.layeronConfig as `0x${string}`;
  const gm = c.contracts.layeronGM as `0x${string}`;
  const usdc = c.usdc as `0x${string}`;
  const fee = await readContract(wagmiConfig, { address: cfg, abi: LayeronConfigAbi, functionName: "gmFee" }) as bigint;
  const bal = await readContract(wagmiConfig, { address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] }) as bigint;
  if (bal < fee) return { ok: false, reason: "insufficient-usdc", fee };
  const allow = await readContract(wagmiConfig, { address: usdc, abi: erc20Abi, functionName: "allowance", args: [account, gm] }) as bigint;
  if (allow < fee) {
    const ah = await writeContract(wagmiConfig, { address: usdc, abi: erc20Abi, functionName: "approve", args: [gm, fee] });
    await waitForTransactionReceipt(wagmiConfig, { hash: ah });
  }
  const hash = await writeContract(wagmiConfig, { address: gm, abi: LayeronGMAbi, functionName: "gm" });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  let xpAwarded = 0n;
  for (const log of receipt.logs) {
    try {
      const d = decodeEventLog({ abi: LayeronGMAbi, data: log.data, topics: log.topics }) as any;
      if (d.eventName === "Gm") xpAwarded = d.args.xpAwarded as bigint;
    } catch {}
  }
  return { ok: true, hash, xpAwarded };
}
export async function canGm(c: ChainConfig, account: `0x${string}`) {
  return await readContract(wagmiConfig, { address: c.contracts.layeronGM as `0x${string}`, abi: LayeronGMAbi, functionName: "canGm", args: [account] }) as boolean;
}
