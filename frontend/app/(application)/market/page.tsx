"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { cUSDTokenAbi, cUSDTokenAddress } from "@/blockchain/cUSD/cUSD-abi";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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
  const [purchasingTokenId, setPurchasingTokenId] = useState<bigint | null>(null);

  // Get all approved resale tickets using the new contract function
  const {
    data: resaleTickets,
    isPending: isTicketsPending,
    refetch: refetchTickets,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getAllApprovedResaleTickets",
    query: {
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    }
  }) as { data: ResaleTicket[] | undefined; isPending: boolean; refetch: () => void };

  // Filter out user's own tickets
  const availableTickets = resaleTickets?.filter(ticket => 
    ticket.owner.toLowerCase() !== address?.toLowerCase()
  ) || [];

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
      
      // First, approve cUSD token spending
      toast.info("Approving cUSD spending...");
      const approveHash = await writeContractAsync({
        address: cUSDTokenAddress,
        abi: cUSDTokenAbi,
        functionName: "approve",
        args: [contractAddress, price],
      });

      if (!approveHash) {
        throw new Error("Failed to approve cUSD spending");
      }

      toast.info("Purchasing ticket...");
      
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
          refetchTickets();
        }, 2000);
      }
    } catch (error: any) {
      console.error("Buy ticket error:", error);
      
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Resale not approved")) {
        toast.error("This ticket is not approved for resale");
      } else if (errorMessage.includes("Price exceeds maximum allowed")) {
        toast.error("Price has changed since listing");
      } else if (errorMessage.includes("Cannot buy your own ticket")) {
        toast.error("You cannot buy your own ticket");
      } else if (errorMessage.includes("insufficient funds") || errorMessage.includes("insufficient balance")) {
        toast.error("Insufficient cUSD balance to purchase this ticket");
      } else if (errorMessage.includes("user rejected")) {
        toast.error("Transaction was rejected");
      } else if (errorMessage.includes("Royalty transfer failed") || errorMessage.includes("Payment to seller failed")) {
        toast.error("Payment failed. Please ensure you have approved sufficient cUSD");
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

  if (isTicketsPending) {
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

        {availableTickets.length === 0 ? (
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
            {availableTickets.map((ticket) => (
              <Card key={ticket.tokenId.toString()} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`resale-ticket-${ticket.tokenId}`}>
                <CardHeader>
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-dashed rounded-xl w-full h-48 flex items-center justify-center">
                    <div className="text-center text-white">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                      <p className="text-sm font-medium">Ticket #{ticket.tokenId.toString()}</p>
                    </div>
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
                    <Button 
                      onClick={() => handleBuyTicket(ticket.tokenId, ticket.price, ticket.owner)}
                      disabled={purchasingTokenId === ticket.tokenId}
                      size="sm"
                      data-testid={`buy-ticket-${ticket.tokenId}`}
                    >
                      {purchasingTokenId === ticket.tokenId ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Buying...
                        </div>
                      ) : (
                        "Buy Now"
                      )}
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