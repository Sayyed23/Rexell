const { createPublicClient, http, parseAbi, formatUnits } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const userAddress = "0xD534Ec2E8FAce07e1E839643D5A09f102cE0f86B";
    const tokenAddress = "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a";

    const abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
    ]);

    try {
        console.log(`Checking EURm balance for deployer ${userAddress}...`);
        const balance = await client.readContract({
            address: tokenAddress,
            abi,
            functionName: 'balanceOf',
            args: [userAddress]
        });
        const symbol = await client.readContract({ address: tokenAddress, abi, functionName: 'symbol' });
        const decimals = await client.readContract({ address: tokenAddress, abi, functionName: 'decimals' });
        console.log(`Deployer balance: ${formatUnits(balance, decimals)} ${symbol}`);
    } catch (error) {
        console.error("Error checking balance:", error);
    }
}

main().catch(console.error);
