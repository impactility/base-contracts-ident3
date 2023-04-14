import { StateDeployHelper } from "./StateDeployHelper";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { Contract } from "ethers";

import * as fs from "fs";
import { publishState, toJson } from "../test/utils/deploy-utils";

export interface EventLogEntry {
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  removed: boolean;
  address: string;
  data: string;
  topics: string[];
  transactionHash: string;
  logIndex: number;
  event: string;
  eventSignature: string;
  args: {
    type: string;
    hex: string;
  }[];
}

export interface MigrationResult {
  migratedData: {
    args: {
      type: string;
      hex: string;
    }[];
    tx: string;
  }[];
  error: string | null;
  index: number;
  receipt: unknown;
}

export interface IContractMigrationSteps {
  getInitContract(contractMeta: {
    address?: string;
    contractName?: string;
    abi?: string;
    bytecode?: string;
  }): Promise<Contract>;

  makeProvisioning(contract: Contract): Promise<void>;

  readEventLogData(
    contract: Contract,
    firstEventBlock: number, //29831814
    eventsChunkSize: number,
    eventName?: string,
    fileName?: string
  ): Promise<EventLogEntry[]>;

  prepareMigration(contract: Contract): Promise<EventLogEntry[]>;

  migrateData(
    data: EventLogEntry[],
    populateDataFn: (...args) => Promise<any>,
    fileName?: string
  ): Promise<MigrationResult>;

  upgradeContract(contract: Contract): Promise<any>;
}

export abstract class ContractMigrationSteps implements IContractMigrationSteps {
  constructor(protected readonly _signer: SignerWithAddress) {}

  abstract makeProvisioning(contract: Contract): Promise<void>;

  getInitContract(contractMeta: {
    address?: string;
    contractName?: string;
    abi?: string;
    bytecode?: string;
  }): Promise<Contract> {
    if (Object.keys(contractMeta).every((key) => !contractMeta[key])) {
      throw new Error("contract meta is empty");
    }

    if (contractMeta.address && contractMeta.contractName) {
      return ethers.getContractAt(contractMeta.contractName, contractMeta.address, this._signer);
    }

    if (contractMeta.abi && contractMeta.bytecode) {
      return new ethers.ContractFactory(
        contractMeta.abi,
        contractMeta.bytecode,
        this._signer
      ).deploy();
    }

    throw new Error("Invalid contract meta");
  }

  async readEventLogData(
    contract: Contract,
    firstEventBlock: number, //29831814
    eventsChunkSize: number,
    eventName = "StateUpdated",
    fileName = "events-data.json"
  ): Promise<any[]> {
    const filter = contract.filters[eventName](null, null, null, null);
    const latestBlock = await ethers.provider.getBlock("latest");
    console.log("startBlock", firstEventBlock, "latestBlock Number", latestBlock.number);

    let logHistory: unknown[] = [];

    for (let index = firstEventBlock; index <= latestBlock.number; index += eventsChunkSize) {
      let pagedHistory;
      try {
        pagedHistory = await contract.queryFilter(filter, index, index + eventsChunkSize - 1);
      } catch (error) {
        console.error(error);
      }
      console.log(
        `state transition history length: ${pagedHistory.length}, current block number: ${index}, latest block number: ${latestBlock.number}`
      );
      logHistory = [...logHistory, ...pagedHistory];
    }
    console.log(`Total events count: ${logHistory.length}`);

    // save data to file
    if (fileName) {
      this.writeFile(fileName, logHistory);
    }

    return logHistory;
  }

  abstract prepareMigration(contract: Contract): Promise<EventLogEntry[]>;

  abstract upgradeContract(contract: Contract, afterUpgrade?: () => Promise<void>): Promise<any>;

  async migrateData(
    data: EventLogEntry[],
    populateDataFn: (...args) => Promise<any>,
    fileName = "migration-result.json"
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      migratedData: [],
      receipt: null,
      error: null,
      index: 0,
    };
    for (let idx = 0; idx < data.length; idx++) {
      result.index = idx;
      try {
        const args = data[idx].args;
        const tx = await populateDataFn(args);
        const receipt = await tx.wait();
        result.migratedData.push({
          args,
          tx: tx.hash,
        });

        if (receipt.status !== 1) {
          result.receipt = receipt;
          result.error = "receipt status failed";
          break;
        }
      } catch (error) {
        console.error(error);

        result.error =
          typeof error === "string"
            ? error
            : JSON.stringify(error, Object.getOwnPropertyNames(error));

        break;
      }
    }

    if (!result.error) {
      console.log("migration completed successfully");
    } else {
      console.log("migration error", result.error, result.receipt);
    }
    this.writeFile(fileName, result);

    return result;
  }

  protected writeFile(fileName: string, data: unknown): void {
    fs.writeFileSync(fileName, toJson(data));
  }
}

export class StateTestContractMigrationSteps extends ContractMigrationSteps {
  constructor(
    private readonly _stateDeployHelper: StateDeployHelper,
    protected readonly _signer: SignerWithAddress
  ) {
    super(_signer);
  }

  async makeProvisioning(contract: Contract): Promise<void> {
    const statesWithProofs = [
      require("issuer_genesis_state.json"),
      require("issuer_next_state_transition.json"),
      require("user_state_transition.json"),
    ];

    for (let idx = 0; idx < statesWithProofs.length; idx++) {
      const state = statesWithProofs[idx];
      await publishState(contract, state);
    }
  }

  async prepareMigration(contract: Contract): Promise<EventLogEntry[]> {
    const { state, verifier, smtLib, poseidon1, poseidon2, poseidon3 } =
      await this._stateDeployHelper.upgradeToStateV2_migration(contract.address);

    const outputJson = {
      state: state.address,
      verifier: verifier.address,
      smtLib: smtLib.address,
      poseidon1: poseidon1.address,
      poseidon2: poseidon2.address,
      poseidon3: poseidon3.address,
      network: process.env.HARDHAT_NETWORK,
    };
    this.writeFile("upgradeToStateV2_migration.json", outputJson);

    await state.initForMigration(verifier.address);

    const entries = await this.readEventLogData(contract, 0, 10000, "StateUpdated", "");

    //todo: isGeenesisState??
    // for (const entry of entries) {
    //   const { args } = entry;
    //   const [id] = args;

    //   const stateInfos = await state.getStateInfoHistoryById(id);
    // }

    return entries;
  }

  async upgradeContract(contract: Contract): Promise<void> {
    const { state } = await this._stateDeployHelper.upgradeToStateV2_migration(contract.address);
    await contract.upgradeToStateV2(state.address);
  }
}