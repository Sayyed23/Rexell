const hre = require("hardhat");

async function main() {
  console.log("Available properties on hre:");
  console.log(Object.keys(hre));
  
  if (hre.ethers) {
    console.log("ethers is available");
  } else {
    console.log("ethers is NOT available");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});