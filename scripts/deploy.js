const hre = require("hardhat");

async function main() {
  await hre.run("compile");

  // 1. Deploy SoulboundIdentity
  const SoulboundIdentity = await hre.ethers.deployContract('SoulboundIdentity', []);
  await SoulboundIdentity.waitForDeployment();
  console.log(`SoulboundIdentity deployed to ${SoulboundIdentity.target} `);

  // 2. Determine cUSD Address (Always deploy Mock for testing on Sepolia)
  console.log("Deploying MockCUSD for testing...");
  const MockCUSD = await hre.ethers.deployContract('MockCUSD');
  await MockCUSD.waitForDeployment();
  const cUSDAddress = MockCUSD.target;
  console.log(`MockCUSD deployed to ${cUSDAddress} `);

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