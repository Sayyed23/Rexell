/**
 * Helper to log application activities and transactions to the off-chain Microsoft SQL Server database.
 */
export async function logAppActivity(
  userAddress: string,
  action: string,
  txHash?: string,
  details?: Record<string, any>
): Promise<boolean> {
  if (!userAddress) return false;

  try {
    const oracleUrl = process.env.NEXT_PUBLIC_IDENTITY_ORACLE_URL || "https://identity-oracle-180777648897.us-central1.run.app";
    const response = await fetch(`${oracleUrl}/api/activity/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_address: userAddress,
        action: action.toUpperCase(),
        tx_hash: txHash || null,
        details: details || null,
      }),
    });

    if (!response.ok) {
      console.error("Failed to log activity in SQL Server:", await response.text());
      return false;
    }

    const data = await response.json();
    console.log("Logged app activity in SQL Server:", data);
    return true;
  } catch (error) {
    console.error("Activity logging error:", error);
    return false;
  }
}
