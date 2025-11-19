"use client";

import { CalendarRange, CircleDollarSign, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReactStars from "react-rating-stars-component";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { processCheckout } from "@/lib/TokenFuction";
import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import { Header } from "@/components/header";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { toast } from "sonner";
import { generateTicketImage } from "@/components/shared/Ticket";
import Comment from "@/components/Comment";
import { celoSepolia } from "@/lib/celoSepolia";

interface Comment {
  commenter: string;
  text: string;
  timestamp: number;
}

export default function EventDetailsPage({
  params,
}: {
  params: { index: number };
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [cid, setCid] = useState("");
  const [over, setOver] = useState(false);
  const [free, setFree] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]); // For event comments
  const [holders, setHolders] = useState<`0x${string}`[]>([]);
  const [selectedRating, setSelectedRating] = useState(0); // Rating value
  const { writeContractAsync: getSubmission } = useWriteContract();
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState<number | undefined>(undefined);// Selected rating value
  const [passed, setPassed] = useState(false);
  const [showStar, setShowStar] = useState(false);
  // Add state for ticket quantity
  const [ticketQuantity, setTicketQuantity] = useState(1);

  const {
    data: event,
    isPending,
    error,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEvent",
    args: [BigInt(params.index)],
    chainId: celoSepolia.id,
  });
  console.log(event);

  const {
    data: hash,
    isPending: buyTicketPending,
    error: buyTicketError,
    writeContractAsync,
  } = useWriteContract();

  useEffect(() => {
    if (Number(event?.[8]) == 0) {
      setOver(true);
    }
    if (Number(event?.[7]) / 10 ** 18 == 0) {
      setFree(true);
      console.log(Number(event?.[7]) / 10 ** 18);
    }
    if (event?.[13]) {
      setComments(
        event[13].map((comment) => ({
          commenter: comment.commenter.toString(),
          text: comment.text,
          timestamp: Number(comment.timestamp),
        })),
      );
    } else {
      setComments([]);
    }
    if (event?.[11]) {
      setHolders([...event[11]]);
    }

    if (event?.[5]) {
      if (Date.now() > Number(event?.[5])) {
        setPassed(true);
      }
    }
  }, [event]);

  useEffect(() => {
    if (event?.[14] && event?.[15]) {
      const total = Number(event[14]);
      const count = Number(event[15]);
      const average = count > 0 ? (total / count).toFixed(2) : 0; // Calculate average safely

      console.log("Calculated average:", average);
      setRating(Number(average)); // Set as a number for ReactStars
    }
  }, [event]);

  useEffect(() => {
    if (rating !== undefined) { // Only show stars after rating is set
      console.log("Updated rating:", rating);
      setShowStar(true);
    }
  }, [rating]);

  async function buyTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!event) {
      return;
    }

    if (address === event?.[1]) {
      toast("You cannot buy your own ticket!", {
        description: "Go to the event dahsboard instead.",
        action: {
          label: "Go",
          onClick: () => router.push(`/my-events/${event?.[0]}`),
        },
      });

      return;
    }

    try {
      setProcessing(true);
      const totalCost = Number(event?.[7]) * ticketQuantity;

      // For free tickets, we don't need payment
      let paid = true;

      // For paid tickets, we need to approve the contract to spend tokens
      if (!free) {
        // Import the approval function
        const { approveTokens } = await import("@/lib/TokenFuction");

        // Approve the contract to spend the required amount
        paid = await approveTokens(contractAddress, BigInt(totalCost));
      }

      if (paid) {
        try {
          setProcessing(false);
          setIsUploading(true);

          // If buying multiple tickets
          if (ticketQuantity > 1) {
            // Generate multiple ticket images
            const nftUris = [];

            for (let i = 0; i < ticketQuantity; i++) {
              const ticketNumber = event?.[10]?.length + i + 1;

              // Generate the ticket image
              const nftImage = await generateTicketImage({
                eventName: event?.[2],
                date: new Date(Number(event?.[5])).toLocaleDateString("en-US", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                time: event?.[6],
                category: event?.[4],
                location: event?.[3],
                organiser: event?.[1],
                price: free
                  ? "Free"
                  : `${(Number(event?.[7]) / 10 ** 18).toString()} cUSD`,
                walletAddress: address as string,
                timestamp: Date.now(),
                ticketNo: ticketNumber,
              });

              console.log(nftImage);

              // Validate the generated image URL
              if (!nftImage || !nftImage.startsWith("data:image/png;base64,")) {
                throw new Error("Invalid NFT image URL.");
              }

              // Convert the base64 data URL to a blob
              const response = await fetch(nftImage);
              console.log(response);

              if (!response.ok) {
                throw new Error("Failed to fetch the image blob.");
              }

              const blob = await response.blob();

              // Prepare the blob for uploading to IPFS
              const data = new FormData();
              data.set("file", blob);

              const res = await fetch("/api/files", {
                method: "POST",
                body: data,
              });

              const resData = await res.json();
              nftUris.push(resData.IpfsHash);
            }

            // Buy multiple tickets
            const hash = await writeContractAsync({
              address: contractAddress,
              abi: rexellAbi,
              functionName: "buyTickets",
              args: [BigInt(params.index), nftUris, BigInt(ticketQuantity)],
            });

            if (hash) {
              toast("Ticket NFTs minted! Redirecting...");
              setIsUploading(false);
              router.push(`/my-tickets`);
            }
          } else {
            // Buy single ticket (existing logic)
            const ticketNumber = event?.[10]?.length + 1;

            // Generate the ticket image
            const nftImage = await generateTicketImage({
              eventName: event?.[2],
              date: new Date(Number(event?.[5])).toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              time: event?.[6],
              category: event?.[4],
              location: event?.[3],
              organiser: event?.[1],
              price: free
                ? "Free"
                : `${(Number(event?.[7]) / 10 ** 18).toString()} cUSD`,
              walletAddress: address as string,
              timestamp: Date.now(),
              ticketNo: ticketNumber,
            });

            console.log(nftImage);

            // Validate the generated image URL
            if (!nftImage || !nftImage.startsWith("data:image/png;base64,")) {
              throw new Error("Invalid NFT image URL.");
            }

            // Convert the base64 data URL to a blob
            const response = await fetch(nftImage);
            console.log(response);

            if (!response.ok) {
              throw new Error("Failed to fetch the image blob.");
            }

            const blob = await response.blob();

            // Prepare the blob for uploading to IPFS
            const data = new FormData();
            data.set("file", blob);

            const res = await fetch("/api/files", {
              method: "POST",
              body: data,
            });

            const resData = await res.json();
            setCid(resData.IpfsHash);

            const hash = await writeContractAsync({
              address: contractAddress,
              abi: rexellAbi,
              functionName: "buyTicket",
              args: [BigInt(params.index), resData.IpfsHash],
            });

            if (hash) {
              toast("Ticket NFT minted! Redirecting...");
              setIsUploading(false);
              router.push(`/tickets/${event?.[0]}`);
            }
          }
        } catch (error) {
          toast.error("Minting Ticket NFT failed!");
          console.log(error);
          return;
        } finally {
          setIsUploading(false);
        }
      } else {
        toast.error(`Failed to approve payment of ${totalCost / 10 ** 18} cUSD`);
      }
    } catch (error) {
      console.log(error);
      toast.error(
        `Purchase failed! Ensure you have ${Number(event?.[7]) / 10 ** 18} cUSD`,
      );
      toast.error(`${error}`);
    } finally {
      setProcessing(false);
    }
  }

  const handleRatingChange = (newRating: number) => {
    setSelectedRating(newRating); // Update rating value on change
  };

  const handleRatingSubmit = async () => {
    // Prevent form from refreshing the page
    if (!passed) {
      toast.error("You can only rate after the event has passed.");
      return;
    }

    if (!isConnected) {
      toast("Please connect wallet.");
      return;
    }

    if (!isTicketPurchased) {
      toast.error("Only ticket holders can rate.");
      return;
    }
    if (selectedRating === 0) {
      toast.error("Please select a rating before submitting.");
      return;
    }

    try {
      setLoading(true);
      const hash = await getSubmission({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "submitRating",
        args: [BigInt(params.index), selectedRating],
      });
      if (hash) {
        toast.success(`Rating of ${selectedRating}/5 submitted`);
        setSelectedRating(0);
      } else {
        toast.error("Something happened. Try again.");
      }
    } catch (error) {
      console.log(error);
      toast.error("Unable to submit rating. You have already rated the event.");
    } finally {
      setLoading(false);
    }
  };

  const isTicketPurchased = event?.[11].includes(address!!);

  return (
    <main className="bg-white">
      <div className="hidden sm:block">
        <Header />
      </div>
      <section className="flex w-full flex-col gap-8 rounded-lg bg-gray-100 py-12 shadow-lg">
        {error && (
          <div className="flex h-screen flex-col items-center justify-center space-y-4">
            <p className="text-lg font-semibold text-red-500">
              Error fetching event: {error.message}
            </p>
            <p>Please make sure you are connected to Celo Sepolia.</p>
          </div>
        )}

        {isPending && <Skeleton className="rounded-xl h-[500px]" />}

        {!isPending && !error && event && (
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="space-y-4">
                <div
                  className={`inline-block rounded-lg bg-blue-200 px-3 py-1 text-sm font-medium ${passed ? "text-red-600" : "text-blue-800"} `}
                >
                  {passed ? "Event passed" : "Upcoming Event"}
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  {event?.[2]}
                </h1>
                <div className="flex items-center space-x-4 text-gray-600">
                  <div className="flex items-center space-x-1">
                    <CalendarRange className="h-5 w-5" />
                    <p>{convertDateFromMilliseconds(Number(event?.[5]))}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-5 w-5" />
                    <p>{event?.[3]}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <CircleDollarSign className="h-6 w-6" />
                  <p className="text-2xl font-semibold">
                    {free ? "Free" : `${Number(event?.[7]) / 10 ** 18} cUSD`}
                  </p>
                </div>
                {!passed && (
                  <div className="flex items-center space-x-2">
                    <Ticket className="h-6 w-6" />
                    <p className="text-2xl font-normal">
                      {Number(event?.[8])} left
                    </p>
                  </div>
                )}
                {/* Ticket purchase form */}
                {isTicketPurchased ? (
                  <Link href={`/tickets/${event?.[0]}`} prefetch={false}>
                    <Button className="mt-4 w-full hover:bg-blue-600 sm:w-auto">
                      <Ticket className="mr-2 h-5 w-5" />
                      Unveil your NFT ticket
                    </Button>
                  </Link>
                ) : passed && isTicketPurchased ? (
                  <Link href={`/tickets/${event?.[0]}`} prefetch={false}>
                    <Button className="mt-4 w-full hover:bg-blue-600 sm:w-auto">
                      <Ticket className="mr-2 h-5 w-5" />
                      Unveil your NFT ticket
                    </Button>
                  </Link>
                ) : passed && !isTicketPurchased ? null : (
                  <form onSubmit={buyTicket}>
                    {/* Quantity selector */}
                    <div className="mb-4">
                      <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Tickets
                      </label>
                      <select
                        id="quantity"
                        value={ticketQuantity}
                        onChange={(e) => setTicketQuantity(parseInt(e.target.value))}
                        className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                        disabled={buyTicketPending || isTicketPurchased || isUploading || processing || over}
                      >
                        {[...Array(Math.min(10, Number(event?.[8]) || 10)).fill(0)].map((i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      className="w-full hover:bg-blue-600 sm:w-auto"
                      type="submit"
                      disabled={
                        buyTicketPending ||
                        isTicketPurchased ||
                        isUploading ||
                        processing ||
                        over
                      }
                    >
                      <Ticket className="mr-2 h-5 w-5" />
                      {processing
                        ? "Processing..."
                        : isUploading
                          ? "Minting NFT Ticket..."
                          : buyTicketPending
                            ? "Buying Ticket..."
                            : `Buy ${ticketQuantity} Ticket${ticketQuantity > 1 ? 's' : ''}`}
                    </Button>
                  </form>
                )}
                {showStar && (
                  <div className="flex items-center">
                    <ReactStars
                      count={5}
                      size={20}
                      activeColor="#ffd700"
                      value={rating}
                      isHalf={true}
                      edit={false}
                    />
                    <span className="text-gray-600">({Number(event?.[15])}){rating}</span>
                  </div>
                )}
              </div>
              <div className="relative">
                <Image
                  alt="Event banner"
                  className="mx-auto aspect-video rounded-lg object-cover shadow-lg"
                  height="600"
                  src={`https://ipfs.io/ipfs/${event?.[10]}`}
                  width="600"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-transparent to-black opacity-30"></div>
              </div>
            </div>
          </div>
        )}
      </section>

      {!isPending && !error && event && (
        <>
          <section className="w-full py-2 md:py-2 lg:py-2">
            <div className="container px-4 md:px-6">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                Description
              </h1>
              <p className="pt-6 text-gray-600">{event?.[9]}</p>
            </div>
          </section>

          {/* Comments Section */}
          <section className="container mx-auto px-4 py-8 md:px-6">
            <h2 className="mb-6 text-3xl font-bold text-gray-900">Comments</h2>
            <div className="space-y-6">
              {comments.map((comment, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-4 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
                >
                  <div className="flex-1">
                    {/* Comment Header with Name and Date */}
                    <div className="flex items-center">
                      <div>
                        <p className="text-xs text-gray-700">
                          {comment.commenter === address?.toString()
                            ? "You"
                            : `${comment.commenter.slice(0, 6)}...${comment.commenter.slice(-4)}`}
                        </p>

                        <p className="text-xs text-gray-500">
                          {new Date(
                            Number(comment.timestamp) * 1000,
                          ).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </p>

                        {/* Comment Text */}
                        <p className="mt-2 text-gray-800">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Comment eventId={Number(params.index)} ticketHolders={holders} />
            </div>
          </section>

          {/* Rating Section */}
          <section className="container px-4 py-8 md:px-6">
            <h2 className="mb-4 text-2xl font-semibold text-black">
              Rate the Event
            </h2>
            <ReactStars
              count={5}
              size={24}
              onChange={handleRatingChange} // Handle rating change
              value={rating} // Display the current rating
              activeColor="#ffd700"
            />
            <button
              onClick={handleRatingSubmit}
              disabled={loading}
              className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              {loading ? "Submitting..." : "Submit Rating"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
