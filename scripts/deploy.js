const hre = require("hardhat");

async function main() {
  await hre.run("compile");

  const networkName = hre.network.name;
  console.log(`\nDeploying to network: ${networkName}\n`);

  // 1. Deploy SoulboundIdentity
  const SoulboundIdentity = await hre.ethers.deployContract('SoulboundIdentity', []);
  await SoulboundIdentity.waitForDeployment();
  console.log(`SoulboundIdentity deployed to ${SoulboundIdentity.target}`);

  // 2. Determine cUSD Address based on network
  let cUSDAddress;

  if (networkName === "Sepolia") {
    // Use real cUSD on Celo Sepolia Testnet
    cUSDAddress = "0x5Ea438687A14ec2A4f84c05AAa1659344dd7E814";
    console.log(`Using Celo Sepolia cUSD at ${cUSDAddress}`);
  } else if (networkName === "celo") {
    // Use real cUSD on Celo Mainnet
    cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
    console.log(`Using Celo Mainnet cUSD at ${cUSDAddress}`);
  } else {
    // Deploy MockCUSD for local/hardhat testing
    console.log("Deploying MockCUSD for local testing...");
    const MockCUSD = await hre.ethers.deployContract('MockCUSD');
    await MockCUSD.waitForDeployment();
    cUSDAddress = MockCUSD.target;
    console.log(`MockCUSD deployed to ${cUSDAddress}`);
  }

  // 3. Deploy Rexell
  const rexell = await hre.ethers.deployContract('Rexell', [
    cUSDAddress,
    SoulboundIdentity.target
  ]);
  await rexell.waitForDeployment();
  console.log(`Rexell deployed to ${rexell.target}`);

  // Print summary for easy .env update
  console.log(`\n========================================`);
  console.log(`  DEPLOYMENT SUMMARY (${networkName})`);
  console.log(`========================================`);
  console.log(`NEXT_PUBLIC_REXELL_ADDRESS="${rexell.target}"`);
  console.log(`NEXT_PUBLIC_CUSD_ADDRESS="${cUSDAddress}"`);
  console.log(`NEXT_PUBLIC_SOULBOUND_ADDRESS="${SoulboundIdentity.target}"`);
  console.log(`========================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});