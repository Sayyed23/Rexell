import { NextResponse, NextRequest } from "next/server";
import { getLock, setLock, releaseLock } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const { action, eventId, seatLabels, walletAddress } = await request.json();

    if (eventId === undefined || eventId === null || !seatLabels || !Array.isArray(seatLabels) || !walletAddress) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    if (action === "lock") {
      const lockedSeats: string[] = [];

      for (const seatLabel of seatLabels) {
        const key = `lock:${eventId}:${seatLabel}`;
        
        // Try to acquire lock for 10 minutes (600 seconds)
        const success = await setLock(key, walletAddress, 600);
        if (!success) {
          // Rollback all locks set in this request
          for (const rolledSeat of lockedSeats) {
            await releaseLock(`lock:${eventId}:${rolledSeat}`, walletAddress);
          }
          return NextResponse.json(
            { error: `Seat ${seatLabel} is already locked by another user` },
            { status: 409 }
          );
        }
        lockedSeats.push(seatLabel);
      }

      return NextResponse.json(
        { success: true, message: "Seats locked successfully" },
        { status: 200 }
      );
    } else if (action === "unlock") {
      for (const seatLabel of seatLabels) {
        const key = `lock:${eventId}:${seatLabel}`;
        await releaseLock(key, walletAddress);
      }
      return NextResponse.json(
        { success: true, message: "Seats unlocked successfully" },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    console.error("Error in seats lock API:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
