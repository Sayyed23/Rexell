const { ethers } = require("hardhat");

async function main() {
    const address = "0x86167Ec889b0418c18A0b6eFBDA77D89e8c5861B";
    const [deployer] = await ethers.getSigners();
    const Rexell = await ethers.getContractFactory("Rexell");
    const contract = Rexell.attach(address);

    console.log("Checking if eventEscrow mapping exists in contract...");
    try {
        const escrow = await contract.eventEscrow(0);
        console.log("eventEscrow mapping exists. Value for event 0:", escrow.toString());
    } catch (e) {
        console.error("eventEscrow mapping DOES NOT exist:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
