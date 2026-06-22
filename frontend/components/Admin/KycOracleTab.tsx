"use client";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { soulboundIdentityAbi, soulboundIdentityAddress } from "@/blockchain/abi/soulbound-abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldAlert, CheckCircle, Ban, Skull } from "lucide-react";

export default function KycOracleTab() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [userAddress, setUserAddress] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [signerStatus, setSignerStatus] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const validateAddress = (addr: string) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return false;
    }
    if (!addr.startsWith("0x") || addr.length !== 42) {
      toast.error("Please enter a valid Celo/ERC20 wallet address (starts with 0x)");
      return false;
    }
    return true;
  };

  const handleFreeze = async () => {
    if (!validateAddress(userAddress)) return;
    setLoadingAction("freeze");
    try {
      const hash = await writeContractAsync({
        address: soulboundIdentityAddress as `0x${string}`,
        abi: soulboundIdentityAbi,
        functionName: "freeze",
        args: [userAddress as `0x${string}`],
      });

      if (hash && publicClient) {
        toast.info("Freeze transaction submitted. Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(`Successfully froze identity for ${userAddress.substring(0, 8)}...`);
          setUserAddress("");
        } else {
          toast.error("Transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || "Failed to freeze identity");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnfreeze = async () => {
    if (!validateAddress(userAddress)) return;
    setLoadingAction("unfreeze");
    try {
      const hash = await writeContractAsync({
        address: soulboundIdentityAddress as `0x${string}`,
        abi: soulboundIdentityAbi,
        functionName: "unfreeze",
        args: [userAddress as `0x${string}`],
      });

      if (hash && publicClient) {
        toast.info("Unfreeze transaction submitted. Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(`Successfully unfroze identity for ${userAddress.substring(0, 8)}...`);
          setUserAddress("");
        } else {
          toast.error("Transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || "Failed to unfreeze identity");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSlash = async () => {
    if (!validateAddress(userAddress)) return;
    if (!confirm(`Are you absolutely sure you want to slash user ${userAddress}? Their stake will be burned permanently.`)) {
      return;
    }
    setLoadingAction("slash");
    try {
      const hash = await writeContractAsync({
        address: soulboundIdentityAddress as `0x${string}`,
        abi: soulboundIdentityAbi,
        functionName: "slash",
        args: [userAddress as `0x${string}`],
      });

      if (hash && publicClient) {
        toast.info("Slash transaction submitted. Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(`Successfully slashed identity for ${userAddress.substring(0, 8)}...`);
          setUserAddress("");
        } else {
          toast.error("Transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || "Failed to slash identity");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetSigner = async () => {
    if (!validateAddress(signerAddress)) return;
    setLoadingAction("setSigner");
    try {
      const hash = await writeContractAsync({
        address: soulboundIdentityAddress as `0x${string}`,
        abi: soulboundIdentityAbi,
        functionName: "setOracleSigner",
        args: [signerAddress as `0x${string}`, signerStatus],
      });

      if (hash && publicClient) {
        toast.info("Signer update transaction submitted...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(`Oracle signer status set for ${signerAddress.substring(0, 8)}... to ${signerStatus ? 'Authorized' : 'Deauthorized'}`);
          setSignerAddress("");
        } else {
          toast.error("Transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || "Failed to update signer");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Account Control Card */}
      <Card className="shadow-md bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl text-gray-800 font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" /> Account Moderation Panel
          </CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Freeze suspicious bot behavior or slash confirmed Sybil attackers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="user-address" className="text-sm font-semibold text-gray-700">Target User Wallet Address</Label>
            <Input
              id="user-address"
              type="text"
              placeholder="0x..."
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-md border-gray-300 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <Button
              onClick={handleFreeze}
              disabled={loadingAction !== null}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center justify-center gap-2"
            >
              {loadingAction === "freeze" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Freeze
            </Button>

            <Button
              onClick={handleUnfreeze}
              disabled={loadingAction !== null}
              variant="outline"
              className="border-gray-300 hover:bg-gray-50 font-medium flex items-center justify-center gap-2 text-gray-700"
            >
              {loadingAction === "unfreeze" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              Unfreeze
            </Button>

            <Button
              onClick={handleSlash}
              disabled={loadingAction !== null}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-2"
            >
              {loadingAction === "slash" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Skull className="h-4 w-4" />
              )}
              Slash Stake
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Oracle Signer Control Card */}
      <Card className="shadow-md bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl text-gray-800 font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-500" /> Oracle Signer Management
          </CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Authorize or deauthorize signing nodes for the 3-of-5 identity verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="signer-address" className="text-sm font-semibold text-gray-700">Oracle Signer Address</Label>
            <Input
              id="signer-address"
              type="text"
              placeholder="0x..."
              value={signerAddress}
              onChange={(e) => setSignerAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-md border-gray-300 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-4 py-2">
            <Label className="text-sm font-semibold text-gray-700">Authorization Status</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={signerStatus === true}
                  onChange={() => setSignerStatus(true)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Authorize (Active)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={signerStatus === false}
                  onChange={() => setSignerStatus(false)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Deauthorize (Revoked)</span>
              </label>
            </div>
          </div>

          <Button
            onClick={handleSetSigner}
            disabled={loadingAction !== null}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 pt-2"
          >
            {loadingAction === "setSigner" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Signer Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
