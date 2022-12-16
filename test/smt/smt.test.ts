import { expect } from "chai";

import { FixedArray, genMaxBinaryNumber, MtpProof } from "../utils/utils";
import { StateDeployHelper } from "../../helpers/StateDeployHelper";
import { publishState } from "../utils/deploy-utils";

const stateTransitions = [
  require("../state/data/user_state_genesis_transition.json"),
  require("../state/data/user_state_next_transition.json"),
];

type TestCaseMTPProof = {
  expectedProof: MtpProof;
  leavesToInsert: { i: number; v: number }[];
  getProofParams: number | { index: number; historicalRoot: string };
  [key: string]: any;
};

type RootEntry = {
  timestamp: number;
  block: number;
  root: number;
};

type TestCaseRootHistory = {
  description: string;
  timestamp: number;
  blockNumber: number;
  expectedRoot: number;
  [key: string]: any;
};

describe("SMT tests", function () {
  describe("Merkle tree proofs of SMT", () => {
    let smt;

    beforeEach(async () => {
      const deployHelper = await StateDeployHelper.initialize();
      smt = await deployHelper.deploySmtTestWrapper();
    });

    async function checkTestCaseMTPProof(testCase: TestCaseMTPProof) {
      for (const param of testCase.leavesToInsert) {
        await smt.add(param.i, param.v);
      }

      const proof =
        typeof testCase.getProofParams == "number"
          ? await smt.getProof(testCase.getProofParams)
          : await smt.getProofByRoot(
              testCase.getProofParams.index,
              testCase.getProofParams.historicalRoot
            );

      checkMtpProof(proof, testCase.expectedProof);
    }

    describe("SMT existence proof", () => {
      const testCasesExistence: TestCaseMTPProof[] = [
        {
          description: "add 1 leaf and generate the proof for it",
          leavesToInsert: [{ i: 4, v: 444 }],
          getProofParams: 4,
          expectedProof: {
            root: "17172838131998611102390183760409471205043596092117126608119446264795219840387",
            existence: true,
            siblings: [
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 4,
            value: 444,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) and generate the proof of the second one",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
          ],
          getProofParams: 2,
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: true,
            siblings: [
              "0",
              "17172838131998611102390183760409471205043596092117126608119446264795219840387",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 2,
            value: 222,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) update 2nd one and generate the proof of the first one",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: 4,
          expectedProof: {
            root: "7518984336464932918389970949562858717786148793994477177454424989320848411811",
            existence: true,
            siblings: [
              "0",
              "14251506067749311748434684987325372940957929637576367655195798776182705044439",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 4,
            value: 444,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) update the 2nd leaf and generate the proof of the second one",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: 2,
          expectedProof: {
            root: "7518984336464932918389970949562858717786148793994477177454424989320848411811",
            existence: true,
            siblings: [
              "0",
              "17172838131998611102390183760409471205043596092117126608119446264795219840387",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 2,
            value: 223,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) update the 2nd leaf and generate the proof of the first one for the previous root state",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: {
            index: 2,
            historicalRoot:
              "1441373283294527316959936912733986290796958290497398831120725405602534136472",
          },
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: true,
            siblings: [
              "0",
              "17172838131998611102390183760409471205043596092117126608119446264795219840387",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 2,
            value: 222,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) update the 2nd leaf and generate the proof of the second one for the previous root state",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: {
            index: 4,
            historicalRoot:
              "1441373283294527316959936912733986290796958290497398831120725405602534136472",
          },
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: true,
            siblings: [
              "0",
              "7886566820534140840061358290700879102455368051640197098120169021365756575690",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 4,
            value: 444,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
      ];

      for (const testCase of testCasesExistence) {
        it(`${testCase.description}`, async () => {
          await checkTestCaseMTPProof(testCase);
        });
      }
    });

    describe("SMT non existence proof", () => {
      const testCasesNonExistence: TestCaseMTPProof[] = [
        {
          description: "add 1 leaf and generate a proof on non-existing leaf",
          leavesToInsert: [{ i: 4, v: 444 }],
          getProofParams: 2,
          expectedProof: {
            root: "17172838131998611102390183760409471205043596092117126608119446264795219840387",
            existence: false,
            siblings: [
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 2,
            value: 444,
            auxExistence: true,
            auxIndex: 4,
            auxValue: 444,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) and generate proof on non-existing leaf WITH aux node",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
          ],
          getProofParams: 6,
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: false,
            siblings: [
              "0",
              "17172838131998611102390183760409471205043596092117126608119446264795219840387",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 6,
            value: 222,
            auxExistence: true,
            auxIndex: 2,
            auxValue: 222,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2) and generate proof on non-existing leaf WITHOUT aux node",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
          ],
          getProofParams: 1,
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: false,
            siblings: [
              "6675047397658061825643898157145998146182607268727302490292227324666463200032",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 1,
            value: 0,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2), update the 2nd leaf and generate proof of non-existing leaf WITH aux node (which existed before update)",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: {
            index: 6,
            historicalRoot:
              "1441373283294527316959936912733986290796958290497398831120725405602534136472",
          },
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: false,
            siblings: [
              "0",
              "17172838131998611102390183760409471205043596092117126608119446264795219840387",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 6,
            value: 222,
            auxExistence: true,
            auxIndex: 2,
            auxValue: 222,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2), update the 2nd leaf and generate proof of non-existing leaf WITHOUT aux node",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 2, v: 223 },
          ],
          getProofParams: {
            index: 1,
            historicalRoot:
              "1441373283294527316959936912733986290796958290497398831120725405602534136472",
          },
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: false,
            siblings: [
              "6675047397658061825643898157145998146182607268727302490292227324666463200032",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 1,
            value: 0,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
        {
          description:
            "add 2 leaves (depth = 2), add 3rd leaf and generate proof of non-existance for the 3rd leaf in the previous root state",
          leavesToInsert: [
            { i: 4, v: 444 },
            { i: 2, v: 222 },
            { i: 1, v: 111 },
          ],
          getProofParams: {
            index: 1,
            historicalRoot:
              "1441373283294527316959936912733986290796958290497398831120725405602534136472",
          },
          expectedProof: {
            root: "1441373283294527316959936912733986290796958290497398831120725405602534136472",
            existence: false,
            siblings: [
              "6675047397658061825643898157145998146182607268727302490292227324666463200032",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
            ],
            index: 1,
            value: 0,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        },
      ];

      for (const testCase of testCasesNonExistence) {
        it(`${testCase.description}`, async () => {
          await checkTestCaseMTPProof(testCase);
        });
      }
    });

    describe("SMT add leaf edge cases", () => {
      it("Positive: add two leaves with maximum depth", async () => {
        const testCaseEdge: TestCaseMTPProof = {
          description: "Positive: add two leaves with maximum depth",
          leavesToInsert: [
            { i: genMaxBinaryNumber(30), v: 100 },
            { i: genMaxBinaryNumber(31), v: 100 },
          ],
          getProofParams: genMaxBinaryNumber(30),
          expectedProof: {
            root: "6449232753855221707194667931706346705297555021165401674032084876583756436933",
            existence: true,
            siblings: [
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "0",
              "381734955794712863726334416780425272712032446533219069541873199912632687686",
              "0",
            ],
            index: 1073741823,
            value: 100,
            auxExistence: false,
            auxIndex: 0,
            auxValue: 0,
          },
        };

        await checkTestCaseMTPProof(testCaseEdge);
      });

      it("Negative: add two leaves with maximum depth + 1", async () => {
        await expect(smt.add(genMaxBinaryNumber(31), 100)).not.to.be.reverted;
        await expect(smt.add(genMaxBinaryNumber(32), 100)).to.be.revertedWith(
          "Max depth reached"
        );
      });
    });
  });

  describe("Root history requests", function () {
    this.timeout(5000);

    let state;
    let pubStates: { [key: string]: string | number }[] = [];

    before(async () => {
      const deployHelper = await StateDeployHelper.initialize();
      const contracts = await deployHelper.deployStateV2();
      state = contracts.state;

      pubStates = [];
      for (const stateTransition of stateTransitions) {
        pubStates.push(await publishState(state, stateTransition));
      }
    });

    it("should return the root history", async () => {
      const historyLength = await state.getGISTRootHistoryLength();
      expect(historyLength).to.be.equal(stateTransitions.length);

      const rootInfos = await state.getGISTRootHistory(0, historyLength);
      expect(rootInfos.length).to.be.equal(historyLength);

      const [rootInfo] = await state.getGISTRootHistory(0, 1);
      expect(rootInfo.root).not.to.be.equal(0);
      expect(rootInfo.replacedByRoot).not.to.be.equal(0);
      expect(rootInfo.createdAtTimestamp).to.be.equal(pubStates[0].timestamp);
      expect(rootInfo.replacedAtTimestamp).to.be.equal(pubStates[1].timestamp);
      expect(rootInfo.createdAtBlock).to.be.equal(pubStates[0].blockNumber);
      expect(rootInfo.replacedAtBlock).to.be.equal(pubStates[1].blockNumber);

      const [rootInfo2] = await state.getGISTRootHistory(1, 1);
      expect(rootInfo2.root).not.to.be.equal(0);
      expect(rootInfo2.replacedByRoot).to.be.equal(0);
      expect(rootInfo2.createdAtTimestamp).to.be.equal(pubStates[1].timestamp);
      expect(rootInfo2.replacedAtTimestamp).to.be.equal(0);
      expect(rootInfo2.createdAtBlock).to.be.equal(pubStates[1].blockNumber);
      expect(rootInfo2.replacedAtBlock).to.be.equal(0);
    });

    it("should revert if length is zero", async () => {
      await expect(state.getGISTRootHistory(0, 0)).to.be.revertedWith(
        "Length should be greater than 0"
      );
    });

    it("should be reverted if length limit exceeded", async () => {
      await expect(state.getGISTRootHistory(0, 10 ** 6)).to.be.revertedWith(
        "History length limit exceeded"
      );
    });

    it("should be reverted if out of bounds", async () => {
      const historyLength = await state.getGISTRootHistoryLength();
      await expect(
        state.getGISTRootHistory(historyLength - 1, 2)
      ).to.be.revertedWith("Out of bounds of root history");
    });
  });

  describe("Binary search in SMT root history", () => {
    let binarySearch;

    async function addRootEntries(rts: RootEntry[]) {
      for (const rt of rts) {
        await binarySearch.addRootEntry(rt.timestamp, rt.block, rt.root);
      }
    }

    async function checkRootByTimeAndBlock(
      rts: RootEntry[],
      tc: TestCaseRootHistory
    ) {
      await addRootEntries(rts);

      const rootByTimestamp = await binarySearch.getHistoricalRootByTime(
        tc.timestamp
      );
      expect(rootByTimestamp).to.equal(tc.expectedRoot);

      const rootByBlock = await binarySearch.getHistoricalRootByBlock(
        tc.blockNumber
      );
      expect(rootByBlock).to.equal(tc.expectedRoot);
    }

    beforeEach(async () => {
      const deployHelper = await StateDeployHelper.initialize();
      binarySearch = await deployHelper.deployBinarySearchTestWrapper();
    });

    describe("Empty history ", () => {
      const rootEntries: RootEntry[] = [];

      const testCase: TestCaseRootHistory[] = [
        {
          description: "Should return zero root for some search",
          timestamp: 1,
          blockNumber: 10,
          expectedRoot: 0,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("One root in the root history ", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 10,
          root: 1000,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description: "Should return the first root when equal",
          timestamp: 1,
          blockNumber: 10,
          expectedRoot: 1000,
        },
        {
          description: "Should return zero when search for less than the first",
          timestamp: 0,
          blockNumber: 9,
          expectedRoot: 0,
        },
        {
          description:
            "Should return the last root when search for greater than the last",
          timestamp: 2,
          blockNumber: 11,
          expectedRoot: 1000,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Two roots in the root history ", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 10,
          root: 1000,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1500,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description: "Should return the first root when search for equal",
          timestamp: rootEntries[0].timestamp,
          blockNumber: rootEntries[0].block,
          expectedRoot: rootEntries[0].root,
        },
        {
          description: "Should return the second root when search for equal",
          timestamp: rootEntries[1].timestamp,
          blockNumber: rootEntries[1].block,
          expectedRoot: rootEntries[1].root,
        },
        {
          description: "Should return zero when search for less than the first",
          timestamp: 0,
          blockNumber: 9,
          expectedRoot: 0,
        },
        {
          description:
            "Should return the last root when search for greater than the last",
          timestamp: 6,
          blockNumber: 16,
          expectedRoot: rootEntries[1].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Three roots in the root history ", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 10,
          root: 1000,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1500,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1700,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description: "Should return the first root when equal",
          timestamp: rootEntries[0].timestamp,
          blockNumber: rootEntries[0].block,
          expectedRoot: rootEntries[0].root,
        },
        {
          description: "Should return the second root when equal",
          timestamp: rootEntries[1].timestamp,
          blockNumber: rootEntries[1].block,
          expectedRoot: rootEntries[1].root,
        },
        {
          description: "Should return the third root when equal",
          timestamp: rootEntries[2].timestamp,
          blockNumber: rootEntries[2].block,
          expectedRoot: rootEntries[2].root,
        },
        {
          description:
            "Should return zero root when search for less than the first",
          timestamp: 0,
          blockNumber: 9,
          expectedRoot: 0,
        },
        {
          description:
            "Should return the last root when search for greater than the last",
          timestamp: 9,
          blockNumber: 19,
          expectedRoot: rootEntries[2].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Four roots in the root history ", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 10,
          root: 1000,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1500,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1700,
        },
        {
          timestamp: 8,
          block: 18,
          root: 1800,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description: "Should return the first root when equal",
          timestamp: rootEntries[0].timestamp,
          blockNumber: rootEntries[0].block,
          expectedRoot: rootEntries[0].root,
        },
        {
          description: "Should return the fourth root when equal",
          timestamp: rootEntries[3].timestamp,
          blockNumber: rootEntries[3].block,
          expectedRoot: rootEntries[3].root,
        },
        {
          description: "Should return zero when search for less than the first",
          timestamp: rootEntries[0].timestamp - 1,
          blockNumber: rootEntries[0].block - 1,
          expectedRoot: 0,
        },
        {
          description:
            "Should return the last root when search for greater than the last",
          timestamp: rootEntries[3].timestamp + 1,
          blockNumber: rootEntries[3].block + 1,
          expectedRoot: rootEntries[3].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Search in between the values", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 10,
          root: 1100,
        },
        {
          timestamp: 3,
          block: 13,
          root: 1300,
        },
        {
          timestamp: 6,
          block: 16,
          root: 1600,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1700,
        },
        {
          timestamp: 9,
          block: 19,
          root: 1900,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description:
            "Should return the first root when search in between the first and second",
          timestamp: 2,
          blockNumber: 12,
          expectedRoot: rootEntries[0].root,
        },
        {
          description:
            "Should return the fourth root when search in between the fourth and the fifth",
          timestamp: 8,
          blockNumber: 18,
          expectedRoot: rootEntries[3].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Search in array with duplicated values", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 11,
          root: 1100,
        },
        {
          timestamp: 1,
          block: 11,
          root: 1101,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1700,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1701,
        },
        {
          timestamp: 7,
          block: 17,
          root: 1702,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description:
            "Should return the last root among two equal values when search for the value",
          timestamp: 1,
          blockNumber: 11,
          expectedRoot: rootEntries[1].root,
        },
        {
          description:
            "Should return the last root among three equal values when search for the value",
          timestamp: 7,
          blockNumber: 17,
          expectedRoot: rootEntries[4].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });

    describe("Search in array with duplicated values and in between values", () => {
      const rootEntries: RootEntry[] = [
        {
          timestamp: 1,
          block: 11,
          root: 1100,
        },
        {
          timestamp: 1,
          block: 11,
          root: 1101,
        },
        {
          timestamp: 1,
          block: 11,
          root: 1102,
        },
        {
          timestamp: 3,
          block: 13,
          root: 1300,
        },
        {
          timestamp: 3,
          block: 13,
          root: 1301,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1700,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1701,
        },
        {
          timestamp: 5,
          block: 15,
          root: 1702,
        },
      ];

      const testCase: TestCaseRootHistory[] = [
        {
          description:
            "Should search in between the third (1st, 2nd, 3rd equal) and fourth values and return the third",
          timestamp: 2,
          blockNumber: 12,
          expectedRoot: rootEntries[2].root,
        },
        {
          description:
            "Should search in between the fifth (4th, 5th equal) and sixth values and return the fifth",
          timestamp: 4,
          blockNumber: 14,
          expectedRoot: rootEntries[4].root,
        },
      ];

      for (const tc of testCase) {
        it(`${tc.description}`, async () => {
          await checkRootByTimeAndBlock(rootEntries, tc);
        });
      }
    });
  });

  describe("Edge cases with exceptions", () => {
    let smt;

    beforeEach(async () => {
      const deployHelper = await StateDeployHelper.initialize();
      smt = await deployHelper.deploySmtTestWrapper();
    });

    it("getRootInfo() should throw an exception when root does not exist", async () => {
      await smt.add(1, 1);
      const root = await smt.getRoot();
      await expect(smt.getRootInfo(root)).not.to.be.reverted;
      await expect(smt.getRootInfo(root + 1)).to.be.revertedWith(
        "Root does not exist"
      );
    });

    it("getProofByRoot() should throw an exception when root does not exist", async () => {
      await smt.add(1, 1);
      const root = await smt.getRoot();
      await expect(smt.getProofByRoot(1, root)).not.to.be.reverted;
      await expect(smt.getProofByRoot(1, root + 1)).to.be.revertedWith(
        "Root does not exist"
      );
    });
  });
});

function checkMtpProof(proof, expectedProof: MtpProof) {
  expect(proof.root).to.equal(expectedProof.root);
  expect(proof.existence).to.equal(expectedProof.existence);
  checkSiblings(proof.siblings, expectedProof.siblings);
  expect(proof.index).to.equal(expectedProof.index);
  expect(proof.value).to.equal(expectedProof.value);
  expect(proof.auxExistence).to.equal(expectedProof.auxExistence);
  expect(proof.auxIndex).to.equal(expectedProof.auxIndex);
  expect(proof.auxValue).to.equal(expectedProof.auxValue);
}

function checkSiblings(siblings, expectedSiblings: FixedArray<string, 32>) {
  expect(siblings.length).to.equal(expectedSiblings.length);
  for (let i = 0; i < siblings.length; i++) {
    expect(siblings[i]).to.equal(expectedSiblings[i]);
  }
}
