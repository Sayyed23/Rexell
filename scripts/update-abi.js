const fs = require('fs');
const path = require('path');

// Read the ABI from the artifacts folder
const abiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'Rexell.sol', 'Rexell.json');
const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

// Read the existing frontend ABI file
const frontendAbiPath = path.join(__dirname, '..', 'frontend', 'blockchain', 'abi', 'rexell-abi.ts');
let frontendAbiContent = fs.readFileSync(frontendAbiPath, 'utf8');

// Extract the contract address (it's already in the file)
const contractAddressMatch = frontendAbiContent.match(/export const contractAddress = "([^"]+)";/);
const contractAddress = contractAddressMatch ? contractAddressMatch[1] : "0xc4A5985Aa3f3EAcCC99E62da9819c4e92889e0e7";

// Create the new ABI content
const newAbiContent = `export const contractAddress = "${contractAddress}";
// "0x4dEE335F6cFE2748DA7F4CD8Ce8d7B24c7B0282c";
export const rexellAbi = ${JSON.stringify(abiData.abi, null, 2)} as const;
`;

// Write the new ABI content to the frontend file
fs.writeFileSync(frontendAbiPath, newAbiContent);

console.log('ABI updated successfully!');