import { HardhatUserConfig, task } from "hardhat/config";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";

const DEFAULT_MNEMONIC =
  "test test test test test test test test test test test junk";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
      },
    ],
  },
  networks: {
    // polygon: {
    //   chainId: 137,
    //   url: `${process.env.POLYGON_RPC_URL}`,
    //   accounts: [`0x${process.env.POLYGON_PRIVATE_KEY}`],
    // },
    // mumbai: {
    //   chainId: 80001,
    //   url: `${process.env.MUMBAI_RPC_URL}`,
    //   accounts: [`0x${process.env.MUMBAI_PRIVATE_KEY}`],
    // },
    // amoy: {
    //   chainId: 80002,
    //   url: `${process.env.AMOY_RPC_URL}`,
    //   accounts: [`0x${process.env.AMOY_PRIVATE_KEY}`],
    // },
    // hardhat: {
    //   forking: {
    //     url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`,
    //     blockNumber: 46689454,
    //   },
    // },
    // hardhat: {
    //   chainId: 80001,
    //   forking: {
    //     url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    //     blockNumber: 47392227,
    //   },
    //   chains: {
    //     80001: {
    //       hardforkHistory: {
    //         london: 20000000,
    //       },
    //     },
    //   },
    //   accounts: [
    //     {
    //       privateKey: process.env.MUMBAI_PRIVATE_KEY as string,
    //       balance: "1000000000000000000000000",
    //     },
    //   ],
    // },
    // hardhat: {
    //   chainId: 137,
    //   forking: {
    //     url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    //     blockNumber: 55067427,
    //   },
    //   chains: {
    //     137: {
    //       hardforkHistory: {
    //         london: 20000000,
    //       },
    //     },
    //   },
    // },
    cdk: {
      chainId: 10101,
      url: "http://localhost:58404",
      accounts: [`0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625`],
      timeout: 600_000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_KEY,
    enabled: !!process.env.REPORT_GAS,
    token: "MATIC",
    gasPriceApi: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice", // MATIC
    // gasPriceAPI: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice", // ETH
  },
  // etherscan: {
  //     apiKey: "etherscan API key"
  // }
};

export default config;
