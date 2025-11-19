const hre = require('hardhat');

async function main() {
  await hre.run("compile");

  // Celo Sepolia cUSD address
  const cUSDAddress = "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a";
  const rexell = await hre.ethers.deployContract('Rexell', [cUSDAddress]);
  await rexell.waitForDeployment();
  console.log(`Rexell deployed to ${rexell.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});