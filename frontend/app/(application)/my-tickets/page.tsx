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
import { hardhat } from "wagmi/chains";
import QRCode from "react-qr-code";
import { Calendar, MapPin, Ticket as TicketIcon } from "lucide-react";

const Page = () => {
  const { isConnected, address } = useAccount();

  // 1. Get Events where user has tickets
  const { data: events, isPending: eventsPending, error } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: rexellAbi,
    functionName: "getUserPurchasedEvents",
    args: [address as `0x${string}`],
    chainId: celoSepolia.id,
    query: {
      enabled: !!address
    }
  }) as { data: any[]; isPending: boolean; error: any };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient) return null;

  return (
    <main className="flex flex-col min-h-screen bg-gray-50">
      <div className="hidden sm:block">
        <Header />
      </div>

      <div className="flex-1 px-4 py-8 md:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">My Tickets</h1>

        {!isConnected && (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg shadow-sm border border-gray-100">
            <p className="text-lg text-gray-600 mb-4">Please connect your wallet to view your tickets.</p>
          </div>
        )}

        {error && isConnected && (
          <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
            Error loading tickets: {error.message}
          </div>
        )}

        {!error && isConnected && (!events || events.length === 0) && !eventsPending && (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TicketIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets found</h3>
            <p className="text-gray-500 mb-6">You haven't purchased any tickets yet.</p>
            <Link href="/events">
              <Button>Browse Events</Button>
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {eventsPending ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-6">
                <Skeleton className="h-48 w-48 rounded-lg" />
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))
          ) : (
            events?.map((event: any) => (
              <EventTicketGroup key={event.id} event={event} address={address as `0x${string}`} />
            ))
          )}
        </div>
      </div>
    </main>
  );
};

// Component to handle a group of tickets for a specific event
const EventTicketGroup = ({ event, address }: { event: any, address: `0x${string}` }) => {
  const { data: userUris, isPending } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: rexellAbi,
    functionName: "getUserPurchasedTickets",
    args: [event.id, address],
    chainId: celoSepolia.id,
  }) as { data: string[], isPending: boolean };

  if (isPending) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!userUris || userUris.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Event Header */}
      <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center gap-4">
        <div className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0">
          {event.ipfs ? (
            <Image
              src={`https://ipfs.io/ipfs/${event.ipfs}`}
              alt={event.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900">{event.name}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(Number(event.date) * 1000).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.venue}</span>
          </div>
        </div>

        <div className="ml-auto">
          <Link href={`/event-details/${event.id}`}>
            <Button variant="ghost" size="sm">Event Details</Button>
          </Link>
        </div>
      </div>

      {/* Tickets List */}
      <div className="divide-y divide-gray-100">
        {userUris.map((uri, index) => (
          <TicketItem
            key={`${event.id}-${index}-${uri}`}
            eventId={event.id}
            uri={uri}
            address={address}
            index={index}
            total={userUris.length}
          />
        ))}
      </div>
    </div>
  );
};

const TicketItem = ({ eventId, uri, address, index, total }: { eventId: bigint, uri: string, address: `0x${string}`, index: number, total: number }) => {
  const { data: tokenId } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: rexellAbi,
    functionName: "getTokenIdByUserAndUri",
    args: [address, uri],
    chainId: celoSepolia.id,
  });

  // Safe check for valid token ID (including 0)
  const hasTokenId = tokenId !== undefined && tokenId !== null;

  return (
    <div className="p-6 transition-colors hover:bg-gray-50/50">
      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">

        {/* Ticket Info Section */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-black/5 text-black/60 text-xs font-semibold px-2 py-1 rounded">
                TICKET {index + 1} OF {total}
              </span>
              {hasTokenId && (
                <span className="bg-blue-50 text-blue-600 text-xs font-mono px-2 py-1 rounded">
                  ID: #{tokenId.toString()}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 max-w-lg">
              This ticket verifies your entry. Present the QR code at the venue.
            </div>
          </div>

          <div className="flex gap-3">
            {hasTokenId ? (
              <Link href={`/resell/${tokenId}?eventId=${eventId}`}>
                <Button variant="outline" className="border-gray-300 hover:bg-white hover:border-gray-400">
                  Sell Ticket
                </Button>
              </Link>
            ) : (
              <Button disabled variant="outline">Loading ID...</Button>
            )}
          </div>
        </div>

        {/* QR Code Section - Right/Bottom */}
        <div className="flex-shrink-0 bg-white p-3 rounded-xl border border-dashed border-gray-300 shadow-sm mx-auto md:mx-0">
          {hasTokenId ? (
            <div className="space-y-2 text-center">
              <QRCode
                value={tokenId.toString()}
                size={120}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
              <p className="text-[10px] font-mono text-gray-400">SCAN TO VERIFY</p>
            </div>
          ) : (
            <div className="h-[120px] w-[120px] bg-gray-100 animate-pulse rounded flex items-center justify-center text-xs text-gray-400">
              Generating...
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Page;
