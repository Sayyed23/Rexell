const hre = require('hardhat');

async function main() {
  await hre.run("compile");

  const rexell = await hre.ethers.deployContract('Rexell');
  await rexell.waitForDeployment();
  console.log(`Rexell deployed to ${rexell.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});