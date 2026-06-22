"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { celoSepolia } from "@/lib/celoSepolia";

export default function GlobalConfigsTab() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Read states from contract
  const { data: royaltyRaw, refetch: refetchRoyalty } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "royaltyPercent",
    chainId: celoSepolia.id,
  });

  const { data: platformFeeRaw, refetch: refetchFee } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "platformFeePercent",
    chainId: celoSepolia.id,
  });

  const { data: platformFeeRecipientRaw, refetch: refetchRecipient } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "platformFeeRecipient",
    chainId: celoSepolia.id,
  });

  const { data: maxMultiplierRaw, refetch: refetchMultiplier } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "maxResaleMultiplier",
    chainId: celoSepolia.id,
  });

  const { data: cutoffRaw, refetch: refetchCutoff } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "resaleCutoffHours",
    chainId: celoSepolia.id,
  });

  // Local state inputs
  const [royalty, setRoyalty] = useState("");
  const [platformFee, setPlatformFee] = useState("");
  const [recipient, setRecipient] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Sync inputs with on-chain data initially
  useEffect(() => {
    if (royaltyRaw !== undefined && royaltyRaw !== null) setRoyalty(royaltyRaw.toString());
  }, [royaltyRaw]);

  useEffect(() => {
    if (platformFeeRaw !== undefined && platformFeeRaw !== null) setPlatformFee(platformFeeRaw.toString());
  }, [platformFeeRaw]);

  useEffect(() => {
    if (platformFeeRecipientRaw !== undefined && platformFeeRecipientRaw !== null) setRecipient(platformFeeRecipientRaw as string);
  }, [platformFeeRecipientRaw]);

  useEffect(() => {
    if (maxMultiplierRaw !== undefined && maxMultiplierRaw !== null) setMultiplier(maxMultiplierRaw.toString());
  }, [maxMultiplierRaw]);

  useEffect(() => {
    if (cutoffRaw !== undefined && cutoffRaw !== null) setCutoff(cutoffRaw.toString());
  }, [cutoffRaw]);

  const handleRefreshAll = () => {
    refetchRoyalty();
    refetchFee();
    refetchRecipient();
    refetchMultiplier();
    refetchCutoff();
    toast.success("Refetched configuration parameters!");
  };

  const handleUpdateConfig = async (action: string, funcName: string, arg: any, successMsg: string, refetchFn: () => void) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    setLoadingAction(action);
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: funcName as any,
        args: [arg],
      });

      if (hash && publicClient) {
        toast.info("Transaction submitted. Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          toast.success(successMsg);
          refetchFn();
        } else {
          toast.error("Transaction failed on-chain.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || `Failed to update ${action}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card className="shadow-md bg-white border border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl text-gray-800 font-bold">Global Platform Configurations</CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            Configure default fees, secondary pricing limits, and cut-off freeze times.
          </CardDescription>
        </div>
        <Button onClick={handleRefreshAll} variant="outline" size="icon" className="border-gray-300">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Royalty Percent */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 border rounded-lg bg-gray-50">
          <div className="space-y-1 flex-1">
            <Label htmlFor="royalty" className="text-sm font-semibold text-gray-700">Resale Royalty Percentage (%)</Label>
            <CardDescription className="text-xs">
              Fee distributed to organizers on secondary market ticket purchases. Max 20%.
            </CardDescription>
            <Input
              id="royalty"
              type="number"
              value={royalty}
              onChange={(e) => setRoyalty(e.target.value)}
              className="w-32 bg-white"
            />
          </div>
          <Button
            onClick={() => {
              const r = Number(royalty);
              if (isNaN(r) || r < 0 || r > 20) {
                toast.error("Royalty must be between 0% and 20%");
                return;
              }
              handleUpdateConfig("royalty", "setRoyaltyPercent", BigInt(r), "Successfully updated royalty percent!", refetchRoyalty);
            }}
            disabled={loadingAction !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
          >
            {loadingAction === "royalty" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Royalty
          </Button>
        </div>

        {/* Platform Fee Percent */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 border rounded-lg bg-gray-50">
          <div className="space-y-1 flex-1">
            <Label htmlFor="platformFee" className="text-sm font-semibold text-gray-700">Platform Fee Percentage (%)</Label>
            <CardDescription className="text-xs">
              Direct transaction cut collected for platform operational costs. Max 10%.
            </CardDescription>
            <Input
              id="platformFee"
              type="number"
              value={platformFee}
              onChange={(e) => setPlatformFee(e.target.value)}
              className="w-32 bg-white"
            />
          </div>
          <Button
            onClick={() => {
              const f = Number(platformFee);
              if (isNaN(f) || f < 0 || f > 10) {
                toast.error("Platform fee must be between 0% and 10%");
                return;
              }
              handleUpdateConfig("fee", "setPlatformFeePercent", BigInt(f), "Successfully updated platform fee percent!", refetchFee);
            }}
            disabled={loadingAction !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
          >
            {loadingAction === "fee" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Platform Fee
          </Button>
        </div>

        {/* Platform Fee Recipient Address */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 border rounded-lg bg-gray-50">
          <div className="space-y-1 flex-1 w-full">
            <Label htmlFor="recipient" className="text-sm font-semibold text-gray-700">Platform Fee Recipient Wallet</Label>
            <CardDescription className="text-xs">
              The wallet address designated to receive all platform fees collected during ticket resale.
            </CardDescription>
            <Input
              id="recipient"
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-white w-full max-w-md"
            />
          </div>
          <Button
            onClick={() => {
              if (!recipient.startsWith("0x") || recipient.length !== 42) {
                toast.error("Invalid recipient address");
                return;
              }
              handleUpdateConfig("recipient", "setPlatformFeeRecipient", recipient as `0x${string}`, "Successfully updated recipient address!", refetchRecipient);
            }}
            disabled={loadingAction !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
          >
            {loadingAction === "recipient" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Recipient
          </Button>
        </div>

        {/* Maximum Resale Multiplier */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 border rounded-lg bg-gray-50">
          <div className="space-y-1 flex-1">
            <Label htmlFor="multiplier" className="text-sm font-semibold text-gray-700">Max Resale Price Multiplier (%)</Label>
            <CardDescription className="text-xs">
              Caps secondary listing price relative to original price (e.g. 200% prevents listings above double face value). Min 100%.
            </CardDescription>
            <Input
              id="multiplier"
              type="number"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="w-32 bg-white"
            />
          </div>
          <Button
            onClick={() => {
              const m = Number(multiplier);
              if (isNaN(m) || m < 100) {
                toast.error("Multiplier must be at least 100%");
                return;
              }
              handleUpdateConfig("multiplier", "setMaxResaleMultiplier", BigInt(m), "Successfully updated max resale multiplier!", refetchMultiplier);
            }}
            disabled={loadingAction !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
          >
            {loadingAction === "multiplier" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Multiplier
          </Button>
        </div>

        {/* Resale Cutoff Hours */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 p-4 border rounded-lg bg-gray-50">
          <div className="space-y-1 flex-1">
            <Label htmlFor="cutoff" className="text-sm font-semibold text-gray-700">Resale Listing Freeze Period (Hours)</Label>
            <CardDescription className="text-xs">
              Freeze listing creations prior to event start time (e.g. 48 hours halts secondary listing approvals 2 days out).
            </CardDescription>
            <Input
              id="cutoff"
              type="number"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-32 bg-white"
            />
          </div>
          <Button
            onClick={() => {
              const c = Number(cutoff);
              if (isNaN(c) || c < 0) {
                toast.error("Freeze cutoff must be 0 or higher");
                return;
              }
              handleUpdateConfig("cutoff", "setResaleCutoffHours", BigInt(c), "Successfully updated resale cutoff hours!", refetchCutoff);
            }}
            disabled={loadingAction !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
          >
            {loadingAction === "cutoff" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Freeze Period
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
