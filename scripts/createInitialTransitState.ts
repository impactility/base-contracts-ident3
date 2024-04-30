import { DeployHelper } from "../helpers/DeployHelper";
import { ethers } from "hardhat";

import * as stateArtifact from "../artifacts/contracts/state/State.sol/State.json";
import { Contract, Signer } from "ethers";

const stateContractAddress = "0xFB054898a55bB49513D1BA8e0FB949Ea3D9B4153";

async function getInitContract(
  contractMeta: {
    contractNameOrAbi?: string | any[];
    address?: string;
  },
  signer: Signer
): Promise<Contract> {
  if (Object.keys(contractMeta).every((key) => !contractMeta[key])) {
    throw new Error("contract meta is empty");
  }

  if (contractMeta.address && contractMeta.contractNameOrAbi) {
    return ethers.getContractAt(contractMeta.contractNameOrAbi, contractMeta.address, signer);
  }

  throw new Error("Invalid contract meta");
}

async function main() {
  const [signer] = await ethers.getSigners();
  const stateContract = await getInitContract(
    {
      contractNameOrAbi: stateArtifact.abi,
      address: stateContractAddress,
    },
    signer
  );

  const defaultIdType = await stateContract.getDefaultIdType();
  console.log("defaultIdType", defaultIdType);

  const gistRootBefore = await stateContract.getGISTRoot();
  console.log("gistRoot before", gistRootBefore);

  const deployHelper = await DeployHelper.initialize();
  const guWrpr = await deployHelper.deployGenesisUtilsWrapper();
  await guWrpr.waitForDeployment();

  const onchainId = await guWrpr.calcOnchainIdFromAddress(defaultIdType, signer.address);
  console.log("onchainId", onchainId);
  const tx = await stateContract.transitStateGeneric(onchainId, 0, 2199023255552, true, 1, "0x");
  await tx.wait();

  const gistRootAfter = await stateContract.getGISTRoot();
  console.log("gistRoot after", gistRootAfter);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
