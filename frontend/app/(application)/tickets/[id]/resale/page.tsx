"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import ResaleVerificationNew from "@/components/ResaleVerificationNew";
import ResaleTicket from "@/components/ResaleTicket";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ResalePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected, isConnecting } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const [showResaleTicket, setShowResaleTicket] = useState(false);
  
  // Get tokenId from URL query params
  const tokenIdParam = searchParams.get("tokenId");
  const tokenId = tokenIdParam ? parseInt(tokenIdParam) : 0;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Validate tokenId
    if (isClient && !tokenId) {
      toast.error("Token ID not found. Please go back and try again.");
    }
  }, [isClient, tokenId]);

  const handleVerificationComplete = () => {
    toast.success("Verification process updated!");
    setShowResaleTicket(true);
  };

  const handleResaleComplete = () => {
    toast.success("Resale listing updated!");
    // Optionally refresh or navigate
  };

  const handleCancel = () => {
    router.push(`/tickets/${params.id}`);
  };

  if (!isClient || isConnecting) {
    return (
      <main className="flex flex-col min-h-screen bg-gray-100">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isConnected) {
    return (
      <main className="flex flex-col min-h-screen bg-gray-100">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <p className="text-lg text-gray-600">Please connect your wallet to continue</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!tokenId) {
    return (
      <main className="flex flex-col min-h-screen bg-gray-100">
        <div className="hidden sm:block">
          <Header />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-lg text-red-600 mb-4">Invalid Token ID</p>
              <Button onClick={handleCancel}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-100">
      <div className="hidden sm:block">
        <Header />
      </div>
      
      <div className="flex-1 px-4 py-8 md:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Button 
              onClick={handleCancel} 
              variant="outline"
              className="mb-4"
            >
              ← Back to Ticket
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Resale Verification</h1>
            <p className="text-gray-600 mt-2">
              Complete the verification process to list your ticket for resale
            </p>
          </div>

          <div className="space-y-6">
            {/* Show ResaleVerificationNew component first */}
            {!showResaleTicket && (
              <ResaleVerificationNew
                tokenId={tokenId}
                onVerificationComplete={handleVerificationComplete}
                onCancel={handleCancel}
              />
            )}

            {/* Show ResaleTicket component after verification is approved */}
            {showResaleTicket && (
              <ResaleTicket
                tokenId={tokenId}
                onResaleComplete={handleResaleComplete}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
