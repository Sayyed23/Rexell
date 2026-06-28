const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://celo-sepolia.drpc.org");
    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
        console.error("No PRIVATE_KEY found in .env");
        process.exit(1);
    }
    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, provider);
    console.log(`Wallet address: ${wallet.address}`);

    const rexellAddress = "0x0c421578C3BcA134B118234E09c2e511b0c38714";
    const identityAddress = "0x87873325D01bD501c98A27fd7B091f6609ee8f71";

    const abi = [
        "function owner() view returns (address)",
        "function setOracleSigner(address signer, bool status) external",
        "function isOracleSigner(address) view returns (bool)"
    ];

    const rexellContract = new ethers.Contract(rexellAddress, abi, wallet);
    const identityContract = new ethers.Contract(identityAddress, abi, wallet);

    // Check owners
    try {
        const rexellOwner = await rexellContract.owner();
        console.log(`Rexell Owner: ${rexellOwner}`);
        const identityOwner = await identityContract.owner();
        console.log(`SoulboundIdentity Owner: ${identityOwner}`);
    } catch (e) {
        console.error(`Failed to fetch owners: ${e.message}`);
    }

    const signers = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    ];

    console.log("\nConfiguring Oracle Signers on SoulboundIdentity...");
    for (const signer of signers) {
        try {
            const isAlready = await identityContract.isOracleSigner(signer);
            if (isAlready) {
                console.log(`Signer ${signer} is already set on SoulboundIdentity.`);
            } else {
                console.log(`Setting signer ${signer} on SoulboundIdentity...`);
                const tx = await identityContract.setOracleSigner(signer, true);
                console.log(`Tx sent: ${tx.hash}`);
                await tx.wait();
                console.log(`Signer ${signer} successfully set.`);
            }
        } catch (e) {
            console.error(`Failed to set signer ${signer} on SoulboundIdentity: ${e.message}`);
        }
    }

    console.log("\nConfiguring Oracle Signers on Rexell...");
    for (const signer of signers) {
        try {
            const isAlready = await rexellContract.isOracleSigner(signer);
            if (isAlready) {
                console.log(`Signer ${signer} is already set on Rexell.`);
            } else {
                console.log(`Setting signer ${signer} on Rexell...`);
                const tx = await rexellContract.setOracleSigner(signer, true);
                console.log(`Tx sent: ${tx.hash}`);
                await tx.wait();
                console.log(`Signer ${signer} successfully set.`);
            }
        } catch (e) {
            console.error(`Failed to set signer ${signer} on Rexell: ${e.message}`);
        }
    }

    console.log("\nFinished registration check!");
}

main().catch(console.error);
