"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useParams, useRouter } from "next/navigation";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OwnershipRecord {
  owner: string;
}

export default function OwnershipHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { isConnected } = useAccount();
  const [ownershipHistory, setOwnershipHistory] = useState<OwnershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketExists, setTicketExists] = useState(true);

  // Get ticket ownership history
  const { data: historyData, isPending: isHistoryPending, isError } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getTicketOwnershipHistory",
    args: id ? [BigInt(id)] : undefined,
    query: {
      enabled: !!id,
    }
  });

  // Load ownership history
  useEffect(() => {
    if (historyData && !isHistoryPending && id) {
      // Convert the address array to OwnershipRecord objects
      const history: OwnershipRecord[] = (historyData as string[]).map((owner: string) => ({
        owner,
      }));
      
      setOwnershipHistory(history);
      setLoading(false);
    } else if (!isHistoryPending && id) {
      // Ticket might not exist
      setTicketExists(false);
      setLoading(false);
    } else if (isError && id) {
      setTicketExists(false);
      setLoading(false);
    }
  }, [historyData, isHistoryPending, isError, id]);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Ticket Ownership History</CardTitle>
            <CardDescription>View the ownership history of this ticket</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">Please connect your wallet to view ticket history</p>
            <Button>Connect Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || isHistoryPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Ticket Ownership History</CardTitle>
            <CardDescription>Loading history...</CardDescription>
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

  if (!ticketExists) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Ticket Not Found</CardTitle>
            <CardDescription>This ticket does not exist</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="text-5xl mb-4">🎟️</div>
            <p className="text-gray-600 mb-6">
              The ticket you're looking for could not be found.
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
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Ownership History</CardTitle>
                <CardDescription>
                  View the complete ownership history of ticket #{id}
                </CardDescription>
              </div>
              <Badge variant="secondary">Resale</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 flex items-center justify-center">
              <span className="text-gray-500">Ticket Image</span>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Ownership Timeline</h3>
              
              {ownershipHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No ownership history available for this ticket
                </div>
              ) : (
                <div className="space-y-4">
                  {ownershipHistory.map((record, index) => (
                    <div key={index} className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          index === 0 
                            ? "bg-green-500 text-white" 
                            : "bg-blue-500 text-white"
                        }`}>
                          {index === 0 ? "1" : index + 1}
                        </div>
                        {index < ownershipHistory.length - 1 && (
                          <div className="h-full w-0.5 bg-gray-300 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-medium">
                          {index === 0 ? "Original Owner" : `Owner #${index + 1}`}
                        </div>
                        <div className="text-sm text-gray-600 font-mono">
                          {record.owner.substring(0, 6)}...{record.owner.substring(record.owner.length - 4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">Transparency Information</h3>
              <p className="text-sm text-blue-700">
                This ownership history is stored on the blockchain and cannot be altered. 
                It provides transparency for all ticket transfers and helps prevent fraud.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}