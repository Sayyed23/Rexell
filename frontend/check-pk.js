
const { privateKeyToAddress } = require('viem/accounts');
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
        console.log("No PRIVATE_KEY found in .env");
        return;
    }
    // Handle both with and without 0x prefix
    const cleanPk = pk.startsWith('0x') ? pk : `0x${pk}`;
    const address = privateKeyToAddress(cleanPk);
    console.log(`Address for PRIVATE_KEY: ${address}`);
}

main().catch(console.error);
