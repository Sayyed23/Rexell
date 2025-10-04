"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface ResaleRequest {
  tokenId: bigint;
  owner: string;
  price: bigint;
  approved: boolean;
  rejected: boolean;
}

export default function ResaleRequestsPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [resaleRequests, setResaleRequests] = useState<ResaleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Get all events by organizer to find their events
  const {
    data: organizerEvents,
    isPending: isEventsPending,
    refetch: refetchEvents,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEventsByOrganizer",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });

  // Get all resale requests for each event
  const fetchResaleRequests = async () => {
    if (!organizerEvents || organizerEvents.length === 0) {
      setLoading(false);
      return;
    }

    const requests: ResaleRequest[] = [];
    
    for (const event of organizerEvents) {
      // Get all ticket holders for this event
      for (const ticketHolder of event.ticketHolders) {
        try {
          // Get user's resale requests
          const userRequests = await fetchUserResaleRequests(ticketHolder);
          for (const tokenId of userRequests) {
            const request = await fetchResaleRequest(Number(tokenId));
            if (request && request.owner !== "0x0000000000000000000000000000000000000000") {
              requests.push(request);
            }
          }
        } catch (error) {
          console.error(`Error fetching requests for ${ticketHolder}:`, error);
        }
      }
    }

    setResaleRequests(requests);
    setLoading(false);
  };

  const fetchUserResaleRequests = async (userAddress: string): Promise<bigint[]> => {
    // This would need to be implemented in the contract or we need to track this differently
    // For now, we'll return an empty array
    return [];
  };

  const fetchResaleRequest = async (tokenId: number): Promise<ResaleRequest | null> => {
    try {
      // This would need to be implemented as a view function
      // For now, return null
      return null;
    } catch (error) {
      console.error(`Error fetching resale request for token ${tokenId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    if (organizerEvents) {
      fetchResaleRequests();
    }
  }, [organizerEvents]);

  const handleApproveResale = async (tokenId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "approveResale",
        args: [tokenId],
      });
      
      if (hash) {
        toast.success("Resale request approved successfully");
        fetchResaleRequests(); // Refresh the list
      }
    } catch (error: any) {
      console.error("Approve resale error:", error);
      toast.error("Failed to approve resale request: " + (error.message || error.toString()));
    }
  };

  const handleRejectResale = async (tokenId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "rejectResale",
        args: [tokenId],
      });
      
      if (hash) {
        toast.success("Resale request rejected");
        fetchResaleRequests(); // Refresh the list
      }
    } catch (error: any) {
      console.error("Reject resale error:", error);
      toast.error("Failed to reject resale request: " + (error.message || error.toString()));
    }
  };

  const formatPrice = (price: bigint) => {
    return (Number(price) / 1e18).toFixed(2);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <main className="px-4">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="flex h-screen flex-col items-center justify-center">
          <p>Please connect your wallet to view resale requests</p>
        </div>
      </main>
    );
  }

  if (isEventsPending || loading) {
    return (
      <main className="px-4">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="container mx-auto py-8">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4">
      <div className="hidden sm:block">
        <Header />
      </div>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resale Requests</h1>
          <p className="text-gray-600">
            Review and manage resale requests for your events
          </p>
        </div>

        {resaleRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Resale Requests</h3>
              <p className="text-gray-500 text-center">
                There are currently no pending resale requests for your events.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {resaleRequests.map((request, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Resale Request #{Number(request.tokenId)}</CardTitle>
                      <CardDescription>
                        Owner: {formatAddress(request.owner)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {request.approved && (
                        <Badge variant="default" className="bg-green-500">
                          Approved
                        </Badge>
                      )}
                      {request.rejected && (
                        <Badge variant="destructive">
                          Rejected
                        </Badge>
                      )}
                      {!request.approved && !request.rejected && (
                        <Badge variant="secondary">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Requested Price</label>
                      <p className="text-lg font-semibold">{formatPrice(request.price)} cUSD</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Token ID</label>
                      <p className="text-lg font-mono">{Number(request.tokenId)}</p>
                    </div>
                  </div>
                  
                  {!request.approved && !request.rejected && (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApproveResale(request.tokenId)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleRejectResale(request.tokenId)}
                        variant="destructive"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
