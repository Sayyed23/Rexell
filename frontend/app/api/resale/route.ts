import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ticketId, price } = await req.json();

    // TODO: Implement the logic to store the resale request in the database
    // and notify the original ticket owner.

    console.log(`Received resale request for ticket ${ticketId} with price ${price}`);

    return NextResponse.json({ message: "Resale request submitted successfully" });
  } catch (error) {
    console.error("Error processing resale request:", error);
    return NextResponse.json({ error: "Failed to submit resale request" }, { status: 500 });
  }
}
