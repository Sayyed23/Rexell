require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        }},
    networks: {
        Sepolia: {
            url: "https://forno.celo-sepolia.celo-testnet.org",
            accounts: [process.env.PRIVATE_KEY],
            chainId: 11142220,
        },
        celo: {
            url: "https://forno.celo.org",
            accounts: [process.env.PRIVATE_KEY],
            chainId: 42220,
        },
    },
    etherscan: {
        apiKey: {
            Sepolia: process.env.CELOSCAN_API_KEY,
            celo: process.env.CELOSCAN_API_KEY,
        },
        customChains: [
            {
                network: "Sepolia",
                chainId: 11142220,
                urls: {
                    apiURL: "https://api-sepolia.celoscan.io/api",
                    browserURL: "https://sepolia.celoscan.io",
                },
            },
            {
                network: "celo",
                chainId: 42220,
                urls: {
                    apiURL: "https://api.celoscan.io/api",
                    browserURL: "https://celoscan.io/",
                },
            },
        ],
    },
};