
const { createPublicClient, http, parseAbi, formatUnits } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const userAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";
    const potentialCusdAddresses = [
        "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Alfajores
        "0x5Ea438687A14ec2A4f84c05AAa1659344dd7E814", // From .env
        "0xdE9e4C3c3F0A511dC02A88a3832c3f875ce0aB00b", // Search result
        "0x954cBA141f21760751E3065ACC250c38fb9f5e61", // Search result
        "0x765DE816845861e75A25fCA122bb6898B8B1282a"  // Mainnet
    ];

    const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

    for (const cUSD of potentialCusdAddresses) {
        console.log(`Checking address: ${cUSD}...`);
        try {
            const balance = await client.readContract({
                address: cUSD,
                abi,
                functionName: 'balanceOf',
                args: [userAddress]
            });
            console.log(`  Balance: ${formatUnits(balance, 18)} cUSD`);
        } catch (e) {
            console.log(`  Error: ${e.message.split('\n')[0]}`);
        }
    }
}

main().catch(console.error);
