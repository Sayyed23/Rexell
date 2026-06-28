"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReadContract, useAccount } from "wagmi";
import { 
  Calendar, 
  CircleDollarSign, 
  Clock, 
  Ticket, 
  Search, 
  SlidersHorizontal, 
  X,
  MapPin,
  User 
} from "lucide-react";

import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";

import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { celoSepolia } from "@/lib/celoSepolia";
import { Header } from "@/components/header";

export default function EventsPage() {
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedOrganizer, setSelectedOrganizer] = useState("All");

  const { data, isPending, error, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: rexellAbi,
    functionName: "getAllEvents",
    chainId: celoSepolia.id,
  });

  // To prevent hydration issues, ensure the component only runs on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  interface Event {
    id: bigint;
    organizer: string;
    name: string;
    venue: string;
    category: string;
    date: bigint;
    time: string;
    price: bigint;
    ticketsAvailable: bigint;
    description: string;
    ipfs: string;
    ticketHolders: string[];
    nftUris: string[];
    averageRating: bigint;
    isCancelled: boolean;
  }

  const events = useMemo(() => (data as unknown as Event[]) || [], [data]);

  // Extract unique categories dynamically
  const categories = useMemo(() => {
    const list = events.map((e) => e.category).filter(Boolean);
    return ["All", ...Array.from(new Set(list))];
  }, [events]);

  // Extract unique organizers dynamically (normalized for comparison)
  const organizers = useMemo(() => {
    const list = events.map((e) => e.organizer).filter(Boolean);
    const uniqueNormalized = Array.from(new Set(list.map((org) => org.toLowerCase())));
    return [
      "All",
      ...uniqueNormalized.map((normalizedOrg) => {
        return list.find((org) => org.toLowerCase() === normalizedOrg) || normalizedOrg;
      }),
    ];
  }, [events]);

  // Truncate address helper for layout space saving
  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    if (addr === "All") return "All Organizers";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Multiple Dynamic Filter logic
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Hide deleted events (cancelled with 0 attendees)
      if (event.isCancelled && (!event.ticketHolders || event.ticketHolders.length === 0)) {
        return false;
      }

      const matchSearch = searchQuery
        ? event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.venue.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const matchCategory =
        selectedCategory === "All" || event.category === selectedCategory;

      const matchOrganizer =
        selectedOrganizer === "All" ||
        event.organizer.toLowerCase() === selectedOrganizer.toLowerCase();

      return matchSearch && matchCategory && matchOrganizer;
    });
  }, [events, searchQuery, selectedCategory, selectedOrganizer]);

  useEffect(() => {
    if (events) {
      console.log("Events data:", events);
    }
  }, [events]);

  useEffect(() => {
    if (error) {
      console.error("Error fetching events:", error);
    }
  }, [error]);

  // Refetch events when the component mounts or when the address changes
  useEffect(() => {
    if (isConnected) {
      refetch();
    }
  }, [isConnected, refetch]);

  // Poll for new events every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        refetch();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, refetch]);

  // Prevent rendering the content until the component is on the client-side
  if (!isClient) return null;

  return (
    <main className="flex flex-col px-4">
      <Header />
      <section className="py-6">
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl text-gray-900">
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
                <div className="flex h-screen flex-col items-center justify-center space-y-4">
                  <p className="text-red-500">
                    Error fetching events: {error.message}
                  </p>
                  <p>Please make sure you are connected to Celo Sepolia.</p>
                </div>
              )}

              {/* Glassmorphic Filters Dock (Premium Minimal UI) */}
              {isConnected && !error && events.length > 0 && (
                <div className="bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm rounded-2xl p-4 md:p-6 mb-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    
                    {/* Search Field */}
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5" />
                        Search Events
                      </label>
                      <div className="relative">
                        <Input
                          placeholder="Search by name or venue..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-3 pr-8 bg-white border-gray-200 focus-visible:ring-gray-400 text-gray-800 rounded-lg"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Clear search"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div className="w-full md:w-48 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Category
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === "All" ? "All Categories" : cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Organizer Selector */}
                    <div className="w-full md:w-56 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Organizer
                      </label>
                      <select
                        value={selectedOrganizer}
                        onChange={(e) => setSelectedOrganizer(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer"
                      >
                        {organizers.map((org) => (
                          <option key={org} value={org}>
                            {org === "All" ? "All Organizers" : truncateAddress(org)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Clear Filters Quick Action */}
                    {(searchQuery || selectedCategory !== "All" || selectedOrganizer !== "All") && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory("All");
                          setSelectedOrganizer("All");
                        }}
                        className="h-10 px-4 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors text-sm font-semibold flex items-center justify-center gap-1.5 w-full md:w-auto"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isPending ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4 lg:gap-10">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-[400px] rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Empty/Fallback State 1: No events in contract at all */}
                  {!error && events?.length === 0 && (
                    <div className="flex h-[40vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                      <Calendar className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="font-semibold text-gray-700 text-lg">No events found</p>
                      <p className="text-sm text-gray-500 mt-1 max-w-sm">
                        There are currently no events registered on-chain. Create a new event to get started!
                      </p>
                    </div>
                  )}

                  {/* Empty/Fallback State 2: Filters match zero events */}
                  {!error && events?.length > 0 && filteredEvents.length === 0 && (
                    <div className="flex h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/30 p-8 text-center">
                      <div className="p-3 bg-gray-100 rounded-full mb-3 text-gray-500">
                        <Search className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-gray-800 text-lg">No matching events found</p>
                      <p className="text-sm text-gray-500 mt-1 max-w-xs">
                        We couldn&apos;t find any events that match your search terms or filters.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory("All");
                          setSelectedOrganizer("All");
                        }}
                        className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  )}

                  {/* Render filtered events list */}
                  {!error && filteredEvents.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4 lg:gap-10">
                      {filteredEvents.map((event: Event) => (
                        <Link href={`/event-details/${event.id.toString()}`} key={event.id.toString()}>
                          <div className="event-card overflow-hidden rounded-lg bg-white shadow-lg transition-shadow duration-300 hover:shadow-2xl relative">
                            {/* Display Cancelled or Ended overlays */}
                            {event.isCancelled ? (
                              <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-red-600 bg-opacity-75 text-white text-xl font-bold z-10 uppercase tracking-widest">
                                Cancelled
                              </div>
                            ) : Date.now() > Number(event.date) * 1000 ? (
                              <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xl font-semibold z-10">
                                Ended
                              </div>
                            ) : null}

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
                              <h3 className="mb-2 text-lg font-semibold text-gray-800 md:text-xl line-clamp-1">
                                {event.name}
                              </h3>
                              <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2">
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
                                      {convertDateFromMilliseconds(Number(event.date) * 1000)}
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
                                      {Date.now() > Number(event.date) * 1000 ? "--" : `${Number(event.ticketsAvailable)}`}
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
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}