require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const sepolia =
  process.env.INFURA_RPC_URL && process.env.PRIVATE_KEY
    ? {
        sepolia: {
          url: process.env.INFURA_RPC_URL,
          accounts: [process.env.PRIVATE_KEY],
        },
      }
    : {};

module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...sepolia,
  },
};
