import { NextApiRequest, NextApiResponse } from 'next';
import { contractAddress, rexellAbi } from '@/blockchain/abi/rexell-abi';
import { createWalletClient, http } from 'viem';
import { celoAlfajores } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId, ownerPrivateKey } = req.body;

  if (!tokenId || !ownerPrivateKey) {
    return res.status(400).json({ error: 'Missing required parameters: tokenId, ownerPrivateKey' });
  }

  try {
    // Validate parameters
    const tokenIdNum = Number(tokenId);
    
    if (isNaN(tokenIdNum) || tokenIdNum <= 0 || !Number.isInteger(tokenIdNum)) {
      return res.status(400).json({ error: 'Token ID must be a positive integer' });
    }

    // Create a wallet client to interact with the blockchain
    const account = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: celoAlfajores,
      transport: http(),
    });

    // Approve resale request
    const hash = await client.writeContract({
      address: contractAddress,
      abi: rexellAbi,
      functionName: 'approveResale',
      args: [BigInt(tokenId)],
    });

    res.status(200).json({ 
      message: 'Resale request approved successfully',
      transactionHash: hash
    });
  } catch (error: any) {
    console.error('Error approving resale request:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('No resale request for this ticket')) {
      return res.status(404).json({ error: 'No resale request found for this ticket' });
    }
    
    if (error.message && error.message.includes('Resale already approved')) {
      return res.status(400).json({ error: 'Resale request already approved' });
    }
    
    if (error.message && error.message.includes('Resale already rejected')) {
      return res.status(400).json({ error: 'Resale request already rejected' });
    }
    
    res.status(500).json({ error: 'Failed to approve resale request' });
  }
}