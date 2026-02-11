
const { ethers } = require("ethers");
require("dotenv").config({ path: "c:/Users/BFLCOMP01/Desktop/Rexell-1/.env" });

async function main() {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
        console.log("No PRIVATE_KEY found in .env");
        return;
    }
    const wallet = new ethers.Wallet(pk);
    console.log(`Address for PRIVATE_KEY: ${wallet.address}`);
}

main();
