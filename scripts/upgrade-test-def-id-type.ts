import { DeployHelper } from "../helpers/DeployHelper";
import { ethers } from "hardhat";
import { StateContractMigrationHelper } from "../helpers/StateContractMigrationHelper";
import { NetworkIdTypes } from "../helpers/NetworkIdTypes";
/*
1. deploy stateV2 to mumbai from feature/state-v3 branch
2. run transit-state script
3. cp .openzeppelin/* ../../contracts/.openzeppelin/
4. update addreess and block number in data
5. run this script
*/

async function main() {

    const signers = await ethers.getSigners();
    const stateDeployHelper = await DeployHelper.initialize(null, true);
    const stateContractMigrationHelper = new StateContractMigrationHelper(stateDeployHelper, signers[0]);

    const oldContractABI = [];  // abi of contract that will be upgraded : require("./StateV2_deployed_abi.json")
    const stateContractAddress = "";  // address of contract that will be upgraded
    const stateContractInstance = await stateContractMigrationHelper.getInitContract({
        contractNameOrAbi: oldContractABI,
        address: stateContractAddress,
    });

    const { state: stateV2 } = await stateContractMigrationHelper.upgradeContract(stateContractInstance);
    const defaultIdType = ''; // default network id type, ex - NetworkIdTypes.polygonMumbai;
    console.log(`Setting value for _defaultIdType = ${defaultIdType}`);
    const tx = await stateV2.setDefaultIdType(defaultIdType);
    const receipt = await tx.wait()
    const contractDefIdType = await stateV2.getDefaultIdType();
    console.assert(contractDefIdType.toString() === defaultIdType.toString(), "default id type wasn't initialized");
    console.log("Contract Upgrade Finished");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
