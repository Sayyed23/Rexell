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
import ResaleVerificationNew from "@/components/ResaleVerificationNew";
import ResaleTicket from "@/components/ResaleTicket";
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

  const [showResaleVerification, setShowResaleVerification] = useState(false);
  const [resaleVerified, setResaleVerified] = useState(false);



  const handleVerificationComplete = () => {
    setResaleVerified(true);
    setShowResaleVerification(false); // Hide the verification form after completion
    refetch();
  };

  const handleCancelVerification = () => {
    setShowResaleVerification(false);
  };

  const handleResaleComplete = () => {
    toast.success("Ticket resold successfully!");
    refetch();
  };

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
            
            {/* Resale functionality */}
            <div className="w-full max-w-md">
              {!resaleVerified ? (
                <div className="space-y-4">
                  <Button 
                    onClick={() => {
                      if (!effectiveTokenId) {
                        toast.error("Token ID not loaded yet. Please wait a moment and try again.");
                        return;
                      }
                      setShowResaleVerification(true);
                      // Scroll to the verification form for better UX
                      setTimeout(() => {
                        const element = document.getElementById('resale-verification-form');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }}
                    disabled={!effectiveTokenId}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                    size="lg"
                  >
                    {isTokenIdPending ? "Loading Ticket Info..." : "Request Resale Verification"}
                  </Button>
                  
                  {showResaleVerification && (
                    <div className="text-sm text-gray-600 text-center">
                      Please fill out the form below to request resale verification
                    </div>
                  )}
                  
                  {/* Debug button for testing - only show if effectiveTokenId is available */}
                  {!showResaleVerification && effectiveTokenId && (
                    <Button 
                      onClick={() => setShowResaleVerification(true)}
                      variant="outline"
                      className="mt-2 text-xs"
                      size="sm"
                    >
                      Debug: Show Form
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-green-600 font-medium mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  ✅ Resale verification approved! You can now resell this ticket.
                </div>
              )}
              
              {showResaleVerification && (
                <div id="resale-verification-form" className="mt-6">
                  {effectiveTokenId ? (
                    <ResaleVerificationNew 
                      tokenId={Number(effectiveTokenId)} 
                      onVerificationComplete={handleVerificationComplete}
                      onCancel={handleCancelVerification}
                    />
                  ) : isTokenIdPending ? (
                    <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center mb-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                        <h3 className="text-lg font-semibold text-blue-800">Loading Token Information</h3>
                      </div>
                      <p className="text-blue-700 mb-4">
                        Please wait while we retrieve your ticket information...
                      </p>
                      <Button 
                        onClick={handleCancelVerification}
                        variant="outline"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-red-600 text-sm font-bold">!</span>
                        </div>
                        <h3 className="text-lg font-semibold text-red-800">Cannot Load Ticket Information</h3>
                      </div>
                      <p className="text-red-700 mb-4">
                        Unable to retrieve the token ID for this ticket. This is required for resale verification.
                        <br />
                        <span className="text-sm">Debug info: Event ID: {params.id}, User Tickets: {userTickets?.length || 0}</span>
                      </p>
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                          <strong>Possible solutions:</strong>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Make sure you own a ticket for this event</li>
                            <li>Check that your wallet is connected</li>
                            <li>Try refreshing the page</li>
                            <li>Ensure the event exists and is active</li>
                          </ul>
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            onClick={handleCancelVerification}
                            variant="outline"
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => {
                              refetch();
                              // Try to get tokenId again
                              setTimeout(() => {
                                if (tokenId) {
                                  setShowResaleVerification(false);
                                  setShowResaleVerification(true);
                                }
                              }, 1000);
                            }}
                            className="flex-1 bg-blue-500 hover:bg-blue-600"
                          >
                            Retry
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {resaleVerified && effectiveTokenId && (
                <div className="mt-6">
                  <ResaleTicket 
                    tokenId={Number(effectiveTokenId)} 
                    onResaleComplete={handleResaleComplete}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p>No ticket found</p>
        )}
      </div>
    </main>
  );
}