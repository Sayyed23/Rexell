"use client";

import Image from "next/image";
import Link from "next/link";
import { useReadContract, useAccount } from "wagmi";
import { Calendar, CircleDollarSign, Clock, Ticket } from "lucide-react";

import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import { Skeleton } from "@/components/ui/skeleton";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { Header } from "@/components/header";
import { useEffect, useState } from "react";

export default function EventsPage() {
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);

  const { data, isPending, error } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getAllEvents",
  });

  

  // To prevent hydration issues, ensure the component only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  interface Event {
    category: string;
    date: number;
    description: string;
    id: number;
    ipfs: string;
    name: string;
    nftUris: [];
    organizer: string;
    price: number;
    ticketHolders: [];
    ticketsAvailable: number;
    time: string;
    venue: string;
  }

  const events = (data as unknown as Event[]) || [];

  useEffect(() => {
    if (events) {
      console.log(events);
    }
  }, [events]);
  // Prevent rendering the content until the component is on the client-side
  if (!isClient) return null;

  return (
    <main className="flex flex-col px-4">
      <Header />
      <section className="py-6">
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              All Events
            </h1>
          </div>

          {!isConnected ? (
            <div className="flex h-screen items-center justify-center">
              <p>Connect your wallet to view events</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex h-screen items-center justify-center">
                  <p>
                    Error fetching events, connect wallet if not connected and
                    try again
                  </p>
                </div>
              )}

              {isPending ? (
                <Skeleton className="h-[250px] rounded-xl" />
              ) : (
                <>
                  {events?.length === 0 && (
                    <div className="flex h-screen items-center justify-center">
                      <p>No events found</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4 lg:gap-10">
                    {events?.map((event: Event, index: number) => (
                      <Link href={`/event-details/${index}`} key={index}>
                        <div className="event-card overflow-hidden rounded-lg bg-white shadow-lg transition-shadow duration-300 hover:shadow-2xl relative">
  {/* Display "Ended" only when the event date has passed */}
  {Date.now() > event.date && (
    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xl font-semibold">
      Ended
    </div>
  )}
  
  <Image
    alt="Event"
    className="event-image h-60 w-full object-cover transition-transform duration-300 hover:scale-105"
    height={200}
    width={200}
    src={`https://ipfs.io/ipfs/${event.ipfs}`}
    style={{
      aspectRatio: "300/200",
      objectFit: "cover",
    }}
  />
  <div className="event-details p-4 md:p-6">
    <h3 className="mb-2 text-lg font-semibold text-gray-800 md:text-xl">
      {event.name}
    </h3>
    <div className="mb-4 flex items-center justify-between border-b  border-gray-200 pb-2">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <CircleDollarSign className="h-5 w-5 text-gray-500" />
          {Number(event.price) === 0 ? (
            <p className="text-gray-500">Free</p>
          ) : (
            <p className="text-gray-500">
              {Number(event.price) / 10 ** 18} cUSD
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <p className="text-gray-500">
            {convertDateFromMilliseconds(Number(event.date))}
          </p>
        </div>
      </div>
      <div className="mx-4 h-12 border-l border-gray-300"></div>
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <p className="text-gray-500">{event.time}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Ticket className="h-5 w-5 text-gray-500" />
          <p className="text-gray-500">
            {Date.now() > event.date ? "--" : `${Number(event.ticketsAvailable)}`}
          </p>
        </div>
      </div>
    </div>
    <p className="event-description mt-1 line-clamp-2 text-gray-600">
      {event.description}
    </p>
  </div>
</div>

                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
