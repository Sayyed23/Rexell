import { NextApiRequest, NextApiResponse } from 'next';
import { contractAddress, rexellAbi } from '@/blockchain/abi/rexell-abi';
import { createWalletClient, http } from 'viem';
import { celoSepolia } from '@/lib/celoSepolia';
import { privateKeyToAccount } from 'viem/accounts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId, price, nftUri, userPrivateKey } = req.body;

  if (!tokenId || !price || !nftUri || !userPrivateKey) {
    return res.status(400).json({ error: 'Missing required parameters: tokenId, price, nftUri, userPrivateKey' });
  }

  try {
    // Validate parameters
    const tokenIdNum = Number(tokenId);
    const priceNum = Number(price);
    
    if (isNaN(tokenIdNum) || tokenIdNum <= 0 || !Number.isInteger(tokenIdNum)) {
      return res.status(400).json({ error: 'Token ID must be a positive integer' });
    }
    
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    // Validate NFT URI
    if (!nftUri || typeof nftUri !== 'string' || nftUri.trim().length === 0) {
      return res.status(400).json({ error: 'Valid NFT URI is required' });
    }

    // Create a wallet client to interact with the blockchain
    const account = privateKeyToAccount(userPrivateKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: celoSepolia,
      transport: http(),
    });

    // Convert price to wei (18 decimals) for the smart contract
    const priceInWei = BigInt(Math.floor(priceNum * 1e18));

    // Resell ticket
    const hash = await client.writeContract({
      address: contractAddress,
      abi: rexellAbi,
      functionName: 'resellTicket',
      args: [BigInt(tokenId), priceInWei, nftUri],
    });

    res.status(200).json({ 
      message: 'Ticket resold successfully',
      transactionHash: hash
    });
  } catch (error: any) {
    console.error('Error reselling ticket:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('Resale not approved')) {
      return res.status(400).json({ error: 'Resale request not approved' });
    }
    
    if (error.message && error.message.includes('Resale rejected')) {
      return res.status(400).json({ error: 'Resale request rejected' });
    }
    
    if (error.message && error.message.includes('Price must be greater than 0')) {
      return res.status(400).json({ error: 'Price must be greater than 0' });
    }
    
    if (error.message && error.message.includes('You are not the owner of this ticket')) {
      return res.status(403).json({ error: 'You are not the owner of this ticket' });
    }
    
    res.status(500).json({ error: 'Failed to resell ticket: ' + (error.message || 'Unknown error') });
  }
}