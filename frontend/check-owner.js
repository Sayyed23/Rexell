
const { createPublicClient, http, parseAbi } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const rexellAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";

    const abi = parseAbi([
        'function owner() view returns (address)'
    ]);

    try {
        const owner = await client.readContract({
            address: rexellAddress,
            abi,
            functionName: 'owner'
        });
        console.log(`Rexell owner: ${owner}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
