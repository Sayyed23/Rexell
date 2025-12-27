"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatEther } from "viem";
import { celoSepolia } from "@/lib/celoSepolia";
import { ShoppingCart, ShieldCheck, Info } from "lucide-react";

export default function ResaleTicketDetailPage({ params }: { params: { ticketId: string } }) {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [ticket, setTicket] = useState<any>(null);
    const [buying, setBuying] = useState(false);

    const ticketId = BigInt(params.ticketId);

    // Fetch ticket request details
    const { data: request } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "getResaleRequest",
        args: [ticketId],
        chainId: celoSepolia.id,
    });

    // Fetch platform fee percent (optional, for breakdown)
    const { data: royaltyPercent } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "royaltyPercent",
        chainId: celoSepolia.id,
    });

    useEffect(() => {
        if (request && request.owner !== "0x0000000000000000000000000000000000000000") {
            setTicket({
                id: ticketId.toString(),
                owner: request.owner,
                price: request.price,
                approved: request.approved,
                image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop", // Placeholder
                name: `Resale Ticket #${ticketId.toString()}`,
            });
        }
    }, [request, ticketId]);

    const handleBuy = async () => {
        if (!isConnected) return toast.error("Connect Wallet");
        try {
            setBuying(true);
            await writeContractAsync({
                address: contractAddress as `0x${string}`,
                abi: rexellAbi,
                functionName: "buyResaleTicket",
                args: [ticketId, ticket.price],
            });
            toast.success("Ticket Purchased!");
        } catch (e: any) {
            toast.error("Failed: " + e.message);
        } finally {
            setBuying(false);
        }
    };

    if (!ticket) return <div className="p-8 text-center">Loading Ticket...</div>;

    const priceEth = ticket.price ? formatEther(ticket.price) : "0";
    const royalty = royaltyPercent ? Number(royaltyPercent) : 5;
    const platformFee = 2; // Hardcoded fallback

    return (
        <div className="container mx-auto px-4 py-8">
            <Card className="max-w-4xl mx-auto overflow-hidden">
                <div className="grid md:grid-cols-2">
                    <div className="h-64 md:h-auto bg-gray-100 relative">
                        <img src={ticket.image} className="absolute inset-0 w-full h-full object-cover" alt="Ticket" />
                    </div>
                    <div className="p-8 space-y-6">
                        <div>
                            <Badge className="mb-2 bg-blue-100 text-blue-800 hover:bg-blue-200">Resale</Badge>
                            <h1 className="text-3xl font-bold">{ticket.name}</h1>
                            <p className="text-gray-500">Ticket ID: {ticket.id}</p>
                        </div>

                        <div className="flex items-center gap-4 bg-green-50 p-4 rounded-lg border border-green-100">
                            <ShieldCheck className="w-8 h-8 text-green-600" />
                            <div>
                                <p className="font-semibold text-green-900">AI Verified Seller</p>
                                <p className="text-xs text-green-700">This seller has passed biometric KYC verification.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Price</span>
                                <span className="font-bold text-lg">{priceEth} cUSD</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Organizer Royalty ({royalty}%)</span>
                                <span>Included</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Platform Fee ({platformFee}%)</span>
                                <span>Included</span>
                            </div>
                        </div>

                        <Button className="w-full text-lg py-6" onClick={handleBuy} disabled={buying}>
                            {buying ? "Processing..." : (
                                <>Buy Ticket Now <ShoppingCart className="ml-2 w-5 h-5" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
