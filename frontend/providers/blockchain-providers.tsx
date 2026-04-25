"use client";

import {
  RainbowKitProvider,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
import { celo, hardhat } from "wagmi/chains";
import { celoSepolia, CELO_SEPOLIA_RPC_URLS } from "@/lib/celoSepolia";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet,
      ],
    },
  ],
  {
    appName: "Rexell",
    projectId: "97712fd9a052670ee82d4a078462ba99",
  },
);

// Build a fallback transport over every Celo Sepolia RPC so viem rotates to
// the next endpoint when one returns 429 / 5xx (e.g. "RPC endpoint returned
// too many errors"). `rank` keeps the fastest healthy node at the top.
const celoSepoliaTransport = fallback(
  CELO_SEPOLIA_RPC_URLS.map((url) =>
    http(url, {
      retryCount: 3,
      retryDelay: 250,
      timeout: 15_000,
    }),
  ),
  { rank: true, retryCount: 1 },
);

const config = createConfig({
  connectors,
  chains: [celo, celoSepolia, hardhat],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: celoSepoliaTransport,
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  multiInjectedProviderDiscovery: false,
});

export function BlockchainProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
