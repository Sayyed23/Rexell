import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertDateFromMilliseconds(milliseconds: number) {
  const date = new Date(milliseconds);
  return date.toLocaleDateString();
}

