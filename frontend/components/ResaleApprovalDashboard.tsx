"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ResaleRequest {
  tokenId: number;
  owner: string;
  price: number;
  approved: boolean;
  rejected: boolean;
}

export default function ResaleApprovalDashboard({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void; }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  // State for resale requests
  const [resaleRequests, setResaleRequests] = useState<ResaleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch resale requests
  const { data: userResaleRequests, refetch } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getUserResaleRequests",
    args: [address as `0x${string}`],
  });

  // Fetch details for each resale request
  useEffect(() => {
    const fetchResaleRequests = async () => {
      if (!userResaleRequests || userResaleRequests.length === 0) {
        setResaleRequests([]);
        setLoading(false);
        return;
      }

      try {
        // Convert the contract data to our ResaleRequest format
        const requests: ResaleRequest[] = userResaleRequests.map((request: any) => ({
          tokenId: Number(request.tokenId),
          owner: request.owner,
          price: Number(request.price) / 1e18, // Convert from wei to cUSD
          approved: request.approved,
          rejected: request.rejected
        }));
        
        setResaleRequests(requests);
      } catch (error) {
        console.error("Error fetching resale requests:", error);
        toast.error("Failed to fetch resale requests");
      } finally {
        setLoading(false);
      }
    };

    if (isConnected && userResaleRequests) {
      fetchResaleRequests();
    } else if (!isConnected) {
      // Reset state when disconnected
      setResaleRequests([]);
      setLoading(false);
    }
  }, [isConnected, userResaleRequests]);

  const approveResale = async (tokenId: number) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "approveResale",
        args: [BigInt(tokenId)],
      });

      if (hash) {
        toast.success(`Resale approved for ticket #${tokenId}`);
        // Update local state
        setResaleRequests(prev => 
          prev.map(req => 
            req.tokenId === tokenId ? { ...req, approved: true } : req
          )
        );
        refetch();
      }
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes("No resale request for this ticket")) {
        toast.error("No resale request found for this ticket");
      } else if (error.message && error.message.includes("Resale already approved")) {
        toast.error("Resale request already approved");
      } else if (error.message && error.message.includes("Resale already rejected")) {
        toast.error("Resale request already rejected");
      } else if (error.message && error.message.includes("Ticket does not exist")) {
        toast.error("Ticket does not exist");
      } else {
        toast.error("Failed to approve resale: " + (error.message || "Unknown error"));
      }
    }
  };

  const rejectResale = async (tokenId: number) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "rejectResale",
        args: [BigInt(tokenId)],
      });

      if (hash) {
        toast.success(`Resale rejected for ticket #${tokenId}`);
        // Update local state
        setResaleRequests(prev => 
          prev.map(req => 
            req.tokenId === tokenId ? { ...req, rejected: true } : req
          )
        );
        refetch();
      }
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes("No resale request for this ticket")) {
        toast.error("No resale request found for this ticket");
      } else if (error.message && error.message.includes("Resale already approved")) {
        toast.error("Resale request already approved");
      } else if (error.message && error.message.includes("Resale already rejected")) {
        toast.error("Resale request already rejected");
      } else if (error.message && error.message.includes("Ticket does not exist")) {
        toast.error("Ticket does not exist");
      } else {
        toast.error("Failed to reject resale: " + (error.message || "Unknown error"));
      }
    }
  };

  // Filter requests based on active tab
  const filteredRequests = resaleRequests.filter(request => {
    if (activeTab === "pending") return !request.approved && !request.rejected;
    if (activeTab === "approved") return request.approved;
    if (activeTab === "rejected") return request.rejected;
    return true;
  });

  if (!isConnected) {
    return (
      <div className="p-4 text-center text-gray-500">
        Please connect your wallet to view resale requests
      </div>
    );
  }

  return (
    <>
      {loading ? (
        <div className="text-center py-4">Loading resale requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No {activeTab} resale requests
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review and manage resale requests to prevent scalping
          </p>
          {filteredRequests.map((request) => (
            <div 
              key={request.tokenId} 
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <div className="font-medium">Ticket #{request.tokenId}</div>
                <div className="text-sm text-gray-500">
                  Owner: {request.owner}
                </div>
                <div className="text-sm text-gray-500">
                  Price: {request.price} cUSD
                </div>
              </div>
              {activeTab === "pending" && (
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => approveResale(request.tokenId)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button 
                    onClick={() => rejectResale(request.tokenId)}
                    size="sm"
                    variant="outline"
                  >
                    Reject
                  </Button>
                </div>
              )}
              {activeTab === "approved" && (
                <div className="text-green-600 font-medium">
                  Approved
                </div>
              )}
              {activeTab === "rejected" && (
                <div className="text-red-600 font-medium">
                  Rejected
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}