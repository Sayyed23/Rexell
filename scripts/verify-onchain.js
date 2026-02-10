
const { ethers } = require("ethers");

async function main() {
    const provider = new ethers.JsonRpcProvider("https://forno.celo-sepolia.celo-testnet.org");
    const userAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";

    const addresses = [
        { name: "Code Address", addr: "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a" },
        { name: "Official Celo Sepolia cUSD", addr: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" },
        { name: "Another candidate", addr: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853" }
    ];

    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
    ];

    console.log(`Checking balances for User: ${userAddress}\n`);

    for (const item of addresses) {
        try {
            const token = new ethers.Contract(item.addr, erc20Abi, provider);
            const symbol = await token.symbol();
            const decimals = await token.decimals();
            const balance = await token.balanceOf(userAddress);
            console.log(`${item.name}: ${ethers.formatUnits(balance, decimals)} ${symbol} (${item.addr})`);
        } catch (error) {
            console.log(`${item.name}: Failed to fetch or not a token (${item.addr})`);
        }
    }

    // Also check native CELO
    const nativeBalance = await provider.getBalance(userAddress);
    console.log(`\nNative CELO: ${ethers.formatUnits(nativeBalance, 18)} CELO`);
}

main();
