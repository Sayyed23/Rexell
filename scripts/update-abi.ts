const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, '../artifacts/contracts/Rexell.sol/Rexell.json');
const outputPath = path.join(__dirname, '../frontend/blockchain/abi/rexell-abi.ts');

try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;
    const contractAddress = "0xA512e0f2D651Dabb3C4EBC5Db2351bFcc3b7eB92";

    const content = `export const contractAddress = "${contractAddress}";\n` +
        `// "0x4dEE335F6cFE2748DA7F4CD8Ce8d7B24c7B0282c";\n` +
        `export const rexellAbi = ${JSON.stringify(abi, null, 2)} as const;\n`;

    fs.writeFileSync(outputPath, content);
    console.log("Successfully updated rexell-abi.ts");
} catch (error) {
    console.error("Error updating ABI:", error);
}
