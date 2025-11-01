"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResalePage({ params }: { params: { id: string } }) {
  const [price, setPrice] = useState("");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/resale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticketId: params.id, price }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit resale request");
      }

      // Redirect to a confirmation page or back to the ticket page
      router.push(`/tickets/${params.id}`);
    } catch (error) {
      console.error(error);
      // Handle the error, e.g., show a toast message
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-8">Request Resale Verification</h1>
      <div className="w-full max-w-md">
        <div className="mb-4">
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Resale Price (in cUSD)
          </label>
          <Input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter resale price"
          />
        </div>
        <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </div>
  );
}
