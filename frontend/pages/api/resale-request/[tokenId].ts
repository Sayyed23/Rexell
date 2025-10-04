import { NextApiRequest, NextApiResponse } from 'next';
import { contractAddress, rexellAbi } from '@/blockchain/abi/rexell-abi';
import { createPublicClient, http } from 'viem';
import { celoAlfajores } from 'viem/chains';

// Define the ResaleRequest type to match the Solidity struct
type ResaleRequest = {
  tokenId: bigint;
  owner: `0x${string}`;
  price: bigint;
  approved: boolean;
  rejected: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId } = req.query;

  if (!tokenId || Array.isArray(tokenId)) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  // Validate that tokenId is a valid number
  const tokenIdNum = Number(tokenId);
  if (isNaN(tokenIdNum) || tokenIdNum <= 0 || !Number.isInteger(tokenIdNum)) {
    return res.status(400).json({ error: 'Token ID must be a positive integer' });
  }

  try {
    // Create a public client to interact with the blockchain
    const client = createPublicClient({
      chain: celoAlfajores,
      transport: http(),
    });

    // Fetch the resale request details from the smart contract
    const resaleRequest = await client.readContract({
      address: contractAddress,
      abi: rexellAbi,
      functionName: 'getResaleRequest',
      args: [BigInt(tokenId)],
    }) as ResaleRequest;

    // Verify that we received valid data
    if (!resaleRequest) {
      return res.status(404).json({ error: 'Resale request not found' });
    }

    // Additional verification: Check if this is a valid resale request
    // (not just an empty struct)
    if (resaleRequest.tokenId === BigInt(0) && 
        resaleRequest.owner === '0x0000000000000000000000000000000000000000' &&
        resaleRequest.price === BigInt(0)) {
      return res.status(404).json({ error: 'Resale request not found or invalid' });
    }

    // Format the response
    const formattedRequest = {
      tokenId: resaleRequest.tokenId.toString(),
      owner: resaleRequest.owner,
      price: resaleRequest.price.toString(),
      approved: resaleRequest.approved,
      rejected: resaleRequest.rejected,
    };

    res.status(200).json(formattedRequest);
  } catch (error: any) {
    console.error('Error fetching resale request:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('revert')) {
      return res.status(404).json({ error: 'Resale request not found' });
    }
    
    res.status(500).json({ error: 'Failed to fetch resale request' });
  }
}