"use client";
import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import React, { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Button } from "./shared/ui/button";


const Comment = ({
  eventId,
  ticketHolders,
}: {
  eventId: number;
  ticketHolders: string[];
}) => {
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState(""); // New comment input
  const { writeContractAsync } = useWriteContract();
  const { isConnected, address } = useAccount();
  const [isTicketHolder, setIsTicketHolder] = useState(false);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent form from refreshing the page
    if (!isConnected) {
      toast("Please connect wallet.");
      return;
    }

    if (!isTicketHolder) {
      console.log(ticketHolders.includes(address as `0x${string}`));
      toast.error("Only ticket holders can comment.");
      return;
    }

    try {
      setLoading(true);
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "submitComment",
        args: [BigInt(eventId), newComment],
      });
      if (hash) {
        toast.success("Comment sent");
        setNewComment(""); // Clear comment input after submission
      } else {
        toast.error("Something happened. Try again.");
      }
    } catch (error) {
      console.log(error);
      toast.error("Unable to send comment. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsTicketHolder(ticketHolders.includes(address as `0x${string}`));
  }, [address, ticketHolders]);

 

  return (
    <form onSubmit={submitComment} className="mt-4">
      <input
        type="text"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}       
        placeholder="Write a comment..."
        className="w-full rounded-md border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      <Button type="submit" className="mt-2">
        {loading ? "Posting..." : "Post Comment"}
      </Button>
    </form>
  );
};

export default Comment;
