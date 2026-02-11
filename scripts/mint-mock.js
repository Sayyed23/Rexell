
const hre = require("hardhat");

async function main() {
    const mockCusdAddress = "0x5Ea438687A14ec2A4f84c05AAa1659344dd7E814";
    const userAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";

    console.log(`Minting 100 Mock cUSD to ${userAddress}...`);

    const MockCUSD = await hre.ethers.getContractAt("MockCUSD", mockCusdAddress);

    // Mint 100 tokens (18 decimals)
    const amount = hre.ethers.parseEther("100");

    const tx = await MockCUSD.mint(userAddress, amount);
    await tx.wait();

    console.log("Minting successful!");

    const balance = await MockCUSD.balanceOf(userAddress);
    console.log(`New balance: ${hre.ethers.formatEther(balance)} cUSD`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
