"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { rexellAbi, contractAddress } from "@/blockchain/abi/rexell-abi";
import { formatEther } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SeatMapProps {
  eventId: number;
  basePrice: number; // in cUSD
  walletAddress: string;
  onSelectionChange: (
    selected: { label: string; category: string; price: number }[]
  ) => void;
}

interface SeatLockStatus {
  seatLabel: string;
  lockedBy: string;
}

export function SeatMap({
  eventId,
  basePrice,
  walletAddress,
  onSelectionChange,
}: SeatMapProps) {
  const [selectedSeats, setSelectedSeats] = useState<
    { label: string; category: string; price: number }[]
  >([]);
  const [lockedSeats, setLockedSeats] = useState<SeatLockStatus[]>([]);
  const [soldSeats, setSoldSeats] = useState<string[]>([]);
  const [lockTimer, setLockTimer] = useState<number | null>(null);

  // Contract Read: Get custom prices for VIP, Premium, Executive
  const { data: vipPriceRaw } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "seatCategoryPrices",
    args: [BigInt(eventId), "VIP"],
  });

  const { data: premiumPriceRaw } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "seatCategoryPrices",
    args: [BigInt(eventId), "Premium"],
  });

  const { data: executivePriceRaw } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "seatCategoryPrices",
    args: [BigInt(eventId), "Executive"],
  });

  // Contract Read: Get all sold seats for this event
  const { data: soldSeatsRaw, refetch: refetchSoldSeats } = useReadContract({
    address: contractAddress,
    abi: rexellAbi,
    functionName: "getSoldSeats",
    args: [BigInt(eventId)],
  });

  // Compute prices based on category and fallbacks
  const vipPrice = vipPriceRaw && (vipPriceRaw as bigint) > 0n 
    ? parseFloat(formatEther(vipPriceRaw as bigint)) 
    : (basePrice > 0 ? basePrice * 2.0 : 0.02);
    
  const premiumPrice = premiumPriceRaw && (premiumPriceRaw as bigint) > 0n 
    ? parseFloat(formatEther(premiumPriceRaw as bigint)) 
    : (basePrice > 0 ? basePrice * 1.5 : 0.015);
    
  const executivePrice = executivePriceRaw && (executivePriceRaw as bigint) > 0n 
    ? parseFloat(formatEther(executivePriceRaw as bigint)) 
    : (basePrice > 0 ? basePrice * 1.2 : 0.01);

  const getSeatPrice = (category: string) => {
    if (category === "VIP") return vipPrice;
    if (category === "Premium") return premiumPrice;
    return executivePrice;
  };

  // Sync sold seats from contract
  useEffect(() => {
    if (soldSeatsRaw) {
      setSoldSeats(soldSeatsRaw as string[]);
    }
  }, [soldSeatsRaw]);

  // Fetch lock statuses from API route
  const fetchLockStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/seats/status?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setLockedSeats(data.lockedSeats || []);
      }
    } catch (e) {
      console.error("Failed to fetch seat locks:", e);
    }
  }, [eventId]);

  const handleReleaseAllLocks = useCallback(async () => {
    if (selectedSeats.length === 0) return;
    try {
      await fetch("/api/seats/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          eventId,
          seatLabels: selectedSeats.map((s) => s.label),
          walletAddress,
        }),
      });
    } catch (e) {
      console.error("Failed to release locks on cleanup:", e);
    }
  }, [eventId, selectedSeats, walletAddress]);

  // Initial fetch and polling every 5 seconds
  useEffect(() => {
    fetchLockStatuses();
    const interval = setInterval(fetchLockStatuses, 5000);
    return () => clearInterval(interval);
  }, [fetchLockStatuses]);

  // Manage 10 minute lock countdown timer
  useEffect(() => {
    if (selectedSeats.length > 0) {
      if (lockTimer === null) {
        setLockTimer(600); // 10 minutes in seconds
      }
    } else {
      setLockTimer(null);
    }
  }, [selectedSeats, lockTimer]);

  useEffect(() => {
    if (lockTimer !== null && lockTimer > 0) {
      const timer = setTimeout(() => setLockTimer(lockTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockTimer === 0) {
      // Clear all selected seats locks off-chain when timer expires
      handleReleaseAllLocks();
      setSelectedSeats([]);
      onSelectionChange([]);
      toast.error("Your 10-minute reservation lock expired!");
    }
  }, [lockTimer, handleReleaseAllLocks, onSelectionChange]);

  // Lock seat off-chain via Redis
  const toggleSeat = async (seatLabel: string, category: string) => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    const price = getSeatPrice(category);
    const isSelected = selectedSeats.some((s) => s.label === seatLabel);

    if (isSelected) {
      // Release lock
      try {
        const res = await fetch("/api/seats/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unlock",
            eventId,
            seatLabels: [seatLabel],
            walletAddress,
          }),
        });

        if (res.ok) {
          const updated = selectedSeats.filter((s) => s.label !== seatLabel);
          setSelectedSeats(updated);
          onSelectionChange(updated);
        } else {
          toast.error("Failed to release seat lock");
        }
      } catch (e) {
        toast.error("Network error releasing lock");
      }
    } else {
      // Acquire lock
      try {
        const res = await fetch("/api/seats/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "lock",
            eventId,
            seatLabels: [seatLabel],
            walletAddress,
          }),
        });

        if (res.ok) {
          const updated = [...selectedSeats, { label: seatLabel, category, price }];
          setSelectedSeats(updated);
          onSelectionChange(updated);
          toast.success(`Reserved seat ${seatLabel} for 10 minutes`);
        } else {
          const data = await res.json();
          toast.error(data.error || "This seat is already locked by another user");
        }
      } catch (e) {
        toast.error("Network error acquiring lock");
      }
    }
  };

  const getSeatStatus = (seatLabel: string) => {
    if (soldSeats.includes(seatLabel)) return "sold";
    if (selectedSeats.some((s) => s.label === seatLabel)) return "selected";
    
    const lock = lockedSeats.find((l) => l.seatLabel === seatLabel);
    if (lock) {
      return lock.lockedBy.toLowerCase() === walletAddress.toLowerCase()
        ? "selected"
        : "locked";
    }
    return "available";
  };

  // Rendering Layout Helpers
  const formatTimeRemaining = () => {
    if (lockTimer === null) return "";
    const m = Math.floor(lockTimer / 60);
    const s = lockTimer % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // UI Grid specs matching layout screenshot
  const renderSeat = (row: string, num: number, category: string) => {
    const label = `${row}-${num}`;
    const status = getSeatStatus(label);

    let baseStyle =
      "w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-all cursor-pointer select-none";
    if (status === "sold") {
      baseStyle += " bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300";
    } else if (status === "selected") {
      baseStyle += " bg-emerald-600 text-white border border-emerald-700 shadow-md shadow-emerald-600/30 scale-105";
    } else if (status === "locked") {
      baseStyle += " bg-amber-400 text-amber-900 border border-amber-500 cursor-not-allowed";
    } else {
      // Available
      baseStyle +=
        " bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:scale-105";
    }

    return (
      <button
        key={label}
        onClick={() => status !== "sold" && status !== "locked" && toggleSeat(label, category)}
        disabled={status === "sold" || status === "locked"}
        className={baseStyle}
        title={`Seat ${label} (${category}: ${getSeatPrice(category).toFixed(2)} cUSD)`}
      >
        {num}
      </button>
    );
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
      {/* Screen Layout Indicator */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-3/4 h-2 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 rounded-b-lg opacity-80 shadow-lg shadow-sky-500/20"></div>
        <span className="text-slate-400 text-xs mt-2 uppercase tracking-widest font-semibold">
          Stage / Screen
        </span>
      </div>

      {/* Seat grid container */}
      <div className="space-y-6 overflow-x-auto pb-4">
        {/* VIP Section (Row L) */}
        <div className="min-w-[700px] flex flex-col items-center border-b border-slate-800 pb-4">
          <div className="text-slate-400 text-xs font-bold mb-3 tracking-wide flex items-center gap-2">
            VIP SEATS <span className="text-emerald-400">({vipPrice.toFixed(2)} cUSD)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm font-bold w-4">L</span>
            <div className="flex gap-2">
              {[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) =>
                renderSeat("L", num, "VIP")
              )}
            </div>
            <span className="text-slate-500 text-sm font-bold w-4">L</span>
          </div>
        </div>

        {/* Premium Section (Rows K-E) */}
        <div className="min-w-[700px] flex flex-col items-center border-b border-slate-800 pb-4">
          <div className="text-slate-400 text-xs font-bold mb-3 tracking-wide flex items-center gap-2">
            PREMIUM SEATS <span className="text-emerald-400">({premiumPrice.toFixed(2)} cUSD)</span>
          </div>
          <div className="space-y-2">
            {["K", "J", "I", "H", "G", "F", "E"].map((row) => (
              <div key={row} className="flex items-center gap-4">
                <span className="text-slate-500 text-sm font-bold w-4">{row}</span>
                
                {/* Left side, center gap, right side block structure matching layout */}
                <div className="flex gap-12">
                  {/* Left Block: Seats 20 - 15 */}
                  <div className="flex gap-2">
                    {[20, 19, 18, 17, 16, 15].map((num) =>
                      renderSeat(row, num, "Premium")
                    )}
                  </div>
                  
                  {/* Center Block: Seats 14 - 4 */}
                  <div className="flex gap-2">
                    {[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4].map((num) =>
                      renderSeat(row, num, "Premium")
                    )}
                  </div>

                  {/* Right Block: Seats 3 - 1 */}
                  <div className="flex gap-2">
                    {[3, 2, 1].map((num) =>
                      renderSeat(row, num, "Premium")
                    )}
                  </div>
                </div>

                <span className="text-slate-500 text-sm font-bold w-4">{row}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Section (Rows D-B) */}
        <div className="min-w-[700px] flex flex-col items-center">
          <div className="text-slate-400 text-xs font-bold mb-3 tracking-wide flex items-center gap-2">
            EXECUTIVE SEATS <span className="text-emerald-400">({executivePrice.toFixed(2)} cUSD)</span>
          </div>
          <div className="space-y-2">
            {["D", "C", "B"].map((row) => (
              <div key={row} className="flex items-center gap-4">
                <span className="text-slate-500 text-sm font-bold w-4">{row}</span>
                
                {/* Left side, center block layout */}
                <div className="flex gap-16">
                  {/* Left block: 17 - 12 */}
                  <div className="flex gap-2">
                    {[17, 16, 15, 14, 13, 12].map((num) =>
                      renderSeat(row, num, "Executive")
                    )}
                  </div>
                  
                  {/* Center/Right block: 11 - 1 */}
                  <div className="flex gap-2">
                    {[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) =>
                      renderSeat(row, num, "Executive")
                    )}
                  </div>
                </div>

                <span className="text-slate-500 text-sm font-bold w-4">{row}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend & Summary Info */}
      <div className="border-t border-slate-800 mt-6 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        {/* Colors Legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-slate-600 bg-white"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-amber-500 bg-amber-400"></div>
            <span>Locked (Redis)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-emerald-700 bg-emerald-600"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-gray-300 bg-gray-200"></div>
            <span>Sold</span>
          </div>
        </div>

        {/* Dynamic Booking Timer */}
        {lockTimer !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 text-sm font-semibold animate-pulse">
            <span>Lock Timer: {formatTimeRemaining()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
