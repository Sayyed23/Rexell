"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ResaleVerificationProps {
  tokenId: number;
  onVerificationComplete: () => void;
}

export default function ResaleVerification({ tokenId, onVerificationComplete }: ResaleVerificationProps) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isRequesting, setIsRequesting] = useState(false);
  const [price, setPrice] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  const requestResaleVerification = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!price) {
      toast.error("Please enter a resale price");
      return;
    }

    // Validate price is a positive number
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error("Please enter a valid positive price");
      return;
    }

    try {
      setIsRequesting(true);
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "requestResaleVerification",
        args: [BigInt(tokenId), BigInt(Math.floor(priceValue * 1e18))], // Convert to wei (18 decimals)
      });
      
      if (hash) {
        toast.success("Resale verification requested successfully");
        setIsApproved(true);
        onVerificationComplete();
      }
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes("Resale request already exists")) {
        toast.error("Resale request already exists for this ticket");
      } else if (error.message && error.message.includes("You are not the owner of this ticket")) {
        toast.error("You are not the owner of this ticket");
      } else if (error.message && error.message.includes("Price must be greater than 0")) {
        toast.error("Price must be greater than 0");
      } else if (error.message && error.message.includes("Ticket does not exist")) {
        toast.error("Ticket does not exist");
      } else {
        toast.error("Failed to request resale verification: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Resale Verification</h3>
      <p className="text-yellow-700 mb-4">
        To prevent scalping, you need to be verified before reselling this ticket.
      </p>
      
      {!isApproved ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="price">Resale Price (cUSD)</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter resale price"
              className="mt-1"
              min="0"
              step="0.01"
            />
          </div>
          
          <Button 
            onClick={requestResaleVerification} 
            disabled={isRequesting}
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            {isRequesting ? "Requesting Verification..." : "Request Resale Verification"}
          </Button>
        </div>
      ) : (
        <div className="text-green-600 font-medium">
          Resale verification requested. Please wait for organizer approval.
        </div>
      )}
    </div>
  );
}