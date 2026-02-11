
const { createPublicClient, http, parseAbi } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const rexellAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

    const rexellAbi = parseAbi([
        'function getAllEvents() view returns ((uint256 id, address organizer, string name, string venue, string category, uint256 date, string time, uint256 price, uint256 ticketsAvailable, string description, string ipfs, address[] ticketHolders, string[] nftUris, uint256 averageRating)[])'
    ]);

    try {
        const events = await client.readContract({
            address: rexellAddress,
            abi: rexellAbi,
            functionName: 'getAllEvents'
        });
        console.log(`Found ${events.length} events in contract ${rexellAddress}:`);
        events.forEach((e, i) => {
            console.log(`${i}: ${e.name} (id: ${e.id})`);
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch(console.error);
