import { NextResponse, NextRequest } from "next/server";
import { getAllLocks } from "@/lib/redis";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (eventId === undefined || eventId === null || eventId === "") {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Get all locks from Redis for this event
    const locks = await getAllLocks(`lock:${eventId}:`);
    
    // Format the locked seats to just labels and who locked them
    const lockedSeats = Object.entries(locks).map(([key, value]) => {
      // Key format: lock:eventId:seatLabel
      const parts = key.split(":");
      const seatLabel = parts[2];
      return {
        seatLabel,
        lockedBy: value,
      };
    });

    return NextResponse.json({ lockedSeats }, { status: 200 });
  } catch (e) {
    console.error("Error in seats status API:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
