import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
dotenv.config();

const PK = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  paths: { sources: "./src", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "",
      chainId: Number(process.env.ARC_TESTNET_CHAIN_ID || 0) || undefined,
      accounts: PK
    },
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "",
      chainId: Number(process.env.ARC_MAINNET_CHAIN_ID || 0) || undefined,
      accounts: PK
    }
  }
};
export default config;