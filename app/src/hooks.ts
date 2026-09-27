import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "wagmi/actions";
import { wagmiConfig } from "./lib/wagmi";
import { LayeronReputationAbi } from "./lib/abis";
import { defaultChain, getChainById, enabledChains } from "./lib/registry";

export function useSession() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, switchChainAsync } = useSwitchChain();
  const active = defaultChain();
  const onSupported = !!getChainById(chainId)?.enabled;
  return { address, isConnected, connector, chainId, connectors, connect, disconnect, switchChain, switchChainAsync, active, onSupported, enabled: enabledChains() };
}

// Reads streak/xp/gms straight from the Reputation contract (no backend needed).
export const useProfile = (address?: string) =>
  useQuery({
    queryKey: ["profile", address],
    enabled: !!address,
    refetchInterval: 15000,
    queryFn: async () => {
      const chain = defaultChain();
      const r: any = await readContract(wagmiConfig, {
        address: chain.contracts.layeronReputation as `0x${string}`,
        abi: LayeronReputationAbi,
        functionName: "repOf",
        args: [address as `0x${string}`],
      });
      return {
        xp: Number(r[0]),
        streak: Number(r[1]),
        longest_streak: Number(r[2]),
        total_gms: Number(r[4]),
        rank: null,
      };
    },
  });

// Leaderboard needs the indexer; return empty until it is deployed.
export const useLeaderboard = (_range: "daily"|"monthly"|"alltime") =>
  useQuery({ queryKey: ["lb"], queryFn: async () => ({ rows: [] as any[] }) });

export const useOverview = () =>
  useQuery({ queryKey: ["overview"], queryFn: async () => null });