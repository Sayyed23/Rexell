"use client";

import Image from "next/image";
import Link from "next/link";
import { useReadContract, useAccount } from "wagmi";
import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { celoSepolia } from "@/lib/celoSepolia";

const Page = () => {
  const { isConnected, address } = useAccount();

  // Use getUserPurchasedEvents instead of getUserTickets to get event data with IDs
  const { data, isPending, error } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getUserPurchasedEvents",
    args: [address!!],
    chainId: celoSepolia.id,
  });

  const [showResaleOptions, setShowResaleOptions] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    console.log(data);
  }, [data]);

  // The data now contains event objects with IDs
  const events = data || [];

  const toggleResaleOptions = (eventId: number) => {
    setShowResaleOptions(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  // Ensure consistent rendering between server and client
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <div className="hidden sm:block">
        <Header />
      </div>

      {/* Page Content */}
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">My Tickets</h1>

        {/* If wallet is not connected */}
        {!isConnected && (
          <div className="flex h-screen items-center justify-center">
            <p className="text-lg text-gray-600">Please connect your wallet</p>
          </div>
        )}

        {/* Error State */}
        {error && isConnected && (
          <div className="flex h-screen flex-col items-center justify-center space-y-4">
            <p className="text-lg text-red-400">
              Error fetching tickets: {error.message}
            </p>
            <p>Please make sure you are connected to Celo Sepolia.</p>
          </div>
        )}

        {/* No Tickets State */}
        {!error && events?.length === 0 && isConnected && !isPending && (
          <div className="flex h-screen items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-gray-600">
                You have not purchased any tickets yet.
              </p>

              <div className="mt-4">
                <Image
                  src="/static/images/ticket/No-Tickets.jpg" // Replace with an appropriate image path
                  alt="No tickets"
                  className="rounded-full"
                  width={200}
                  height={200}
                />
              </div>
              <div className="mt-6">
                <Link href="/events">
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                    Browse Events
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Loading State and Tickets Grid */}
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {isPending || !isClient ? (
            // Show skeletons for both loading state and initial client render
            Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-[300px] w-full rounded-xl" />
            ))
          ) : events?.length > 0 ? (
            // Show actual tickets when data is available
            events?.map((event: any, idx: number) => (
              // Use the first ticket URI from the event's nftUris array
              event.nftUris && event.nftUris.length > 0 ? (
                <div
                  key={event.id}
                  className="bg-white shadow-lg rounded-lg overflow-hidden transform transition duration-300 hover:scale-105 hover:shadow-lg"
                >
                  <div className="relative">
                    <Image
                      height="300"
                      src={`https://ipfs.io/ipfs/${event.nftUris[0]}`}
                      width="550"
                      alt={`Ticket for ${event.name}`}
                      className="object-cover w-full"
                    />
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Event ID: {event.id}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2">{event.name}</h3>
                    <Button
                      onClick={() => toggleResaleOptions(event.id)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 mb-2"
                    >
                      {showResaleOptions[event.id] ? "Hide Resale Options" : "Resell Ticket"}
                    </Button>

                    {showResaleOptions[event.id] && (
                      <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-700 mb-2">
                          To prevent scalping, you need to be verified before reselling.
                        </p>
                        <Link href={`/tickets/${event.id}`}>
                          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                            Go to Ticket Details
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : null
            ))
          ) : null}
        </div>
      </div>
    </main>
  );
};

export default Page;