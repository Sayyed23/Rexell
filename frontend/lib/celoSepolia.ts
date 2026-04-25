import { defineChain } from 'viem';

export const CELO_SEPOLIA_RPC_URLS = [
  'https://celo-sepolia.drpc.org',
  'https://celo-sepolia-rpc.allthatnode.com',
  'https://forno.celo-sepolia.celo-testnet.org',
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
      http: CELO_SEPOLIA_RPC_URLS,
    },
    public: {
      http: CELO_SEPOLIA_RPC_URLS,
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