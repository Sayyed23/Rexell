"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function TicketsPage({ params }: { params: { id: number } }) {
  const { address, isConnected, isConnecting } = useAccount();
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // First, get the event details
  const {
    data: event,
    isPending: isEventPending,
    error: eventError,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEvent",
    args: [BigInt(params.id)],
  });

  // Then, get the user's tickets for this event
  const {
    data: userTickets,
    isPending: isTicketsPending,
    error: ticketsError,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getUserPurchasedTickets",
    args: address ? [BigInt(params.id), address] : undefined,
    query: {
      enabled: !!address && !!event,
    }
  });

  // Get the actual token ID using the new function (for the first ticket)
  const {
    data: tokenId,
    isPending: isTokenIdPending,
    error: tokenIdError,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getTokenIdByUserAndUri",
    args: address && userTickets && userTickets.length > 0 ? [address, userTickets[0]] : undefined,
    query: {
      enabled: !!address && !!userTickets && userTickets.length > 0,
    }
  });

  // Fallback: Use event ID as tokenId if the specific function fails
  const effectiveTokenId = tokenId;

  // Show loading state while connecting
  if (isConnecting || !isClient) {
    return (
      <main className="px-4">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="flex h-screen flex-col items-center justify-center rounded-lg bg-gray-100">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </main>
    );
  }

  // Check if we have data to display
  const isLoading = isEventPending || isTicketsPending || isTokenIdPending;
  const hasError = eventError || ticketsError;
  const hasTickets = userTickets && userTickets.length > 0;
  const ticketUri = hasTickets ? userTickets[0] : null;

  return (
    <main className="px-4">
      <div className="hidden sm:block">
        <Header />
      </div>
      <div className="flex h-screen flex-col items-center justify-center rounded-lg bg-gray-100">
        {!isConnected ? (
          <p>Please connect your wallet to view your tickets</p>
        ) : isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : hasError ? (
          <p>Error fetching ticket data: {eventError?.message || ticketsError?.message}</p>
        ) : !event ? (
          <p>Event not found</p>
        ) : !hasTickets ? (
          <p>No tickets found for this event</p>
        ) : ticketUri ? (
          <div className="flex h-screen w-full flex-col items-center justify-center gap-8 text-center">
            <Badge>Reload the page if you can&apos;t see your NFT Ticket</Badge>
            <h2 className="text-2xl font-bold">{event[2]}</h2> {/* Event name */}
            <p className="font-semibold text-green-600">Here is your NFT Ticket</p>
            <div className="px-6">
              <Image
                alt="NFT Ticket"
                className=""
                height="300"
                src={`https://ipfs.io/ipfs/${ticketUri}`}
                width="450"
              />
            </div>
            
            <div className="w-full max-w-md">
              <Button
                onClick={() => {
                  if (!effectiveTokenId) {
                    toast.error("Token ID not loaded yet. Please wait a moment and try again.");
                    return;
                  }
                  router.push(`/tickets/${params.id}/resale`);
                }}
                disabled={!effectiveTokenId}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                size="lg"
              >
                {isTokenIdPending ? "Loading Ticket Info..." : "Request Resale Verification"}
              </Button>
            </div>
          </div>
        ) : (
          <p>No ticket found</p>
        )}
      </div>
    </main>
  );
}