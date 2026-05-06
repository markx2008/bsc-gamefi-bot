require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.ADMIN_PRIVATE_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    bscTestnet: {
      url: process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};
