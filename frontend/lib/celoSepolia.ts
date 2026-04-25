import { defineChain } from 'viem';

// Celo Sepolia public RPC endpoints. We list several so viem's fallback
// transport can rotate to a different node when one rate-limits or fails.
// The first entry is the official Forno endpoint; the others are well-known
// public mirrors. Override at runtime via NEXT_PUBLIC_CELO_SEPOLIA_RPC
// (comma-separated for multiple).
const ENV_RPCS = (process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

export const CELO_SEPOLIA_RPC_URLS: readonly string[] = ENV_RPCS.length
  ? ENV_RPCS
  : [
      'https://forno.celo-sepolia.celo-testnet.org',
      'https://celo-sepolia.drpc.org',
      'https://celo-sepolia-rpc.publicnode.com',
    ];

export const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: [...CELO_SEPOLIA_RPC_URLS],
    },
    public: {
      http: [...CELO_SEPOLIA_RPC_URLS],
    },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Explorer',
      url: 'https://sepolia.celoscan.io',
      apiUrl: 'https://api-sepolia.celoscan.io/api',
    },
  },
  testnet: true,
});
