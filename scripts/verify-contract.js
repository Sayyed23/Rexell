
const hre = require("hardhat");
// const { rexellAbi } = require("../frontend/blockchain/abi/rexell-abi"); // Removed to avoid TS issues
// copying minimal ABI for test to avoid TS/module issues since this is a simple script
const ABI = [
    "function getAllEvents() view returns (tuple(uint256 id, address organizer, string name, string venue, string category, uint256 date, string time, uint256 price, uint256 ticketsAvailable, string description, string ipfs, address[] ticketHolders, string[] nftUris, tuple(address commenter, string text, uint256 timestamp)[] comments, uint256 totalRating, uint256 ratingCount)[])",
    "function owner() view returns (address)"
];

async function main() {
    const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing contract at:", contractAddress);
    console.log("Using signer:", signer.address);

    const contract = new hre.ethers.Contract(contractAddress, ABI, signer);

    try {
        console.log("Attempting to call getAllEvents...");
        const events = await contract.getAllEvents();
        console.log("Success! Events found:", events.length);
        console.log(events);
    } catch (error) {
        console.error("Error calling getAllEvents:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
