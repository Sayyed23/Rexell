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
import Link from "next/link";

interface ResaleTicket {
  tokenId: bigint;
  owner: string;
  price: bigint;
  approved: boolean;
  rejected: boolean;
}

export default function MarketPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [resaleTickets, setResaleTickets] = useState<ResaleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingTokenId, setPurchasingTokenId] = useState<bigint | null>(null);

  // Get the next ticket ID to estimate how many tickets exist
  const {
    data: nextTicketId,
    isPending: isNextTicketIdPending,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "nextTicketId",
  });

  // Generate an array of token IDs to check for resale requests
  const tokenIdsToCheck = nextTicketId 
    ? Array.from({ length: Number(nextTicketId) }, (_, i) => BigInt(i))
    : [];

  // Fetch resale requests for all token IDs
  const resaleRequests = tokenIdsToCheck.map((tokenId) =>
    useReadContract({
      address: contractAddress,
      abi: rexellAbi,
      functionName: 'getResaleRequest',
      args: [tokenId]
    })
  );

  // Process the resale requests when they're loaded
  useEffect(() => {
    if (isNextTicketIdPending || !nextTicketId) {
      setLoading(false);
      return;
    }

    try {
      const tickets: ResaleTicket[] = [];
      
      // Process all resale requests
      resaleRequests.forEach((request, index) => {
        if (request.data) {
          const resaleRequest = request.data as ResaleTicket;
          // Check if resale request exists and is approved
          if (resaleRequest.approved && !resaleRequest.rejected && 
              resaleRequest.owner !== "0x0000000000000000000000000000000000000000" &&
              resaleRequest.owner !== address) { // Don't show own tickets
            tickets.push(resaleRequest);
          }
        }
      });
      
      setResaleTickets(tickets);
    } catch (error) {
      console.error("Error processing resale tickets:", error);
      toast.error("Failed to load resale tickets");
    } finally {
      setLoading(false);
    }
  }, [nextTicketId, isNextTicketIdPending, address, resaleRequests]);

  const handleBuyTicket = async (tokenId: bigint, price: bigint, seller: string) => {
    if (!isConnected) {
      toast.error("Please connect your wallet to buy tickets");
      return;
    }

    if (!address) {
      toast.error("Wallet address not found");
      return;
    }

    if (seller.toLowerCase() === address.toLowerCase()) {
      toast.error("You cannot buy your own ticket");
      return;
    }

    try {
      setPurchasingTokenId(tokenId);
      
      // Call the buyResaleTicket function with the price as maxPrice
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "buyResaleTicket",
        args: [tokenId, price], // Pass both tokenId and maxPrice
      });

      if (hash) {
        toast.success(`Ticket #${tokenId.toString()} purchased successfully!`);
        
        // Refresh the market after purchase
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      console.error("Buy ticket error:", error);
      
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Ticket not available for resale")) {
        toast.error("This ticket is no longer available for resale");
      } else if (errorMessage.includes("Incorrect payment amount")) {
        toast.error("Incorrect payment amount sent");
      } else if (errorMessage.includes("Cannot buy your own ticket")) {
        toast.error("You cannot buy your own ticket");
      } else if (errorMessage.includes("insufficient funds")) {
        toast.error("Insufficient funds to purchase this ticket");
      } else if (errorMessage.includes("user rejected")) {
        toast.error("Transaction was rejected");
      } else {
        toast.error("Failed to buy ticket: " + errorMessage);
      }
    } finally {
      setPurchasingTokenId(null);
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

  if (isNextTicketIdPending || loading) {
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
            {resaleTickets.map((ticket) => (
              <Card key={ticket.tokenId.toString()} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 flex items-center justify-center">
                    <span className="text-gray-500">Ticket Image</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg">Ticket #{ticket.tokenId.toString()}</CardTitle>
                    <Badge variant="secondary">Resale</Badge>
                  </div>
                  <CardDescription className="mb-4">
                    Seller: {formatAddress(ticket.owner)}
                  </CardDescription>
                  <div className="flex justify-between items-center">
                    <div className="text-2xl font-bold">{formatPrice(ticket.price)} cUSD</div>
                    <Button asChild size="sm">
                      <Link href={`/buy/${ticket.tokenId.toString()}`}>Buy Now</Link>
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