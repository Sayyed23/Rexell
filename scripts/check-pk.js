
const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

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
