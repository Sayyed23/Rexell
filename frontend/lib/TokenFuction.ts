import { createPublicClient, createWalletClient, custom } from "viem";
import { celoAlfajores } from "viem/chains";
import {
  tokencUSDAbi,
  tokencUSDContractAddress,
} from "@/blockchain/cUSD/TokenCusd";
import { toast } from "sonner";

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Approval function
export const approveTokens = async (spender: `0x${string}`, amount: bigint) => {
  // Check if we're in a browser environment and window.ethereum exists
  if (isBrowser && window.ethereum) {
    const privateClient = createWalletClient({
      chain: celoAlfajores,
      transport: custom(window.ethereum),
    });

    const publicClient = createPublicClient({
      chain: celoAlfajores,
      transport: custom(window.ethereum),
    });

    const [address] = await privateClient.getAddresses();

    try {
      // First check current allowance
      const allowance = await publicClient.readContract({
        address: tokencUSDContractAddress,
        abi: tokencUSDAbi,
        functionName: "allowance",
        args: [address, spender],
      });

      // If allowance is already sufficient, no need to approve again
      if (allowance >= amount) {
        return true;
      }

      // Approve the spender to spend the tokens
      const approveTxnHash = await privateClient.writeContract({
        account: address,
        address: tokencUSDContractAddress,
        abi: tokencUSDAbi,
        functionName: "approve",
        args: [spender, amount],
      });

      const approveTxnReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxnHash,
      });

      if (approveTxnReceipt.status == "success") {
        return true;
      }

      return false;
    } catch (error) {
      console.log(error);
      toast("Approval failed, make sure you have enough balance");
      return false;
    }
  }
  return false;
};

// Transfer function (for direct transfers)
export const processCheckout = async (receiver: `0x${string}`, amount: number) => {
  // Check if we're in a browser environment and window.ethereum exists
  if (isBrowser && window.ethereum) {
    const privateClient = createWalletClient({
      chain: celoAlfajores,
      transport: custom(window.ethereum),
    });

    const publicClient = createPublicClient({
      chain: celoAlfajores,
      transport: custom(window.ethereum),
    });

    const [address] = await privateClient.getAddresses();

    try {
      const checkoutTxnHash = await privateClient.writeContract({
        account: address,
        address: tokencUSDContractAddress,
        abi: tokencUSDAbi,
        functionName: "transfer",
        args: [receiver, BigInt(amount)],
      });

      const checkoutTxnReceipt = await publicClient.waitForTransactionReceipt({
        hash: checkoutTxnHash,
      });

      if (checkoutTxnReceipt.status == "success") {
        return true;
      }

      return false;
    } catch (error) {
      console.log(error);
      toast("Transaction failed, make sure you have enough balance");
      return false;
    }
  }
  return false;
};