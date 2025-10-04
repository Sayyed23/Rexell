"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ResaleTicketProps {
  tokenId: number;
  onResaleComplete: () => void;
}

export default function ResaleTicket({ tokenId, onResaleComplete }: ResaleTicketProps) {
  const { address, isConnected } = useWriteContract();
  const { writeContractAsync } = useWriteContract();
  const [isReselling, setIsReselling] = useState(false);
  const [resalePrice, setResalePrice] = useState("");
  const [nftUri, setNftUri] = useState("");

  // Get resale request details
  const {
    data: resaleRequest,
    isPending: isResaleRequestPending,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getResaleRequest",
    args: [BigInt(tokenId)],
    query: {
      enabled: !!tokenId && tokenId > 0,
    }
  });

  // Get token URI
  const {
    data: tokenURI,
    isPending: isTokenURIPending,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
    query: {
      enabled: !!tokenId && tokenId > 0,
    }
  });

  useEffect(() => {
    if (resaleRequest) {
      setResalePrice((Number(resaleRequest.price) / 1e18).toString());
    }
    if (tokenURI) {
      setNftUri(tokenURI);
    }
  }, [resaleRequest, tokenURI]);

  const handleResellTicket = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!resalePrice || parseFloat(resalePrice) <= 0) {
      toast.error("Please enter a valid resale price");
      return;
    }

    if (!nftUri) {
      toast.error("NFT URI not available");
      return;
    }

    try {
      setIsReselling(true);
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "resellTicket",
        args: [
          BigInt(tokenId),
          BigInt(Math.floor(parseFloat(resalePrice) * 1e18)), // Convert to wei
          nftUri
        ],
      });
      
      if (hash) {
        toast.success("Ticket listed for resale successfully!");
        onResaleComplete();
      }
    } catch (error: any) {
      console.error("Resell ticket error:", error);
      
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Resale not approved")) {
        toast.error("This ticket's resale has not been approved yet");
      } else if (errorMessage.includes("Resale rejected")) {
        toast.error("This ticket's resale has been rejected");
      } else if (errorMessage.includes("You are not the owner")) {
        toast.error("You are not the owner of this ticket");
      } else if (errorMessage.includes("Ticket does not exist")) {
        toast.error("Ticket does not exist");
      } else if (errorMessage.includes("Price must be greater than 0")) {
        toast.error("Price must be greater than 0");
      } else if (errorMessage.includes("user rejected")) {
        toast.error("Transaction was rejected by user");
      } else {
        toast.error("Failed to list ticket for resale: " + errorMessage);
      }
    } finally {
      setIsReselling(false);
    }
  };

  const formatPrice = (price: bigint) => {
    return (Number(price) / 1e18).toFixed(2);
  };

  if (isResaleRequestPending || isTokenURIPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading ticket information...</span>
        </CardContent>
      </Card>
    );
  }

  if (!resaleRequest || !resaleRequest.approved) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Resale Not Approved</h3>
          <p className="text-gray-600 text-center">
            This ticket's resale request has not been approved yet or has been rejected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-green-800">Resale Approved</CardTitle>
            <CardDescription className="text-green-700">
              Your resale request has been approved. You can now list this ticket for resale.
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-green-500">
            Approved
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Token ID</Label>
            <p className="text-lg font-mono">{tokenId}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">Original Requested Price</Label>
            <p className="text-lg font-semibold">{formatPrice(resaleRequest.price)} cUSD</p>
          </div>
        </div>

        <div>
          <Label htmlFor="resalePrice" className="text-sm font-medium text-gray-700">
            Final Resale Price (cUSD) *
          </Label>
          <Input
            id="resalePrice"
            type="number"
            value={resalePrice}
            onChange={(e) => setResalePrice(e.target.value)}
            placeholder="Enter final resale price"
            className="mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            min="0"
            step="0.01"
          />
          <p className="text-xs text-gray-500 mt-1">
            You can adjust the price from your original request
          </p>
        </div>

        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <div className="flex items-start">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs">ℹ</span>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Important Information:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Once listed, your ticket will be available for purchase by other users</li>
                <li>You will receive the resale price in cUSD when sold</li>
                <li>The original event organizer will receive a small commission</li>
                <li>You can cancel the listing before it's sold</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleResellTicket}
            disabled={isReselling || !resalePrice || parseFloat(resalePrice) <= 0}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
            size="lg"
          >
            {isReselling ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Listing Ticket...
              </div>
            ) : (
              "List Ticket for Resale"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}