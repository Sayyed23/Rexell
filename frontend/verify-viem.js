
const { createPublicClient, http, formatUnits, parseAbi } = require('viem');
const { celoSepolia } = require('viem/chains');

async function main() {
    const client = createPublicClient({
        chain: celoSepolia,
        transport: http('https://forno.celo-sepolia.celo-testnet.org')
    });

    const userAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";

    const tokens = [
        "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a", // EURm (current code)
        "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // cUSD (common?)
        "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Alfajores cUSD
        "0x610178dA211FEF7D417bC0e6FeD39F05609AD788", // Mock cUSD from deploy output
        "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853", // From original cUSD-abi.ts
        "0xdE9e4C3c5B13C6fA97B348A7314457e5ce0aB00b", // From search 1
        "0xE950d0d42EAA4aD3E23591cCA1A2549a929B995B", // From search 2
        "0x954cBA141f21760751E3065ACC250c38fb9f5e61"  // From search 3
    ];

    const abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
    ]);

    console.log(`Scanning balances for ${userAddress} on Celo Sepolia...\n`);

    for (const addr of tokens) {
        try {
            const [balance, symbol, decimals] = await Promise.all([
                client.readContract({ address: addr, abi, functionName: 'balanceOf', args: [userAddress] }),
                client.readContract({ address: addr, abi, functionName: 'symbol' }),
                client.readContract({ address: addr, abi, functionName: 'decimals' })
            ]);
            if (balance > 0n) {
                console.log(`FOUND BALANCE: ${formatUnits(balance, decimals)} ${symbol} (${addr})`);
            } else {
                console.log(`Zero balance: ${symbol} (${addr})`);
            }
        } catch (e) {
            // console.log(`Not found: ${addr}`);
        }
    }

    const nativeBalance = await client.getBalance({ address: userAddress });
    console.log(`\nNative CELO: ${formatUnits(nativeBalance, 18)} CELO`);
}

main().catch(console.error);
