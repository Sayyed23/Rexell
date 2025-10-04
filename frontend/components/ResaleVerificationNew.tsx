"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Client-side only wrapper to prevent hydration issues
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="mt-4 p-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-yellow-600 text-sm font-bold">!</span>
          </div>
          <h3 className="text-lg font-semibold text-yellow-800">Loading...</h3>
        </div>
        <div className="bg-yellow-100 p-3 rounded-md mb-4">
          <p className="text-yellow-800 text-sm">Loading resale verification status...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface ResaleVerificationProps {
  tokenId: number;
  onVerificationComplete: () => void;
  onCancel?: () => void;
}

export default function ResaleVerificationNew({ tokenId, onVerificationComplete, onCancel }: ResaleVerificationProps) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isRequesting, setIsRequesting] = useState(false);
  const [price, setPrice] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [resaleRequest, setResaleRequest] = useState<any>(null);
  
  // Use tokenId or show error if not available
  const effectiveTokenId = tokenId;

  // Check resale request status
  const {
    data: resaleRequestData,
    isPending: isResaleRequestPending,
    refetch: refetchResaleRequest,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getResaleRequest",
    args: [BigInt(effectiveTokenId)],
    query: {
      enabled: !!effectiveTokenId && effectiveTokenId > 0,
    }
  });

  // Update status based on contract data
  useEffect(() => {
    if (resaleRequestData) {
      setResaleRequest(resaleRequestData);
      if (resaleRequestData.approved) {
        setRequestStatus('approved');
        setIsApproved(true);
      } else if (resaleRequestData.rejected) {
        setRequestStatus('rejected');
      } else if (resaleRequestData.owner !== "0x0000000000000000000000000000000000000000") {
        setRequestStatus('pending');
      } else {
        setRequestStatus('none');
      }
    }
  }, [resaleRequestData]);

  // Auto-refresh status every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (effectiveTokenId && effectiveTokenId > 0) {
        refetchResaleRequest();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [effectiveTokenId, refetchResaleRequest]);

  const requestResaleVerification = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    // Check if token ID is valid
    if (!effectiveTokenId || effectiveTokenId === 0) {
      toast.error("Invalid token ID. Please refresh the page and try again.");
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
        args: [BigInt(effectiveTokenId), BigInt(Math.floor(priceValue * 1e18))], // Convert to wei (18 decimals)
      });
      
      if (hash) {
        toast.success("Resale verification requested successfully");
        setIsApproved(true);
        onVerificationComplete();
      }
    } catch (error: any) {
      console.error("Resale verification error:", error);
      
      // Parse the error message for more specific feedback
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Resale request already exists")) {
        toast.error("Resale request already exists for this ticket");
      } else if (errorMessage.includes("You are not the owner of this ticket")) {
        toast.error("You are not the owner of this ticket");
      } else if (errorMessage.includes("Price must be greater than 0")) {
        toast.error("Price must be greater than 0");
      } else if (errorMessage.includes("Ticket does not exist")) {
        toast.error("Ticket does not exist");
      } else if (errorMessage.includes("execution reverted")) {
        toast.error("Transaction failed: The ticket may not exist or you may not own it. Please refresh the page and try again.");
      } else if (errorMessage.includes("insufficient funds")) {
        toast.error("Insufficient funds for transaction");
      } else if (errorMessage.includes("user rejected")) {
        toast.error("Transaction was rejected by user");
      } else {
        toast.error("Failed to request resale verification: " + errorMessage);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusConfig = () => {
    switch (requestStatus) {
      case 'approved': 
        return {
          title: "Resale Approved!",
          message: "Your resale request has been approved. You can now resell this ticket in the market.",
          containerClass: "bg-green-50 border-green-200",
          messageBgClass: "bg-green-100",
          iconClass: "bg-green-100 text-green-600",
          titleClass: "text-green-800",
          messageClass: "text-green-800",
          icon: "✓"
        };
      case 'rejected': 
        return {
          title: "Resale Request Rejected",
          message: "Your resale request has been rejected by the event organizer. You can submit a new request with a different price.",
          containerClass: "bg-red-50 border-red-200",
          messageBgClass: "bg-red-100",
          iconClass: "bg-red-100 text-red-600",
          titleClass: "text-red-800",
          messageClass: "text-red-800",
          icon: "✗"
        };
      case 'pending': 
        return {
          title: "Request Pending Review",
          message: "Your resale request is being reviewed by the event organizer. You'll be notified once a decision is made.",
          containerClass: "bg-yellow-50 border-yellow-200",
          messageBgClass: "bg-yellow-100",
          iconClass: "bg-yellow-100 text-yellow-600",
          titleClass: "text-yellow-800",
          messageClass: "text-yellow-800",
          icon: "⏳"
        };
      default: 
        return {
          title: "Resale Verification Required",
          message: "To prevent scalping and ensure fair pricing, you need to be verified before reselling this ticket. The event organizer will review your request and approve or reject it.",
          containerClass: "bg-yellow-50 border-yellow-200",
          messageBgClass: "bg-yellow-100",
          iconClass: "bg-yellow-100 text-yellow-600",
          titleClass: "text-yellow-800",
          messageClass: "text-yellow-800",
          icon: "!"
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <ClientOnly>
      <div className={`mt-4 p-6 ${statusConfig.containerClass} rounded-lg shadow-sm`}>
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 ${statusConfig.iconClass} rounded-full flex items-center justify-center mr-3`}>
            <span className="text-sm font-bold">{statusConfig.icon}</span>
          </div>
          <h3 className={`text-lg font-semibold ${statusConfig.titleClass}`}>{statusConfig.title}</h3>
        </div>
        
        <div className={`${statusConfig.messageBgClass} p-3 rounded-md mb-4`}>
          <p className={`${statusConfig.messageClass} text-sm`}>
            {statusConfig.message}
          </p>
          {tokenId === 0 && (
            <p className="text-red-600 text-xs mt-2 font-medium">
              ⚠️ Using fallback token ID. This may not work correctly.
            </p>
          )}
          {resaleRequest && (
            <div className="mt-2 text-xs">
              <p><strong>Requested Price:</strong> {(Number(resaleRequest.price) / 1e18).toFixed(2)} cUSD</p>
              <p><strong>Status:</strong> 
                <Badge variant={requestStatus === 'approved' ? 'default' : requestStatus === 'rejected' ? 'destructive' : 'secondary'} className="ml-2">
                  {requestStatus === 'approved' ? 'Approved' : requestStatus === 'rejected' ? 'Rejected' : 'Pending'}
                </Badge>
              </p>
            </div>
          )}
        </div>
        
        {requestStatus === 'none' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                Resale Price (cUSD) *
              </Label>
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter your desired resale price"
                className="mt-1 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the price you want to sell this ticket for
              </p>
            </div>
            
            <div className="flex gap-3">
              {onCancel && (
                <Button 
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={isRequesting}
                >
                  Cancel
                </Button>
              )}
              <Button 
                onClick={requestResaleVerification} 
                disabled={isRequesting || !price}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
                size="lg"
              >
                {isRequesting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Requesting Verification...
                  </div>
                ) : (
                  "Submit Verification Request"
                )}
              </Button>
            </div>
          </div>
        )}

        {requestStatus === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
              <span className="ml-3 text-yellow-700">Waiting for organizer review...</span>
            </div>
            
            <div className="flex gap-3">
              {onCancel && (
                <Button 
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </Button>
              )}
              <Button 
                onClick={() => refetchResaleRequest()}
                variant="outline"
                className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              >
                Refresh Status
              </Button>
            </div>
          </div>
        )}

        {requestStatus === 'rejected' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {onCancel && (
                <Button 
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </Button>
              )}
              <Button 
                onClick={() => {
                  setRequestStatus('none');
                  setPrice('');
                  refetchResaleRequest();
                }}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600"
              >
                Submit New Request
              </Button>
            </div>
          </div>
        )}

        {requestStatus === 'approved' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {onCancel && (
                <Button 
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </Button>
              )}
              <Button 
                onClick={() => {
                  onVerificationComplete();
                }}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                Proceed to Resale
              </Button>
            </div>
          </div>
        )}
      </div>
    </ClientOnly>
  );
}