import { ethers, network } from "hardhat";

async function main() {
    console.log("Network:", network.name);
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    const balance = await deployer.provider?.getBalance(deployer.address);
    console.log("Account balance:", balance ? ethers.formatEther(balance) : "0");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
