"use client";

import {
  RainbowKitProvider,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
<<<<<<< HEAD
import { WagmiProvider, createConfig, http, fallback } from "wagmi";
=======
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
>>>>>>> 0c3284827a7689000dbfda47bec53beebd36bf68
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
      // viem will retry up to 3 times with exponential back-off before
      // giving up on this URL and moving to the next one in the fallback.
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
<<<<<<< HEAD
    [celoSepolia.id]: fallback(
      CELO_SEPOLIA_RPC_URLS.map((url) => http(url))
    ),
=======
    [celoSepolia.id]: celoSepoliaTransport,
>>>>>>> 0c3284827a7689000dbfda47bec53beebd36bf68
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
