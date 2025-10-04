"use server";

export async function getExchangeRate(): Promise<number> {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=CELO&vs_currencies=USD`);
      const data = await response.json();
      return data["celo"]["usd"];
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      return 0.81; // TODO: handle this more gracefully
    }
  }
