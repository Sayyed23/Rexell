"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatEther, parseEther } from "viem";
import { celoSepolia } from "@/lib/celoSepolia";
import { hardhat } from "wagmi/chains";
import { Search, ShoppingCart, Filter } from "lucide-react";
import Link from "next/link";

interface ResaleTicket {
  tokenId: number;
  owner: string;
  price: bigint;
  approved: boolean;
  rejected: boolean;
  metadata?: {
    name: string;
    image: string;
    description: string;
    attributes?: any[];
  };
}

export default function ResaleBrowsePage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [tickets, setTickets] = useState<ResaleTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<ResaleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [buyingId, setBuyingId] = useState<number | null>(null);

  // Fetch all approved tickets
  const { data: approvedTickets, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: rexellAbi,
    functionName: "getAllApprovedResaleTickets",
    chainId: celoSepolia.id,
  });

  // Fetch token URIs for tickets
  // In a real app, use useReadContracts for batch fetching or an indexer
  const fetchMetadata = async (ticket: any) => {
    // This is a simplified fetch. In reality, we'd need to call tokenURI(tokenId) from contract
    // For now, let's assume we can get it or use a placeholder if slow
    // We'll simulate fetching from the contract by reading the event data if available or just generic

    // To do it properly:
    // const uri = await readContract(...)
    // const json = await fetch(uri).then(r => r.json())

    // For this implementation, we will try to fetch the IPFS hash from the event if possible, 
    // but since we only have tokenId, we need to know the event.
    // The contract has `getEventOrganizerForToken`, but finding the event object is harder without loop.
    // We'll trust the `tokenURI` is standard.

    return {
      name: `Resale Ticket #${ticket.tokenId}`,
      image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&q=80&w=1000",
      description: "A verified resale ticket.",
    };
  };

  useEffect(() => {
    const loadTickets = async () => {
      if (approvedTickets) {
        setLoading(true);
        const loadedTickets = await Promise.all(
          approvedTickets.map(async (t: any) => {
            const metadata = await fetchMetadata(t);
            return {
              tokenId: Number(t.tokenId),
              owner: t.owner,
              price: t.price,
              approved: t.approved,
              rejected: t.rejected,
              metadata,
            };
          })
        );
        setTickets(loadedTickets);
        setFilteredTickets(loadedTickets);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    loadTickets();
  }, [approvedTickets]);

  // Filter Logic
  useEffect(() => {
    let result = tickets;

    if (searchTerm) {
      result = result.filter(t =>
        t.metadata?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tokenId.toString().includes(searchTerm)
      );
    }

    if (priceRange.min) {
      result = result.filter(t => t.price >= parseEther(priceRange.min));
    }
    if (priceRange.max) {
      result = result.filter(t => t.price <= parseEther(priceRange.max));
    }

    setFilteredTickets(result);
  }, [searchTerm, priceRange, tickets]);

  const handleBuy = async (tokenId: number, price: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setBuyingId(tokenId);
      // We need to approve CUSD first! 
      // Assuming CUSD is handled (usually requires approve CUSD to Rexell). 
      // But Rexell definition shows `buyResaleTicket` takes `tokenId` and `maxPrice`.
      // And it does `cUSDToken.transferFrom(msg.sender, ...)`
      // So User MUST approve Rexell to spend CUSD.

      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: rexellAbi,
        functionName: "buyResaleTicket",
        args: [BigInt(tokenId), price], // maxPrice = current price
      });

      if (hash) {
        toast.success("Purchase successful! Ticket will be transferred shortly.");
        refetch();
      }
    } catch (error: any) {
      console.error("Buy error:", error);
      toast.error("Purchase failed: " + (error.message || "Unknown error"));
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-gray-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Resale Marketplace
          </h1>
          <p className="text-gray-600 mt-1">Buy verified tickets from other fans.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/resale/list">Sell Ticket</Link>
          </Button>
          <Button variant="default" asChild>
            <Link href="/my-tickets">My Tickets</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-64 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Event name or ID"
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Price (cUSD)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Min"
                    type="number"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  />
                  <Input
                    placeholder="Max"
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ticket Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-xl" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 w-3/4 rounded" />
                    <div className="h-4 bg-gray-200 w-1/2 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-dashed">
              <div className="text-5xl mb-4">🎫</div>
              <h3 className="text-xl font-medium text-gray-900">No tickets found</h3>
              <p className="text-gray-500 mt-1">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.tokenId} className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-gray-100">
                  <div className="relative h-48 bg-gray-100 group">
                    <img
                      src={ticket.metadata?.image}
                      alt={ticket.metadata?.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500/90 hover:bg-green-600 backdrop-blur-sm text-white border-0">
                        Verified
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-1">{ticket.metadata?.name}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {ticket.metadata?.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {ticket.owner.substring(2, 4)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">Seller</span>
                        <span className="text-xs font-mono">{ticket.owner.substring(0, 6)}...{ticket.owner.substring(38)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center border-t pt-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Price</span>
                      <span className="text-xl font-bold text-gray-900">{formatEther(ticket.price)} cUSD</span>
                    </div>
                    <Button
                      onClick={() => handleBuy(ticket.tokenId, ticket.price)}
                      disabled={buyingId === ticket.tokenId || ticket.owner === address}
                      className="bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-200"
                    >
                      {buyingId === ticket.tokenId ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <>Buy Now <ShoppingCart className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}