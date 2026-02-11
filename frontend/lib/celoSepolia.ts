import { defineChain } from 'viem';

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
      http: ['https://celo-sepolia.drpc.org'],
    },
    public: {
      http: ['https://celo-sepolia.drpc.org'],
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