import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { defaultChain, getChainById, enabledChains } from "./lib/registry";
import { api } from "./lib/api";

export function useSession() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, switchChainAsync } = useSwitchChain();
  const active = defaultChain();                          // v1: Arc (whatever is enabled)
  const onSupported = !!getChainById(chainId)?.enabled;
  return { address, isConnected, connector, chainId, connectors, connect, disconnect, switchChain, switchChainAsync, active, onSupported, enabled: enabledChains() };
}

export const useProfile = (address?: string) =>
  useQuery({ queryKey: ["profile", address], enabled: !!address, queryFn: () => api.profile(address!) });

export const useLeaderboard = (range: "daily"|"monthly"|"alltime") =>
  useQuery({ queryKey: ["lb", range], queryFn: () => api.leaderboard(range) });

export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: () => api.overview() });
