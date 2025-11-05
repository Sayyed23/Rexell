"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useReadContracts } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";

interface UserTicket {
  tokenId: number;
  eventId: number;
  nftUri: string;
  isListed: boolean;
}

export default function ResalePage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [resalePrice, setResalePrice] = useState("");
  const [isListing, setIsListing] = useState(false);

  // Get user's ticket URIs
  const { data: userTicketsData, refetch: refetchUserTickets } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getUserTickets",
    args: [address as `0x${string}`],
    query: {
      enabled: isConnected,
    }
  });

  // Get token IDs for the user's tickets
  const { data: tokenIdsData } = useReadContracts({
    contracts: userTicketsData?.map((uri: string) => ({ 
      address: contractAddress as `0x${string}`, 
      abi: rexellAbi, 
      functionName: 'getTokenIdByUserAndUri', 
      args: [address as `0x${string}`, uri] 
    })) ?? [],
    query: {
      enabled: !!userTicketsData && userTicketsData.length > 0,
    }
  });

  // Load user tickets
  useEffect(() => {
    if (isConnected && userTicketsData && tokenIdsData) {
      const tickets: UserTicket[] = tokenIdsData
        .map((result, index) => {
          if (result.status === 'success' && typeof result.data === 'bigint') {
            return {
              tokenId: Number(result.data),
              eventId: 0, // You might need another contract call to get eventId from tokenId
              nftUri: userTicketsData[index],
              isListed: false, // This would require another contract call per ticket
            };
          }
          return null;
        })
        .filter((ticket): ticket is UserTicket => ticket !== null);

      setUserTickets(tickets);
      setLoading(false);
    } else if (isConnected && userTicketsData && !tokenIdsData) {
      // Still loading token IDs
      setLoading(true);
    } else if (isConnected && (!userTicketsData || userTicketsData.length === 0)) {
      setUserTickets([]);
      setLoading(false);
    } else if (!isConnected) {
      setLoading(false);
    }
  }, [isConnected, userTicketsData, tokenIdsData]);

  const handleListTicket = async () => {
    if (!selectedTicket) {
      toast.error("Please select a ticket to list");
      return;
    }

    if (!resalePrice || parseFloat(resalePrice) <= 0) {
      toast.error("Please enter a valid resale price");
      return;
    }

    try {
      setIsListing(true);
      
      const priceInWei = parseEther(resalePrice);
      
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "requestResaleVerification",
        args: [BigInt(selectedTicket), priceInWei as any],
      });

      if (hash) {
        toast.success("Resale request submitted successfully!");
        setSelectedTicket(null);
        setResalePrice("");
        refetchUserTickets();
        router.push("/resale-approval");
      }
    } catch (error: any) {
      console.error("Error listing ticket:", error);
      
      if (error.message && error.message.includes("Resale request already exists")) {
        toast.error("Resale request already exists for this ticket");
      } else if (error.message && error.message.includes("You are not the owner")) {
        toast.error("You are not the owner of this ticket");
      } else {
        toast.error("Failed to list ticket: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsListing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>List Ticket for Resale</CardTitle>
            <CardDescription>Sell your tickets on the secondary market</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Please connect your wallet to list tickets for resale</p>
            <Button>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">List Ticket for Resale</h1>
          <p className="text-gray-600">Select a ticket from your collection to list on the marketplace</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="p-0">
                  <div className="bg-gray-200 animate-pulse w-full h-48" />
                </CardHeader>
                <CardContent className="p-4">
                  <div className="bg-gray-200 animate-pulse h-6 w-3/4 mb-2" />
                  <div className="bg-gray-200 animate-pulse h-4 w-1/2 mb-4" />
                  <div className="bg-gray-200 animate-pulse h-10 w-full rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : userTickets.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-5xl mb-4">🎟️</div>
              <h3 className="text-xl font-semibold mb-2">No tickets found</h3>
              <p className="text-gray-600 mb-6">
                You don&apos;t have any tickets in your collection. Purchase tickets from events to list them for resale.
              </p>
              <Button asChild>
                <a href="/events">Browse Events</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Tickets</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userTickets.map((ticket) => (
                  <Card 
                    key={ticket.tokenId} 
                    className={`overflow-hidden cursor-pointer transition-all ${
                      selectedTicket === ticket.tokenId 
                        ? "ring-2 ring-blue-500 border-blue-500" 
                        : "hover:shadow-md"
                    }`}
                    onClick={() => setSelectedTicket(ticket.tokenId)}
                  >
                    <CardHeader className="p-0">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 flex items-center justify-center">
                        <span className="text-gray-500">Ticket Image</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <CardTitle className="text-lg">Ticket #{ticket.tokenId}</CardTitle>
                        {ticket.isListed && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Listed
                          </span>
                        )}
                      </div>
                      <CardDescription className="mb-4">
                        Event ID: {ticket.eventId}
                      </CardDescription>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={ticket.isListed}
                      >
                        {ticket.isListed ? "Already Listed" : "Select Ticket"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {selectedTicket && (
              <Card>
                <CardHeader>
                  <CardTitle>List Ticket for Resale</CardTitle>
                  <CardDescription>
                    Set a price for your ticket and submit it for approval
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="ticketId">Ticket ID</Label>
                      <Input
                        id="ticketId"
                        value={selectedTicket}
                        disabled
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="resalePrice">Resale Price (cUSD) *</Label>
                      <Input
                        id="resalePrice"
                        type="number"
                        value={resalePrice}
                        onChange={(e) => setResalePrice(e.target.value)}
                        placeholder="Enter resale price"
                        className="mt-1"
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the price you want to sell this ticket for
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-800 mb-2">Important Information</h3>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>Your ticket will be reviewed by the event organizer before listing</li>
                      <li>A 5% royalty fee will be applied to resale transactions</li>
                      <li>You can cancel your request before it's approved</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTicket(null)}
                      disabled={isListing}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleListTicket}
                      disabled={isListing || !resalePrice || parseFloat(resalePrice) <= 0}
                      className="flex-1"
                    >
                      {isListing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting Request...
                        </>
                      ) : (
                        "Submit Resale Request"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}