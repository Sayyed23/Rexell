const hre = require('hardhat');

async function main() {
  await hre.run("compile");

  // 1. Deploy SoulboundIdentity
  const SoulboundIdentity = await hre.ethers.deployContract('SoulboundIdentity', []);
  await SoulboundIdentity.waitForDeployment();
  console.log(`SoulboundIdentity deployed to ${SoulboundIdentity.target} `);

  // 2. Determine cUSD Address (Deploy Mock if localhost)
  let cUSDAddress = "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a"; // Celo Sepolia

  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId === 31337n) { // Hardhat Local
    console.log("Localhost detected. Deploying MockCUSD...");
    const MockCUSD = await hre.ethers.deployContract('MockCUSD');
    await MockCUSD.waitForDeployment();
    cUSDAddress = MockCUSD.target;
    console.log(`MockCUSD deployed to ${cUSDAddress} `);
  }

  // 3. Deploy Rexell
  // Constructor: address _cUSDTokenAddress, address _identityContractAddress
  const rexell = await hre.ethers.deployContract('Rexell', [
    cUSDAddress,
    SoulboundIdentity.target
  ]);
  await rexell.waitForDeployment();
  console.log(`Rexell deployed to ${rexell.target} `);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});