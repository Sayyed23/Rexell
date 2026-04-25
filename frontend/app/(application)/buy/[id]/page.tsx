"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useParams, useRouter } from "next/navigation";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatEther } from "viem";
import { aiModeService, EnforcementAction } from "@/lib/ai/ai-mode";
import { aiLogger } from "@/lib/ai/logger";
import { useGuardedPurchase } from "@/lib/bot-detection/useGuardedPurchase";
import { BotChallengeModal } from "@/components/AI/BotChallengeModal";

interface ResaleTicket {
  tokenId: number;
  owner: string;
  price: number;
  eventId: number;
  isForSale: boolean;
  isResale: boolean;
}

const ROYALY_FEE_PERCENT = 0.05;

export default function BuyResaleTicketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [ticket, setTicket] = useState<ResaleTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Bot-detection guard — collects behavioural telemetry while the user
  // browses and runs POST /v1/detect before each resale purchase.
  const {
    runGuard,
    consumeToken: consumeBotToken,
    pendingChallenge,
    verifyChallenge,
    cancelChallenge,
  } = useGuardedPurchase({ walletAddress: address });

  // Get resale request details
  const { data: resaleRequest, isPending: isResaleRequestPending } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getResaleRequest",
    args: id ? [BigInt(id)] : undefined,
    query: {
      enabled: !!id,
    }
  });

  // Get token URI
  const { data: tokenURI, isPending: isTokenURIPending } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "tokenURI",
    args: id ? [BigInt(id)] : undefined,
    query: {
      enabled: !!id,
    }
  });

  // Load ticket details
  useEffect(() => {
    if (resaleRequest && !isResaleRequestPending && id) {
      setTicket({
        tokenId: Number(id),
        owner: resaleRequest.owner,
        price: parseFloat(formatEther(resaleRequest.price)),
        eventId: 0, // Would need to store eventId in ticket struct
        isForSale: resaleRequest.approved && !resaleRequest.rejected,
        isResale: true,
      });
      setLoading(false);
    } else if (!isResaleRequestPending && id) {
      setLoading(false);
    }
  }, [resaleRequest, isResaleRequestPending, id]);

  const handlePurchase = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!ticket || !id) {
      toast.error("Ticket information not available");
      return;
    }

    try {
      if (address && ticket) {
        // Log attempt
        aiLogger.log('resale_attempt', address, ticket.eventId, { ticketId: ticket.tokenId, price: ticket.price });

        // Using ticket.eventId if available, otherwise 0
        const risk = aiModeService.assessRisk(address, ticket.eventId);

        if (risk.action === EnforcementAction.BLOCK) {
          aiLogger.log('purchase_failed', address, ticket.eventId, { reason: 'AI_BLOCK_RESALE', risk });
          toast.error("Transaction Blocked by AI Mode", {
            description: risk.reason,
          });
          return;
        }

        if (risk.action === EnforcementAction.WARNING) {
          toast.warning("AI Mode Warning", {
            description: risk.reason,
          });
        }
      }

      // Server-side bot-detection guard. Resales are particularly
      // scalper-prone, so we always run /v1/detect with action=resale.
      const guard = await runGuard({
        action: "resale",
        eventId: id,
      });
      if (!guard.proceed) {
        return;
      }

      setIsPurchasing(true);

      const priceInWei = BigInt(Math.floor(ticket.price * 1e18));

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "buyResaleTicket",
        args: [BigInt(id), priceInWei],
      });

      if (hash) {
        if (address && ticket) {
          aiModeService.recordPurchase(address, ticket.eventId);
          aiLogger.log('resale_success', address, ticket.eventId, { ticketId: ticket.tokenId, txHash: hash });
        }
        // Use the local guard token directly. setState would be stale here
        // because React schedules updates for the next render.
        if (guard.verificationToken) {
          consumeBotToken(guard.verificationToken, hash).catch(
            () => undefined,
          );
        }
        toast.success("Ticket purchased successfully!");
        setTimeout(() => {
          router.push("/my-tickets");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error purchasing ticket:", error);

      if (error.message && error.message.includes("Ticket not approved")) {
        toast.error("This ticket is not approved for resale");
      } else if (error.message && error.message.includes("Price exceeds maximum")) {
        toast.error("Price has changed since page load");
      } else if (error.message && error.message.includes("insufficient funds")) {
        toast.error("Insufficient funds for purchase");
      } else {
        toast.error("Failed to purchase ticket: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Buy Resale Ticket</CardTitle>
            <CardDescription>Purchase a ticket from the secondary market</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Please connect your wallet to purchase resale tickets</p>
            <Button>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || isResaleRequestPending || isTokenURIPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Buy Resale Ticket</CardTitle>
            <CardDescription>Loading ticket details...</CardDescription>
          </CardHeader>
          <CardContent className="py-8">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket || !ticket.isForSale) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Ticket Not Available</CardTitle>
            <CardDescription>This ticket is not available for purchase</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="text-5xl mb-4">🎟️</div>
            <p className="text-gray-600 mb-6">
              This ticket is either not approved for resale or has already been purchased.
            </p>
            <Button asChild>
              <a href="/market">Browse Marketplace</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            ← Back to Marketplace
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Resale Ticket Purchase</CardTitle>
                <CardDescription>
                  Review the details before purchasing this ticket
                </CardDescription>
              </div>
              <Badge variant="secondary">Resale</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-64 flex items-center justify-center">
                  <span className="text-gray-500">Ticket Image</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Ticket #{ticket.tokenId}</h3>
                  <p className="text-gray-600">Event ID: {ticket.eventId}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seller:</span>
                    <span className="font-mono text-sm">{ticket.owner.substring(0, 6)}...{ticket.owner.substring(ticket.owner.length - 4)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Price:</span>
                    <span className="text-xl font-bold">{ticket.price.toFixed(2)} cUSD</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Royalty Fee (5%):</span>
                    <span className="text-gray-800">{(ticket.price * ROYALY_FEE_PERCENT).toFixed(2)} cUSD</span>
                  </div>

                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Total:</span>
                    <span className="text-xl font-bold">{(ticket.price).toFixed(2)} cUSD</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">Purchase Information</h3>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>You will receive ownership of this NFT ticket after purchase</li>
                <li>A 5% royalty fee is included in the price and goes to the event organizer</li>
                <li>This transaction is secured by the blockchain</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={isPurchasing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isPurchasing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing Purchase...
                  </>
                ) : (
                  `Buy for ${ticket.price.toFixed(2)} cUSD`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <BotChallengeModal
        challenge={pendingChallenge}
        onConfirm={async () => {
          // POST /v1/verify-challenge → on success the hook primes a
          // verification token so the next runGuard short-circuits
          // detection (otherwise we'd re-trigger the same challenge
          // and loop forever).
          const ok = await verifyChallenge({ confirmed: true });
          if (ok) {
            toast(
              "Verification accepted. Click Buy again to complete the purchase.",
            );
          }
        }}
        onCancel={cancelChallenge}
      />
    </div>
  );
}