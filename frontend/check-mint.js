
const { createPublicClient, http, parseAbi } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const tokenAddress = "0xE950d0d42EAA4aD3E23591cCA1A2549a929B995B";

    const abi = parseAbi([
        'function mint(address to, uint256 amount) external',
        'function owner() view returns (address)'
    ]);

    try {
        const owner = await client.readContract({
            address: tokenAddress,
            abi,
            functionName: 'owner'
        });
        console.log(`Token owner: ${owner}`);
        console.log(`Token address: ${tokenAddress}`);
        console.log(`Checking if mint exists (trial call)...`);
        // We can't actually call mint without a wallet, but we can check if it's in the bytecode or try to simulate it.
    } catch (e) {
        console.log(`Error or owner/mint not found: ${e.message}`);
    }
}

main().catch(console.error);
