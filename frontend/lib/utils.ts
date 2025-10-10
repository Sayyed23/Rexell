import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: bigint | number): string {
  if (typeof price === 'bigint') {
    return (Number(price) / 1e18).toFixed(2);
  }
  return price.toFixed(2);
}

export function parsePrice(price: string): bigint {
  return BigInt(Math.floor(parseFloat(price) * 1e18));
}

export function shortenAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatDate(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleDateString();
}

export function formatTime(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleTimeString();
}

export function convertDateFromMilliseconds(milliseconds: number) {
  const date = new Date(milliseconds);
  return date.toLocaleDateString();
}

