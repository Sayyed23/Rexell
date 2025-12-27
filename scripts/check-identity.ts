

import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

async function main() {
    const rexellAddress = "0xc6Be85Cf311613D3Db8A4FBECa30A13AD2308F1E";
    const userAddress = "0xE282B88468E0554477a7580956c1f65939B623D8";

    console.log(`Checking Identity for Rexell at: ${rexellAddress}`);
    console.log(`Checking User: ${userAddress}`);

    const Rexell = await hre.ethers.getContractAt("Rexell", rexellAddress);
    const identityAddress = await Rexell.identityContract();

    console.log(`Identity Contract Address: ${identityAddress}`);

    if (identityAddress === hre.ethers.ZeroAddress) {
        console.error("Identity Contract is NOT set in Rexell!");
        return;
    }

    const SoulboundIdentity = await hre.ethers.getContractAt("SoulboundIdentity", identityAddress);

    // Check Status
    const balance = await SoulboundIdentity.balanceOf(userAddress);
    const hasValid = await SoulboundIdentity.hasValidIdentity(userAddress);

    console.log(`User Identity Balance: ${balance.toString()}`);
    console.log(`Has Valid Identity (Score >= 70): ${hasValid}`);

    if (balance > 0) {
        const details = await SoulboundIdentity.getIdentityDetails(userAddress);
        console.log(`Identity Details - TokenID: ${details.tokenId}, Score: ${details.score}, Timestamp: ${details.timestamp}`);

        if (details.score < 70) {
            console.log("Score is too low. Attempting to update score...");
            try {
                const tx = await SoulboundIdentity.updateScore(userAddress, 100);
                await tx.wait();
                console.log("Score updated to 100 successfully!");
            } catch (e) {
                console.error("Failed to update score. Are you the owner?", e);
            }
        }
    } else {
        console.log("User has NO identity. Attempting to mint...");
        try {
            const tx = await SoulboundIdentity.mintIdentity(userAddress, 100);
            await tx.wait();
            console.log("Identity minted successfully with score 100!");
        } catch (e) {
            console.error("Failed to mint identity. Are you the owner?", e);
        }
    }

}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
