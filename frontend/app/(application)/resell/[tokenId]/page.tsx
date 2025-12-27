"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseEther, formatEther } from "viem";
import { celoSepolia } from "@/lib/celoSepolia";
import { hardhat } from "wagmi/chains";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function ResellTicketPage({ params, searchParams }: { params: { tokenId: string }, searchParams?: { eventId?: string } }) {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const router = useRouter();
    const tokenId = BigInt(params.tokenId);
    const eventIdParam = searchParams?.eventId ? BigInt(searchParams.eventId) : null;

    const [price, setPrice] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data State
    const [eventData, setEventData] = useState<any>(null);
    const [ticketUri, setTicketUri] = useState<string>("");
    const [maxPrice, setMaxPrice] = useState<bigint>(BigInt(0));
    const [cutoffTime, setCutoffTime] = useState<Date | null>(null);

    // Contract Reads
    const { data: allEvents } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "getAllEvents",
        chainId: celoSepolia.id,
        query: {
            enabled: !eventIdParam // Only fetch all if we don't have ID
        }
    });

    // Optimized fetch if we have eventId
    const { data: specificEvent } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "getEvent",
        args: eventIdParam ? [eventIdParam] : undefined,
        chainId: celoSepolia.id,
        query: {
            enabled: !!eventIdParam
        }
    });

    const { data: uri } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "tokenURI",
        args: [tokenId],
        chainId: celoSepolia.id,
    });

    const { data: multiplier } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "maxResaleMultiplier",
        chainId: celoSepolia.id,
    });

    const { data: cutoffHours } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "resaleCutoffHours",
        chainId: celoSepolia.id,
    });

    const { data: royaltyPercent } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "royaltyPercent",
        chainId: celoSepolia.id,
    });

    const { data: platformFeePercent } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "platformFeePercent",
        chainId: celoSepolia.id,
    });

    // Load logic
    useEffect(() => {
        if ((allEvents || specificEvent) && uri && multiplier && cutoffHours) {
            const findEvent = async () => {
                let foundEvent = null;

                if (specificEvent) {
                    // Start transforming struct to usable object if needed, or use directly
                    // specificEvent is array/struct from contract: [id, organizer, name, ...]
                    // Mapping based on Rexell.sol getEvent return:
                    // 0:id, 1:org, 2:name, 3:venue, 4:cat, 5:date, 6:time, 7:price, ...
                    foundEvent = {
                        id: specificEvent[0],
                        organizer: specificEvent[1],
                        name: specificEvent[2],
                        venue: specificEvent[3],
                        category: specificEvent[4],
                        date: specificEvent[5],
                        time: specificEvent[6],
                        price: specificEvent[7],
                        ticketsAvailable: specificEvent[8],
                        description: specificEvent[9],
                        ipfs: specificEvent[10],
                        // ... fields
                    };
                } else if (allEvents) {
                    for (const ev of allEvents) {
                        if (ev.nftUris && ev.nftUris.includes(uri as string)) {
                            foundEvent = ev;
                            break;
                        }
                    }
                }

                if (foundEvent) {
                    setEventData(foundEvent);

                    // Calculate Limits
                    const maxMult = multiplier ? Number(multiplier) : 200;

                    if (foundEvent.price > BigInt(0)) {
                        const maxAllowed = (foundEvent.price * BigInt(maxMult)) / BigInt(100);
                        setMaxPrice(maxAllowed);
                    } else {
                        // If original price is 0, contract doesn't enforce max restriction based on percentage.
                        // We allows up to a reasonable high amount or unlimited.
                        setMaxPrice(parseEther("100000")); // 100k cUSD limit for free tickets effectively
                    }

                    const cutoffH = cutoffHours ? Number(cutoffHours) : 24;
                    // Fix: Date from contract is seconds. Convert to ms.
                    const eventDateMs = Number(foundEvent.date) * 1000;

                    setCutoffTime(new Date(eventDateMs - (cutoffH * 3600 * 1000)));

                    // Validation
                    const now = Date.now();
                    if (now > (eventDateMs - (cutoffH * 3600 * 1000))) {
                        setError("Resale period has ended for this event.");
                    }
                } else {
                    // Fallback if event not found (shouldn't happen if data is consistent)
                    setError("Could not find event details for this ticket.");
                }
                setLoading(false);
            };

            findEvent();
        }
    }, [allEvents, specificEvent, uri, multiplier, cutoffHours]);

    const handleSubmit = async () => {
        if (!price) return;
        if (error) return;

        const priceWei = parseEther(price);

        if (priceWei > maxPrice) {
            toast.error(`Price cannot exceed ${formatEther(maxPrice)} cUSD`);
            return;
        }

        try {
            setSubmitting(true);
            await writeContractAsync({
                address: contractAddress as `0x${string}`,
                abi: rexellAbi,
                functionName: "requestResaleVerification",
                args: [tokenId, priceWei],
            });
            toast.success("Resale Request Submitted!");
            router.push("/my-tickets"); // Or dashboard
        } catch (e: any) {
            console.error(e);
            toast.error("Failed: " + (e.message || "Unknown error"));
        } finally {
            setSubmitting(false);
        }
    };

    // Calculations for UI
    const priceVal = parseFloat(price || "0");
    const rPercent = royaltyPercent ? Number(royaltyPercent) : 5;
    const fPercent = platformFeePercent ? Number(platformFeePercent) : 2;

    const royaltyAmt = (priceVal * rPercent) / 100;
    const feeAmt = (priceVal * fPercent) / 100;
    const sellerAmt = priceVal - royaltyAmt - feeAmt;

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-800 flex items-center gap-2">
                            <AlertCircle /> Resale Unavailable
                        </CardTitle>
                        <CardDescription className="text-red-600">{error}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={() => router.back()}>Go Back</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const isFreeEvent = eventData?.price === BigInt(0);

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Set Resale Price</CardTitle>
                    <CardDescription>Listing Ticket #{tokenId.toString()} for {eventData?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 block">Original Price</span>
                            <span className="font-semibold">{eventData ? formatEther(eventData.price) : "-"} cUSD</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Max Resale Price</span>
                            <span className="font-semibold text-blue-600">
                                {isFreeEvent ? "Uncapped" : `${formatEther(maxPrice)} cUSD`}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">Your Listing Price (cUSD)</Label>
                        <Input
                            id="price"
                            type="number"
                            placeholder="0.00"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                            {isFreeEvent ? "Set any reasonable price." : `Must be less than ${formatEther(maxPrice)} cUSD.`}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm border">
                        <div className="flex justify-between">
                            <span>Organizer Royalty ({rPercent}%)</span>
                            <span className="font-medium">-{royaltyAmt.toFixed(2)} cUSD</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Platform Fee ({fPercent}%)</span>
                            <span className="font-medium">-{feeAmt.toFixed(2)} cUSD</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between text-base font-bold text-green-700">
                            <span>You Receive</span>
                            <span>{sellerAmt.toFixed(2)} cUSD</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !price || parseFloat(price) <= 0 || parseEther(price) > maxPrice}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {submitting ? <Loader2 className="animate-spin mr-2" /> : "Confirm & List"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
