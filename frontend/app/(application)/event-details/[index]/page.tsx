"use client";

import { CalendarRange, CircleDollarSign, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReactStars from "react-rating-stars-component";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { processCheckout } from "@/lib/TokenFuction";
import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import {
  tokencUSDAbi,
  tokencUSDContractAddress,
} from "@/blockchain/cUSD/TokenCusd";
import { soulboundIdentityAbi, soulboundIdentityAddress } from "@/blockchain/abi/soulbound-abi";
import { Header } from "@/components/header";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { convertDateFromMilliseconds } from "@/lib/utils";
import { toast } from "sonner";
import { generateTicketImage } from "@/components/shared/Ticket";
import Comment from "@/components/Comment";
import { celoSepolia } from '@/lib/celoSepolia';
import { aiModeService, EnforcementAction } from "@/lib/ai/ai-mode";
import { aiLogger } from "@/lib/ai/logger";
import { useGuardedPurchase } from "@/lib/bot-detection/useGuardedPurchase";
import { BotChallengeModal } from "@/components/AI/BotChallengeModal";
import { WarningModal } from "@/components/AI/WarningModal";
import { SeatMap } from "@/components/SeatMap";
import { logAppActivity } from "@/lib/activityLogger";

interface EventComment {
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
  const publicClient = usePublicClient();
  const [cid, setCid] = useState("");
  const [over, setOver] = useState(false);
  const [free, setFree] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [comments, setComments] = useState<EventComment[]>([]); // For event comments
  const [holders, setHolders] = useState<`0x${string}`[]>([]);
  const [selectedRating, setSelectedRating] = useState(0); // Rating value
  const { writeContractAsync: getSubmission } = useWriteContract();
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState<number | undefined>(undefined);// Selected rating value
  const [passed, setPassed] = useState(false);
  const [showStar, setShowStar] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  // Add state for ticket quantity
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<{ label: string; category: string; price: number }[]>([]);
  const [isReservingOnChain, setIsReservingOnChain] = useState(false);

  // AI Advisory warning modal state (FR-5.3.4)
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningData, setWarningData] = useState<{
    riskLevel: string;
    dominantRisk: string;
    confidenceScore: number;
    reason: string;
  } | null>(null);

  const handleWarningConfirm = () => {
    setWarningOpen(false);
    buyTicket(undefined, true);
  };

  const handleWarningCancel = () => {
    setWarningOpen(false);
    if (address) {
      aiLogger.log("purchase_failed", address, Number(params.index), {
        reason: "AI_WARNING_USER_ABORTED",
      });
    }
    toast.error("Purchase cancelled by user advisory.");
  };

  // Bot-detection guard (boots the behavioural tracker as soon as a wallet
  // is connected; runs POST /v1/detect before each purchase; gracefully
  // degrades when the backend is unreachable).
  const {
    runGuard,
    consumeToken: consumeBotToken,
    pendingChallenge,
    verifyChallenge,
    cancelChallenge,
  } = useGuardedPurchase({ walletAddress: address });

  const {
    data: eventData,
    isPending,
    error,
  } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getEvent",
    args: [BigInt(params.index)],
    chainId: celoSepolia.id,
  });

  const event = eventData as any;

  const { data: userTicketsData } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getUserPurchasedTickets",
    args: address ? [BigInt(params.index), address] : undefined,
    chainId: celoSepolia.id,
    query: {
      enabled: !!address,
    },
  });

  const purchasedTicketsCount = userTicketsData ? (userTicketsData as string[]).length : 0;
  const hasReachedLimit = purchasedTicketsCount >= 4;

  const { data: isVerified } = useReadContract({
    address: soulboundIdentityAddress as `0x${string}`,
    abi: soulboundIdentityAbi,
    functionName: "hasValidIdentity",
    args: [address as `0x${string}`],
    chainId: celoSepolia.id,
    query: {
      enabled: !!address
    }
  });

  const { data: identityDetails } = useReadContract({
    address: soulboundIdentityAddress as `0x${string}`,
    abi: soulboundIdentityAbi,
    functionName: "identities",
    args: [address as `0x${string}`],
    chainId: celoSepolia.id,
    query: {
      enabled: !!address
    }
  });

  const { data: cUSDBalance } = useReadContract({
    address: tokencUSDContractAddress,
    abi: tokencUSDAbi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  console.log(event);

  const {
    data: hash,
    isPending: buyTicketPending,
    error: buyTicketError,
    writeContractAsync,
  } = useWriteContract();

  const { writeContractAsync: approveContractAsync } = useWriteContract();

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
        event[13].map((comment: any) => ({
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
      if (Date.now() > Number(event?.[5]) * 1000) {
        setPassed(true);
      }
    }
    if (event?.[16] !== undefined) {
      setIsCancelled(Boolean(event[16]));
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

  const handleOnChainLock = async () => {
    if (selectedSeats.length === 0) {
      toast.error("Please select at least one seat first.");
      return;
    }
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }
    try {
      setIsReservingOnChain(true);
      const seatLabels = selectedSeats.map((s) => s.label);
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "lockSeats",
        args: [BigInt(params.index), seatLabels],
      });
      if (hash) {
        toast.success("Seats reserved on-chain successfully!");
      }
    } catch (error: any) {
      console.error("On-chain lock failed:", error);
      toast.error("Failed to lock seats on-chain: " + (error.message || "Unknown error"));
    } finally {
      setIsReservingOnChain(false);
    }
  };

  async function buyTicket(e?: React.FormEvent<HTMLFormElement>, bypassWarning = false) {
    if (e) e.preventDefault();
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

    const price = event?.[7] ? BigInt(event[7]) : 0n;
    const usingSeatMap = selectedSeats.length > 0;
    const finalQuantity = usingSeatMap ? selectedSeats.length : ticketQuantity;

    if (purchasedTicketsCount + finalQuantity > 4) {
      toast.error(`Purchase exceeds limit. You can only buy up to ${4 - purchasedTicketsCount} tickets (you already have ${purchasedTicketsCount}).`);
      return;
    }

    // Calculate totalCost dynamically based on selected seats prices or GA price
    const totalCost = usingSeatMap
      ? selectedSeats.reduce((acc, seat) => acc + BigInt(Math.floor(seat.price * 1e18)), 0n)
      : price * BigInt(ticketQuantity);

    console.log("Purchase debug:", {
      price: price.toString(),
      totalCost: totalCost.toString(),
      cUSDBalance: cUSDBalance?.toString(),
      free,
      quantity: finalQuantity,
    });

    if (totalCost > 0n && cUSDBalance !== undefined && BigInt(cUSDBalance as any) < totalCost) {
      toast.error(`Insufficient cUSD balance. You need ${Number(totalCost) / 10 ** 18} cUSD, but only have ${Number(cUSDBalance) / 10 ** 18} cUSD.`);
      return;
    }

    // --- AI Mode Integration ---
    if (address && !bypassWarning) {
      aiLogger.log('purchase_attempt', address, Number(params.index), { quantity: finalQuantity, price: totalCost.toString() });

      const risk = aiModeService.assessRisk(address, Number(params.index));

      if (risk.action === EnforcementAction.BLOCK) {
        aiLogger.log('purchase_failed', address, Number(params.index), { reason: 'AI_BLOCK', risk });
        toast.error("Transaction Blocked by AI Mode", {
          description: risk.reason,
        });
        return;
      }

      if (risk.action === EnforcementAction.WARNING) {
        setWarningData({
          riskLevel: risk.riskLevel,
          dominantRisk: risk.detectionType,
          confidenceScore: risk.confidenceScore,
          reason: risk.reason,
        });
        setWarningOpen(true);
        return;
      }
    }

    // --- Server-side bot-detection guard ---
    const guard = await runGuard({
      action: finalQuantity > 1 ? "buyTickets" : "buyTicket",
      quantity: finalQuantity,
      eventId: String(params.index),
    });
    if (!guard.proceed) {
      return;
    }

    try {
      setProcessing(true);
      let paid = true;

      let approvalError = "";
      // For paid tickets, we need to approve the contract to spend tokens.
      // We use walletClient.writeContract directly to send the approve tx
      // through MetaMask's own RPC, bypassing rate-limited public RPCs.
      if (totalCost > 0n) {
        try {
          // Check current allowance
          let currentAllowance = 0n;
          if (publicClient) {
            try {
              currentAllowance = await publicClient.readContract({
                address: tokencUSDContractAddress as `0x${string}`,
                abi: tokencUSDAbi,
                functionName: "allowance",
                args: [address as `0x${string}`, contractAddress as `0x${string}`],
              });
            } catch (err) {
              console.error("Failed to check allowance:", err);
            }
          }

          if (currentAllowance < totalCost) {
            toast.info("Approving cUSD spending...");
            const hash = await approveContractAsync({
              address: tokencUSDContractAddress as `0x${string}`,
              abi: tokencUSDAbi,
              functionName: "approve",
              args: [contractAddress as `0x${string}`, totalCost],
            });
            // Wait for confirmation if publicClient is available
            if (publicClient) {
              try {
                const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
                paid = receipt.status === "success";
                if (!paid) approvalError = "Approval transaction reverted on chain.";
              } catch {
                await new Promise(resolve => setTimeout(resolve, 5000));
                paid = true;
              }
            } else {
              await new Promise(resolve => setTimeout(resolve, 5000));
              paid = true;
            }
          } else {
            paid = true; // Allowance is already sufficient
          }
        } catch (error: any) {
          console.error("Approval error:", error);
          approvalError = error?.shortMessage || error?.message || String(error);
          paid = false;
        }
      }

      if (paid) {
        try {
          setProcessing(false);
          setIsUploading(true);

          // Fetch Anti-Sybil Attestation from Oracle
          toast.info("Requesting Anti-Sybil verification from Oracle...");
          let attestation;
          try {
            const oracleUrl = process.env.NEXT_PUBLIC_IDENTITY_ORACLE_URL || "http://localhost:5000";
            const attestResponse = await fetch(`${oracleUrl}/api/identity/attest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_address: address }),
            });
            if (!attestResponse.ok) {
              throw new Error("Failed to retrieve attestation from Anti-Sybil Oracle.");
            }
            const data = await attestResponse.json();
            
            attestation = {
              user: data.user as `0x${string}`,
              score: BigInt(data.score),
              expiresAt: BigInt(data.expiresAt),
              nonce: BigInt(data.nonce),
              signatures: data.signatures as `0x${string}`[]
            };

            // Enforce TrustScore and Soulbound Identity requirements for Tier 1 Bulk Purchase (3+ tickets total)
            const finalQuantity = selectedSeats.length > 0 ? selectedSeats.length : ticketQuantity;
            const totalTickets = purchasedTicketsCount + finalQuantity;
            if (totalTickets >= 3) {
              if (attestation.score < 70n) {
                toast.error(`Verification failed: Your Anti-Sybil score is ${data.score}/100. Score >= 70 required to buy 3+ tickets. Please boost your score in 'Manage Resales'.`);
                setIsUploading(false);
                return;
              }
              
              if (!isVerified) {
                toast.error("Soulbound Identity (RID) required to purchase 3+ tickets. Please mint one in 'Manage Resales'.");
                setIsUploading(false);
                return;
              }

              const activationTime = identityDetails ? Number((identityDetails as any)[2]) : 0;
              const ageInDays = (Date.now() / 1000 - activationTime) / (24 * 3600);
              if (ageInDays < 14) {
                toast.error(`Your Soulbound Identity must be at least 14 days old to purchase 3+ tickets (Current age: ${Math.floor(ageInDays)} days).`);
                setIsUploading(false);
                return;
              }
            }
          } catch (err: any) {
            console.error("Attestation error:", err);
            toast.error(`Anti-Sybil Verification Error: ${err.message || String(err)}`);
            setIsUploading(false);
            return;
          }

          if (usingSeatMap) {
            // Generate multiple ticket images with seat labels
            const nftUris = [];
            for (let i = 0; i < finalQuantity; i++) {
              const seat = selectedSeats[i];
              const ticketNumber = (event?.[12]?.length || 0) + i + 1;

              const nftImage = await generateTicketImage({
                eventName: event?.[2],
                date: new Date(Number(event?.[5]) * 1000).toLocaleDateString("en-US", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                time: event?.[6],
                category: seat.category,
                location: event?.[3],
                organiser: event?.[1],
                price: seat.price === 0 ? "Free" : `${seat.price.toFixed(2)} cUSD`,
                walletAddress: address as string,
                timestamp: Date.now(),
                ticketNo: ticketNumber,
                seatLabel: seat.label,
              });

              if (!nftImage || !nftImage.startsWith("data:image/png;base64,")) {
                throw new Error("Invalid NFT image URL.");
              }

              const response = await fetch(nftImage);
              if (!response.ok) {
                throw new Error("Failed to fetch the image blob.");
              }

              const blob = await response.blob();
              const data = new FormData();
              data.set("file", blob);

              const res = await fetch("/api/files", {
                method: "POST",
                body: data,
              });

              if (!res.ok) {
                throw new Error(`Failed to upload ticket image to IPFS: ${res.statusText}`);
              }

              const resData = await res.json();
              if (!resData.IpfsHash) {
                throw new Error("Failed to retrieve IPFS Hash from upload response.");
              }
              nftUris.push(resData.IpfsHash);
            }

            // Call overloaded buyTickets for seat-specific purchase
            const seatLabels = selectedSeats.map((s) => s.label);
            const categories = selectedSeats.map((s) => s.category);

            const hash = await writeContractAsync({
              address: contractAddress,
              abi: rexellAbi,
              functionName: "buyTickets",
              args: [BigInt(params.index), nftUris, seatLabels, categories, attestation],
            });

            if (hash) {
              if (guard.verificationToken) {
                consumeBotToken(guard.verificationToken, hash).catch(() => undefined);
              }
              // Clear off-chain lock keys
              await fetch("/api/seats/lock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "unlock",
                  eventId: Number(params.index),
                  seatLabels,
                  walletAddress: address,
                }),
              });

              toast("Ticket NFTs minted! Redirecting...");
              await logAppActivity(address || "", "BUY_TICKET", hash, {
                eventId: Number(params.index),
                eventName: event?.[2],
                quantity: finalQuantity,
                seats: seatLabels,
                categories,
                priceCusd: Number(totalCost) / 1e18
              });
              setIsUploading(false);
              router.push(`/my-tickets`);
            }
          } else if (ticketQuantity > 1) {
            // General Admission multiple tickets
            const nftUris = [];
            for (let i = 0; i < ticketQuantity; i++) {
              const ticketNumber = (event?.[12]?.length || 0) + i + 1;
              const nftImage = await generateTicketImage({
                eventName: event?.[2],
                date: new Date(Number(event?.[5]) * 1000).toLocaleDateString("en-US", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                time: event?.[6],
                category: event?.[4],
                location: event?.[3],
                organiser: event?.[1],
                price: free ? "Free" : `${(Number(event?.[7]) / 10 ** 18).toString()} cUSD`,
                walletAddress: address as string,
                timestamp: Date.now(),
                ticketNo: ticketNumber,
              });

              if (!nftImage || !nftImage.startsWith("data:image/png;base64,")) {
                throw new Error("Invalid NFT image URL.");
              }

              const response = await fetch(nftImage);
              if (!response.ok) {
                throw new Error("Failed to fetch the image blob.");
              }

              const blob = await response.blob();
              const data = new FormData();
              data.set("file", blob);

              const res = await fetch("/api/files", {
                method: "POST",
                body: data,
              });

              if (!res.ok) {
                throw new Error(`Failed to upload ticket image to IPFS: ${res.statusText}`);
              }

              const resData = await res.json();
              if (!resData.IpfsHash) {
                throw new Error("Failed to retrieve IPFS Hash from upload response.");
              }
              nftUris.push(resData.IpfsHash);
            }

            const hash = await writeContractAsync({
              address: contractAddress,
              abi: rexellAbi,
              functionName: "buyTickets",
              args: [BigInt(params.index), nftUris, BigInt(ticketQuantity), attestation],
            });

            if (hash) {
              if (guard.verificationToken) {
                consumeBotToken(guard.verificationToken, hash).catch(() => undefined);
              }
              toast("Ticket NFTs minted! Redirecting...");
              await logAppActivity(address || "", "BUY_TICKET", hash, {
                eventId: Number(params.index),
                eventName: event?.[2],
                quantity: ticketQuantity,
                type: "General Admission",
                priceCusd: Number(totalCost) / 1e18
              });
              setIsUploading(false);
              router.push(`/my-tickets`);
            }
          } else {
            // General Admission single ticket
            const ticketNumber = (event?.[12]?.length || 0) + 1;
            const nftImage = await generateTicketImage({
              eventName: event?.[2],
              date: new Date(Number(event?.[5]) * 1000).toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              time: event?.[6],
              category: event?.[4],
              location: event?.[3],
              organiser: event?.[1],
              price: free ? "Free" : `${(Number(event?.[7]) / 10 ** 18).toString()} cUSD`,
              walletAddress: address as string,
              timestamp: Date.now(),
              ticketNo: ticketNumber,
            });

            if (!nftImage || !nftImage.startsWith("data:image/png;base64,")) {
              throw new Error("Invalid NFT image URL.");
            }

            const response = await fetch(nftImage);
            if (!response.ok) {
              throw new Error("Failed to fetch the image blob.");
            }

            const blob = await response.blob();
            const data = new FormData();
            data.set("file", blob);

            const res = await fetch("/api/files", {
              method: "POST",
              body: data,
            });

            if (!res.ok) {
              throw new Error(`Failed to upload ticket image to IPFS: ${res.statusText}`);
            }

            const resData = await res.json();
            if (!resData.IpfsHash) {
              throw new Error("Failed to retrieve IPFS Hash from upload response.");
            }
            setCid(resData.IpfsHash);

            const hash = await writeContractAsync({
              address: contractAddress,
              abi: rexellAbi,
              functionName: "buyTickets",
              args: [BigInt(params.index), [resData.IpfsHash], BigInt(1), attestation],
            });

            if (hash) {
              if (address) {
                aiModeService.recordPurchase(address, Number(params.index));
                aiLogger.log('purchase_success', address, Number(params.index), { txHash: hash, quantity: 1 });
              }
              if (guard.verificationToken) {
                consumeBotToken(guard.verificationToken, hash).catch(() => undefined);
              }

              toast("Ticket NFT minted! Redirecting...");
              await logAppActivity(address || "", "BUY_TICKET", hash, {
                eventId: Number(params.index),
                eventName: event?.[2],
                quantity: 1,
                type: "General Admission",
                priceCusd: Number(totalCost) / 1e18
              });
              setIsUploading(false);
              router.push("/my-tickets");
            }
          }
        } catch (error: any) {
          toast.error(`Minting Ticket NFT failed: ${error.message || error}`);
          console.error("Minting error:", error);
          return;
        } finally {
          setIsUploading(false);
        }
      } else {
        toast.error(`Failed to approve payment of ${Number(totalCost) / 10 ** 18} cUSD. ${approvalError}`);
      }
    } catch (error) {
      console.log(error);
      toast.error(`Purchase failed! Ensure you have ${Number(totalCost) / 10 ** 18} cUSD`);
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
                    <p>{convertDateFromMilliseconds(Number(event?.[5]) * 1000)}</p>
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
                {purchasedTicketsCount > 0 && (
                  <div className="mb-4">
                    <Link href="/my-tickets" prefetch={false}>
                      <Button className="w-full hover:bg-blue-600 sm:w-auto bg-blue-500 text-white">
                        <Ticket className="mr-2 h-5 w-5" />
                        View your ticket{purchasedTicketsCount > 1 ? 's' : ''} ({purchasedTicketsCount}) in My Tickets
                      </Button>
                    </Link>
                  </div>
                )}
                {isCancelled ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-semibold mb-4">
                    🚫 This event has been cancelled by the organizer. Ticket sales are disabled.
                  </div>
                ) : passed ? null : hasReachedLimit ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold">
                    ⚠️ You have reached the purchase limit of 4 tickets for this event.
                  </div>
                ) : (
                  <form onSubmit={buyTicket} className="space-y-4">
                    {selectedSeats.length === 0 ? (
                      <>
                        <div className="mb-4">
                          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                            Number of Tickets (General Admission)
                          </label>
                          <select
                            id="quantity"
                            value={ticketQuantity}
                            onChange={(e) => setTicketQuantity(parseInt(e.target.value))}
                            className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                            disabled={buyTicketPending || hasReachedLimit || isUploading || processing || over}
                          >
                            {Array.from({ length: Math.min(4 - purchasedTicketsCount, Number(event?.[8]) || 4) }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>

                        <Button
                          className="w-full hover:bg-blue-600 sm:w-auto bg-blue-500 text-white"
                          type="submit"
                          disabled={
                            buyTicketPending ||
                            hasReachedLimit ||
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
                      </>
                    ) : (
                      <div className="space-y-4 p-4 border border-emerald-500/20 bg-emerald-50/50 rounded-xl">
                        <div>
                          <h3 className="text-sm font-semibold text-emerald-800">Selected Seats ({selectedSeats.length})</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedSeats.map((seat) => (
                              <span key={seat.label} className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white rounded-full">
                                {seat.label} ({seat.category})
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20">
                          <span className="text-sm text-gray-600">Total Price:</span>
                          <span className="text-xl font-bold text-emerald-700">
                            {selectedSeats.reduce((acc, seat) => acc + seat.price, 0).toFixed(2)} cUSD
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            type="submit"
                            disabled={
                              buyTicketPending ||
                              hasReachedLimit ||
                              isUploading ||
                              processing ||
                              over
                            }
                          >
                            <Ticket className="mr-2 h-5 w-5" />
                            {processing
                              ? "Processing..."
                              : isUploading
                                ? "Minting NFTs..."
                                : buyTicketPending
                                  ? "Confirming Transaction..."
                                  : "Buy Selected Seats"}
                          </Button>

                          <Button
                            className="flex-1 border border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold"
                            type="button"
                            onClick={handleOnChainLock}
                            disabled={
                              buyTicketPending ||
                              hasReachedLimit ||
                              isUploading ||
                              processing ||
                              isReservingOnChain ||
                              over
                            }
                          >
                            🔒 {isReservingOnChain ? "Reserving..." : "Reserve Seats On-Chain (10m)"}
                          </Button>
                        </div>
                      </div>
                    )}
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

            {/* Interactive Seat Map */}
            {!passed && !hasReachedLimit && !over && isConnected && !isCancelled && (
              <div className="mt-8 space-y-4 pt-8 border-t border-gray-200">
                <h2 className="text-2xl font-bold text-slate-800">Select Seats on Layout Map</h2>
                <p className="text-gray-500 text-sm">
                  Click on available seats (outlined green) to select them. Selected seats will place a temporary lock in Redis and let you buy specific spots.
                </p>
                <SeatMap
                  eventId={Number(params.index)}
                  basePrice={Number(event?.[7]) / 10 ** 18}
                  walletAddress={address as string}
                  onSelectionChange={(seats) => {
                    setSelectedSeats(seats);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {!isPending && !error && event && (
        <>
          <section className="w-full py-2 md:py-2 lg:py-2">
            <div className="container px-4 md:px-6">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                Description
              </h2>
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
      <BotChallengeModal
        challenge={pendingChallenge}
        onConfirm={async () => {
          // POST /v1/verify-challenge with the user's confirmation.
          // On success the hook stores the verification token returned
          // by the challenge service in a one-shot ref; the next
          // runGuard call returns it directly instead of re-running
          // detection (which would otherwise see the same elevated
          // risk score and re-issue a challenge → infinite loop).
          const ok = await verifyChallenge({ confirmed: true });
          if (ok) {
            toast(
              "Verification accepted. Click Buy again to complete the purchase.",
            );
          }
        }}
        onCancel={cancelChallenge}
      />
      <WarningModal
        isOpen={warningOpen}
        riskLevel={warningData?.riskLevel || "MEDIUM"}
        dominantRisk={warningData?.dominantRisk || "UNKNOWN"}
        confidenceScore={warningData?.confidenceScore || 0}
        reason={warningData?.reason || ""}
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
    </main>
  );
}
