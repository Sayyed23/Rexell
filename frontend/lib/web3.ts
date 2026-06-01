import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { celoSepolia } from './celoSepolia';
import { rexellAbi } from "@/blockchain/abi/rexell-abi";

// Contract address - should match your deployed contract
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_REXELL_ADDRESS as `0x${string}`) || "0x2954db0316985787B2076CF9bF7f42CCeBFF8185";

/**
 * Get the public client
 * @returns viem PublicClient instance
 */
export const getPublicClient = () => {
  return createPublicClient({
    chain: celoSepolia,
    transport: http(),
  });
};

/**
 * Get the wallet client
 * @returns viem WalletClient instance
 */
export const getWalletClient = () => {
  return createWalletClient({
    chain: celoSepolia,
    transport: http(),
  });
};

/**
 * Format price from wei to cUSD
 * @param priceInWei Price in wei (18 decimals)
 * @returns Price in cUSD
 */
export const formatPrice = (priceInWei: bigint): number => {
  return parseFloat(formatUnits(priceInWei, 18));
};

/**
 * Parse price from cUSD to wei
 * @param priceInCUSD Price in cUSD
 * @returns Price in wei (18 decimals)
 */
export const parsePrice = (priceInCUSD: number): bigint => {
  return parseUnits(priceInCUSD.toString(), 18);
};

/**
 * Shorten Ethereum address for display
 * @param address Full Ethereum address
 * @returns Shortened address (e.g., 0x1234...5678)
 */
export const shortenAddress = (address: string): string => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};
