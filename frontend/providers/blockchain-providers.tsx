"use client";

import {
  RainbowKitProvider,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, fallback } from "wagmi";
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

const config = createConfig({
  connectors,
  // chains: [celoAlfajores],
  chains: [celo, celoSepolia, hardhat],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: fallback(
      CELO_SEPOLIA_RPC_URLS.map((url) => http(url))
    ),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  multiInjectedProviderDiscovery: false, // This can help with MetaMask connection issues
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