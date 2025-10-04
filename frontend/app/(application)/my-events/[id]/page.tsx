"use client";

import { CalendarRange, MapPin, User, Ticket } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";

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
import { useEffect } from "react";

export default function EventDetailsPage({
  params,
}: {
  params: { id: number };
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const {
    data: event,
    isPending,
    error,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEvent",
    args: [BigInt(params.id)],
  });

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
                  {convertDateFromMilliseconds(Number(event?.[5]))}
                </div>
                <div>
                  <MapPin className="mr-1 inline-block h-5 w-5" />
                  {/* {event?.venue} */}
                  {event?.[3]}
                </div>
                <div>
                  <Ticket className="mr-1 inline-block h-5 w-5" />
                  {/* {event?.ticketsAvailable} */}
                  {Number(event?.[8]) } left
                </div>
              </div>
            </div>
            <div className="prose max-w-none">{event?.[9]}</div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-100 p-6 ">
              <h2 className="mb-4 text-xl font-bold">Ticket Sales</h2>
              {/* <div className="flex items-start justify-between"> */}
              <div className="flex items-center gap-2 ">
                <p className="text-4xl font-semibold">{event?.[11].length}</p>
                <p className="text-gray-500 ">
                  {event?.[12].length === 1 ? "Ticket Sold" : "Tickets Sold"}
                </p>
              </div>
              {/* <Button variant="outline">View Tickets</Button> */}
              {/* </div> */}
            </div>
            <div className="rounded-lg bg-gray-100 p-6 ">
              <h2 className="mb-4 text-xl font-bold">Attendees</h2>
              <ul className="space-y-4">
                {event?.[11].length === 0 ? (
                  <div className="">
                    <p>No attendees yet</p>
                  </div>
                ) : (
                  event?.[11].map((attendee, index) => (
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
