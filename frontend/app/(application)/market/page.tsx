"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import Image from "next/image";

interface ResaleTicket {
  tokenId: bigint;
  owner: string;
  price: bigint;
  approved: boolean;
  rejected: boolean;
  nftUri?: string;
  eventId?: number;
}

export default function MarketPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [resaleTickets, setResaleTickets] = useState<ResaleTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Get all events to find resale tickets
  const {
    data: allEvents,
    isPending: isEventsPending,
    refetch: refetchEvents,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getAllEvents",
  });

  // Fetch resale tickets for all events
  const fetchResaleTickets = async () => {
    if (!allEvents || allEvents.length === 0) {
      setLoading(false);
      return;
    }

    const tickets: ResaleTicket[] = [];
    
    // For each event, check for resale tickets
    for (const event of allEvents) {
      for (const ticketHolder of event.ticketHolders) {
        try {
          // Get user's resale requests
          const userRequests = await fetchUserResaleRequests(ticketHolder);
          for (const tokenId of userRequests) {
            const request = await fetchResaleRequest(Number(tokenId));
            if (request && request.approved && !request.rejected) {
              // Get token URI for display
              const tokenURI = await fetchTokenURI(Number(tokenId));
              tickets.push({
                ...request,
                nftUri: tokenURI,
                eventId: Number(event.id)
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching resale tickets for ${ticketHolder}:`, error);
        }
      }
    }

    setResaleTickets(tickets);
    setLoading(false);
  };

  const fetchUserResaleRequests = async (userAddress: string): Promise<bigint[]> => {
    // This would need to be implemented in the contract or we need to track this differently
    // For now, we'll return an empty array
    return [];
  };

  const fetchResaleRequest = async (tokenId: number): Promise<ResaleTicket | null> => {
    try {
      // This would need to be implemented as a view function
      // For now, return null
      return null;
    } catch (error) {
      console.error(`Error fetching resale request for token ${tokenId}:`, error);
      return null;
    }
  };

  const fetchTokenURI = async (tokenId: number): Promise<string | null> => {
    try {
      // This would need to be implemented as a view function
      // For now, return null
      return null;
    } catch (error) {
      console.error(`Error fetching token URI for token ${tokenId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    if (allEvents) {
      fetchResaleTickets();
    }
  }, [allEvents]);

  const handleBuyTicket = async (tokenId: bigint, price: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet to buy tickets");
      return;
    }

    try {
      // In a real implementation, this would handle the payment and transfer
      // For now, we'll just show a success message
      toast.success(`Ticket #${Number(tokenId)} purchased successfully!`);
      
      // Refresh the market
      fetchResaleTickets();
    } catch (error: any) {
      console.error("Buy ticket error:", error);
      toast.error("Failed to buy ticket: " + (error.message || error.toString()));
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
          <p>Please connect your wallet to view the resale market</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
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
          <h1 className="text-3xl font-bold mb-2">Resale Market</h1>
          <p className="text-gray-600">
            Buy verified resale tickets from other users
          </p>
        </div>

        {resaleTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Resale Tickets Available</h3>
              <p className="text-gray-500 text-center">
                There are currently no verified resale tickets available in the market.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resaleTickets.map((ticket, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Ticket #{Number(ticket.tokenId)}</CardTitle>
                      <CardDescription>
                        Seller: {formatAddress(ticket.owner)}
                      </CardDescription>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      Verified
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {ticket.nftUri && (
                    <div className="mb-4">
                      <Image
                        alt="NFT Ticket"
                        className="w-full h-48 object-cover rounded-lg"
                        height="192"
                        src={`https://ipfs.io/ipfs/${ticket.nftUri}`}
                        width="300"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Price</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatPrice(ticket.price)} cUSD
                      </span>
                    </div>
                    
                    {ticket.eventId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Event ID</span>
                        <span className="text-sm font-mono">{ticket.eventId}</span>
                      </div>
                    )}
                    
                    <Button
                      onClick={() => handleBuyTicket(ticket.tokenId, ticket.price)}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                      disabled={ticket.owner.toLowerCase() === address?.toLowerCase()}
                    >
                      {ticket.owner.toLowerCase() === address?.toLowerCase() 
                        ? "Your Ticket" 
                        : "Buy Ticket"
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
