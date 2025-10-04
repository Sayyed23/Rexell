import { NextApiRequest, NextApiResponse } from 'next';
import { contractAddress, rexellAbi } from '@/blockchain/abi/rexell-abi';
import { createPublicClient, http } from 'viem';
import { celoAlfajores } from 'viem/chains';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userAddress } = req.query;

  if (!userAddress || Array.isArray(userAddress)) {
    return res.status(400).json({ error: 'Invalid user address' });
  }

  // Validate address format
  if (!userAddress.startsWith('0x') || userAddress.length !== 42) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  try {
    // Create a public client to interact with the blockchain
    const client = createPublicClient({
      chain: celoAlfajores,
      transport: http(),
    });

    // Fetch user resale requests from the smart contract
    const userResaleRequests = await client.readContract({
      address: contractAddress,
      abi: rexellAbi,
      functionName: 'getUserResaleRequests',
      args: [userAddress as `0x${string}`],
    });

    // Format the response
    const formattedRequests = (userResaleRequests as bigint[]).map(tokenId => tokenId.toString());

    res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Error fetching user resale requests:', error);
    res.status(500).json({ error: 'Failed to fetch user resale requests' });
  }
}