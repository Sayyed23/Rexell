const fs = require('fs');
const path = require('path');

// 1. Update Rexell ABI
const rexellArtifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'Rexell.sol', 'Rexell.json');
if (fs.existsSync(rexellArtifactPath)) {
    const rexellData = JSON.parse(fs.readFileSync(rexellArtifactPath, 'utf8'));
    const rexellFrontendPath = path.join(__dirname, '..', 'frontend', 'blockchain', 'abi', 'rexell-abi.ts');
    let rexellFrontendContent = fs.readFileSync(rexellFrontendPath, 'utf8');
    const address = "0xdD95E8Fd1A5F9cc6d0548CA42a52430Bb70F8C00";
    
    const newContent = `export const contractAddress = (process.env.NEXT_PUBLIC_REXELL_ADDRESS as \`0x\${string}\`) || "${address}";
export const rexellAbi = ${JSON.stringify(rexellData.abi, null, 2)} as const;
`;
    fs.writeFileSync(rexellFrontendPath, newContent);
    console.log('Rexell ABI updated successfully!');
} else {
    console.error('Rexell artifact not found at:', rexellArtifactPath);
}

// 2. Update SoulboundIdentity ABI
const soulboundArtifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'SoulboundIdentity.sol', 'SoulboundIdentity.json');
if (fs.existsSync(soulboundArtifactPath)) {
    const soulboundData = JSON.parse(fs.readFileSync(soulboundArtifactPath, 'utf8'));
    const soulboundFrontendPath = path.join(__dirname, '..', 'frontend', 'blockchain', 'abi', 'soulbound-abi.ts');
    const address = "0x61997582d44033485a0ab38504309c201f5c97B3";
    
    const newContent = `export const soulboundIdentityAddress = (process.env.NEXT_PUBLIC_SOULBOUND_ADDRESS as \`0x\${string}\`) || "${address}";

export const soulboundIdentityAbi = ${JSON.stringify(soulboundData.abi, null, 2)} as const;
`;
    fs.writeFileSync(soulboundFrontendPath, newContent);
    console.log('SoulboundIdentity ABI updated successfully!');
} else {
    console.error('SoulboundIdentity artifact not found at:', soulboundArtifactPath);
}
