"use client";

import Link from "next/link";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";

import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { CalendarIcon, MapPinIcon, UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { celoSepolia } from "@/lib/celoSepolia";
import { hardhat } from "wagmi/chains";

export default function MyEventsPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: eventsRaw,
    isPending,
    error,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEventsByOrganizer",
    args: [address!!],
    chainId: celoSepolia.id,
  });
  const events = eventsRaw as any[] | undefined;

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <main className="flex flex-col">
      <div className="hidden sm:block">
        <Header />
      </div>
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <h1 className="mb-3 text-3xl font-bold">My Events</h1>

        {!isConnected && (
          <div className="flex h-screen items-center justify-center">
            <p>Please connect your wallet</p>
          </div>
        )}

        {error && (
          <div className="flex h-screen flex-col items-center justify-center space-y-4">
            <p className="text-red-500">
              Error fetching events: {error.message}
            </p>
            <p>Please make sure you are connected to Celo Sepolia.</p>
          </div>
        )}

        {!error && events?.length === 0 && (
          <div className="flex h-screen items-center justify-center">
            <p>You have not created any event yet</p>
          </div>
        )}

        {isPending ? (
          <Skeleton className="h-[250px] w-[250px] rounded-xl" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events?.map((event: any) => (
              <Link href={`/my-events/${event.id}`} key={event.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-500">
                          {convertDateFromMilliseconds(Number(event.date) * 1000)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-500">{event.venue}</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-gray-500" />
                        <span className="text-gray-500">
                          {event.ticketHolders.length}{" "}
                          {event.ticketHolders.length === 1
                            ? "attendee"
                            : "attendees"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.isCancelled ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                            Cancelled
                          </span>
                        ) : event.ticketHolders.length === 0 ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm("Are you sure you want to delete this event?")) {
                                try {
                                  setActionLoading(true);
                                  await writeContractAsync({
                                    address: contractAddress,
                                    abi: rexellAbi,
                                    functionName: "deleteEvent",
                                    args: [BigInt(event.id)],
                                  });
                                  toast.success("Event deleted successfully!");
                                  refetch();
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to delete event");
                                } finally {
                                  setActionLoading(false);
                                }
                              }
                            }}
                            disabled={actionLoading}
                          >
                            Delete
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 bg-white"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm("Are you sure you want to cancel this event? This will invalidate all tickets.")) {
                                try {
                                  setActionLoading(true);
                                  await writeContractAsync({
                                    address: contractAddress,
                                    abi: rexellAbi,
                                    functionName: "cancelEvent",
                                    args: [BigInt(event.id)],
                                  });
                                  toast.success("Event cancelled successfully!");
                                  refetch();
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to cancel event");
                                } finally {
                                  setActionLoading(false);
                                }
                              }
                            }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </Button>
                        )}
                        <Link href={`/my-events/${event.id}`}>
                          <Button variant="outline" size="sm">
                            View Event
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
