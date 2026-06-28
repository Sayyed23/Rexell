"use client";

import { useState, useEffect } from "react";
import { CalendarRange, MapPin, User, Ticket } from "lucide-react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { celoSepolia } from "@/lib/celoSepolia";
import { toast } from "sonner";

import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import { Button } from "@/components/shared/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { AIDemandForecast } from "@/components/AI/AIDemandForecast";

export default function EventDetailsPage({
  params,
}: {
  params: { id: number };
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: eventRaw,
    isPending,
    error,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEvent",
    args: [BigInt(params.id)],
  });
  const event = eventRaw as any;

  // Read escrow balance
  const { data: escrowBalance, refetch: refetchEscrow } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "eventEscrow",
    args: [BigInt(params.id)],
    chainId: celoSepolia.id,
  });

  const buyers = (event?.[11] || []) as string[];
  const nftUris = (event?.[12] || []) as string[];

  // 1. Get token IDs for all sold tickets
  const tokenIdCalls = buyers.map((buyer, idx) => ({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getTokenIdByUserAndUri",
    args: [buyer, nftUris[idx]],
    chainId: celoSepolia.id,
  }));

  const { data: tokenIdsResult, isPending: isTokenIdsPending } = useReadContracts({
    contracts: tokenIdCalls,
    query: {
      enabled: buyers.length > 0,
    }
  }) as any;

  const tokenIds = tokenIdsResult 
    ? tokenIdsResult.map((res: any) => res.result ? BigInt(res.result) : 0n) 
    : [];

  // 2. Check if those token IDs are cancelled
  const cancelledCalls = tokenIds.map((tokenId: any) => ({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "isTicketCancelled",
    args: [tokenId],
    chainId: celoSepolia.id,
  }));

  const { data: cancelledResult, isPending: isCancelledPending } = useReadContracts({
    contracts: cancelledCalls,
    query: {
      enabled: tokenIds.length > 0,
    }
  }) as any;

  const cancelledStatuses = cancelledResult 
    ? cancelledResult.map((res: any) => !!res.result) 
    : [];

  const activeAttendees = cancelledStatuses.length === buyers.length 
    ? buyers.filter((_: any, idx: number) => !cancelledStatuses[idx]) 
    : buyers;

  const activeSalesCount = cancelledStatuses.length === buyers.length 
    ? tokenIds.filter((_: any, idx: number) => !cancelledStatuses[idx]).length 
    : buyers.length;

  useEffect(() => {
    if (event) {
      console.log(event);
    }
  }, [event]);

  if (!isConnected) {
    router.push("/");
    return;
  }

  if (isPending) {
    return (
      <main className="mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-64 w-full rounded-lg" />
      </main>
    );
  }

  if (event) {
    console.log(event);
  }

  return (
    <main>
      <div className="hidden sm:block">
        <Header />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold">{event?.[2]}</h1>
              <div className="flex items-center space-x-4 text-gray-500">
                <div>
                  <CalendarRange className="mr-1 inline-block h-5 w-5" />
                  {/* {event?.date} */}
                  {convertDateFromMilliseconds(Number(event?.[5]) * 1000)}
                </div>
                <div>
                  <MapPin className="mr-1 inline-block h-5 w-5" />
                  {/* {event?.venue} */}
                  {event?.[3]}
                </div>
                <div>
                  <Ticket className="mr-1 inline-block h-5 w-5" />
                  {/* {event?.ticketsAvailable} */}
                  {Number(event?.[8])} left
                </div>
              </div>
            </div>
            <div className="prose max-w-none">{event?.[9]}</div>
          </div>

          <div className="space-y-6">
            {(() => {
              // Action functions
              const handleDeleteEvent = async () => {
                try {
                  setActionLoading(true);
                  const hash = await writeContractAsync({
                    address: contractAddress,
                    abi: rexellAbi,
                    functionName: "deleteEvent",
                    args: [BigInt(params.id)],
                  });
                  if (hash) {
                    toast.success("Event deleted successfully!");
                    router.push("/my-events");
                  }
                } catch (e: any) {
                  console.error(e);
                  toast.error(e.message || "Failed to delete event");
                } finally {
                  setActionLoading(false);
                }
              };

              const handleCancelEvent = async () => {
                try {
                  setActionLoading(true);
                  const hash = await writeContractAsync({
                    address: contractAddress,
                    abi: rexellAbi,
                    functionName: "cancelEvent",
                    args: [BigInt(params.id)],
                  });
                  if (hash) {
                    toast.success("Event cancelled successfully!");
                    refetch();
                  }
                } catch (e: any) {
                  console.error(e);
                  toast.error(e.message || "Failed to cancel event");
                } finally {
                  setActionLoading(false);
                }
              };

              const handleWithdrawFunds = async () => {
                try {
                  setActionLoading(true);
                  const hash = await writeContractAsync({
                    address: contractAddress,
                    abi: rexellAbi,
                    functionName: "withdrawEventFunds",
                    args: [BigInt(params.id)],
                  });
                  if (hash) {
                    toast.success("Funds withdrawn successfully!");
                    refetchEscrow();
                  }
                } catch (e: any) {
                  console.error(e);
                  toast.error(e.message || "Failed to withdraw funds");
                } finally {
                  setActionLoading(false);
                }
              };

              return (
                <div className="space-y-6">
                  <AIDemandForecast eventId={`EVT_${String(params.id).padStart(3, "0")}`} />

                  {/* Actions Panel */}
                  <div className="rounded-lg bg-gray-100 p-6 space-y-4">
                    <h2 className="text-xl font-bold">Organizer Actions</h2>
                    
                    {event?.[16] ? (
                      <div className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-sm font-semibold text-center">
                        ⚠️ This event has been cancelled.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {activeSalesCount === 0 ? (
                          <Button 
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded"
                            onClick={handleDeleteEvent}
                            disabled={actionLoading}
                          >
                            Delete Event
                          </Button>
                        ) : (
                          <Button 
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded"
                            onClick={handleCancelEvent}
                            disabled={actionLoading}
                          >
                            Cancel Event
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Escrow & Withdrawal */}
                    {escrowBalance !== undefined && (
                      <div className="pt-4 border-t border-gray-200 mt-4 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 font-medium">Escrow Balance:</span>
                          <span className="font-bold text-slate-800">{Number(escrowBalance) / 1e18} cUSD</span>
                        </div>
                        {!event?.[16] && Date.now() >= Number(event?.[5]) * 1000 && Number(escrowBalance) > 0 && (
                          <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded"
                            onClick={handleWithdrawFunds}
                            disabled={actionLoading}
                          >
                            Withdraw Ticket Sales
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-gray-100 p-6 ">
                    <h2 className="mb-4 text-xl font-bold">Ticket Sales</h2>
                    <div className="flex items-center gap-2 ">
                      <p className="text-4xl font-semibold">{activeSalesCount}</p>
                      <p className="text-gray-500 ">
                        {activeSalesCount === 1 ? "Ticket Sold" : "Tickets Sold"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="rounded-lg bg-gray-100 p-6 ">
              <h2 className="mb-4 text-xl font-bold">Attendees</h2>
              <ul className="space-y-4">
                {activeAttendees.length === 0 ? (
                  <div className="">
                    <p>No attendees yet</p>
                  </div>
                ) : (
                  activeAttendees.map((attendee: any, index: number) => (
                    <li className="flex items-center gap-2" key={index}>
                      <div>
                        <User />
                      </div>
                      <p>{attendee.slice(0, 6) + "..." + attendee.slice(-4)}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
