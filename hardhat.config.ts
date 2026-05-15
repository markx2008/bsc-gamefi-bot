import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import "dotenv/config";

const privateKey = process.env.ADMIN_PRIVATE_KEY || "";
const deployerAccounts = /^0x[0-9a-fA-F]{64}$/.test(privateKey) ? [privateKey] : [];

export default {
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
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
      type: "http",
      url: process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: deployerAccounts,
    },
  },
};
