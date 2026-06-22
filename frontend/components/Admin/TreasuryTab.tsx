"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { tokencUSDAbi, tokencUSDContractAddress } from "@/blockchain/cUSD/TokenCusd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, RefreshCw, Landmark } from "lucide-react";
import { celoSepolia } from "@/lib/celoSepolia";

export default function TreasuryTab() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [loading, setLoading] = useState(false);

  // Read contract's cUSD balance
  const { data: balanceRaw, refetch, error } = useReadContract({
    address: tokencUSDContractAddress,
    abi: tokencUSDAbi,
    functionName: "balanceOf",
    args: [contractAddress],
    chainId: celoSepolia.id,
  });

  const formattedBalance = balanceRaw ? Number(balanceRaw) / 1e18 : 0;

  const handleWithdraw = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    if (!withdrawAddress.startsWith("0x") || withdrawAddress.length !== 42) {
      toast.error("Please enter a valid Celo/ERC20 wallet address to withdraw funds to.");
      return;
    }
    if (formattedBalance <= 0) {
      toast.error("Contract balance is 0. No fees available to withdraw.");
      return;
    }

    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "withdraw",
        args: [withdrawAddress as `0x${string}`],
      });

      if (hash && publicClient) {
        toast.info("Withdrawal transaction submitted. Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(`Successfully withdrew ${formattedBalance.toFixed(4)} cUSD to ${withdrawAddress}!`);
          setWithdrawAddress("");
          refetch();
        } else {
          toast.error("Withdrawal transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || "Failed to withdraw treasury funds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-md bg-white border border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl text-gray-800 font-bold">Platform Treasury & Withdrawals</CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Monitor accumulated platform fees and execute contract treasury withdrawals.
          </CardDescription>
        </div>
        <Button onClick={() => { refetch(); toast.success("Balance updated!"); }} variant="outline" size="icon" className="border-gray-300">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Treasury Balance Display */}
        <div className="flex items-center gap-4 p-5 border rounded-lg bg-blue-50 border-blue-200">
          <div className="p-3 bg-blue-600 rounded-full text-white">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-blue-800">Accumulated cUSD Balance</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {formattedBalance.toFixed(4)} <span className="text-sm font-medium">cUSD</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 p-2 rounded">
            Error checking balance: {error.message}
          </p>
        )}

        {/* Withdrawal Form */}
        <div className="space-y-3 pt-2">
          <Label htmlFor="withdraw-address" className="text-sm font-semibold text-gray-700">Withdraw Destination Address</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="withdraw-address"
              type="text"
              placeholder="0x..."
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="flex-1 bg-white"
            />
            <Button
              onClick={handleWithdraw}
              disabled={loading || formattedBalance <= 0}
              className="bg-green-600 hover:bg-green-700 text-white font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Withdraw Funds
            </Button>
          </div>
          <CardDescription className="text-xs text-gray-400">
            Warning: The withdraw address must be a valid Celo Sepolia wallet. Contract owner permissions required.
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
