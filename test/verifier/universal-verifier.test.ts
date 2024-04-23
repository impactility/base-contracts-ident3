import { expect } from "chai";
import { DeployHelper } from "../../helpers/DeployHelper";
import { ethers } from "hardhat";
import { packValidatorParams } from "../utils/validator-pack-utils";
import { prepareInputs } from "../utils/state-utils";
import { Block } from "ethers";

describe("Universal Verifier MTP & SIG validators", function () {
  let verifier: any, sig: any;
  let signer, signer2, signer3, signer4;
  let signerAddress: string, signer2Address: string, signer3Address: string, someAddress: string;
  let deployHelper: DeployHelper;

  const query = {
    schema: BigInt("180410020913331409885634153623124536270"),
    claimPathKey: BigInt(
      "8566939875427719562376598811066985304309117528846759529734201066483458512800"
    ),
    operator: 1n,
    slotIndex: 0n,
    value: [
      1420070400000000000n,
      ...new Array(63).fill("0").map((x) => BigInt(x)),
    ],
    queryHash: BigInt(
      "1496222740463292783938163206931059379817846775593932664024082849882751356658"
    ),
    circuitIds: ["credentialAtomicQuerySigV2OnChain"],
    claimPathNotExists: 0,
  };

  const proofJson = require("../validators/sig/data/valid_sig_user_genesis.json");

  beforeEach(async () => {
    [signer, signer2, signer3, signer4] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
    signer2Address = await signer2.getAddress();
    signer3Address = await signer3.getAddress();
    someAddress = await signer4.getAddress();

    deployHelper = await DeployHelper.initialize(null, true);
    verifier = await deployHelper.deployUniversalVerifier(signer);

    const stub = await deployHelper.deployValidatorStub();

    sig = stub;
    await verifier.addWhitelistedValidator(await sig.getAddress());
    await verifier.connect();
  });

  it("Test add, get ZKPRequest, requestIdExists, getZKPRequestsCount", async () => {
    const requestsCount = 3;

    for (let i = 0; i < requestsCount; i++) {
      const validatorAddr = await sig.getAddress();
      await expect(
        verifier.setZKPRequest(i, {
          metadata: "metadataN" + i,
          validator: validatorAddr,
          data: "0x0" + i,
        })
      )
        .to.emit(verifier, "ZKPRequestSet")
        .withArgs(i, signerAddress, "metadataN" + i, validatorAddr, "0x0" + i);
      const request = await verifier.getZKPRequest(i);
      expect(request.metadata).to.be.equal("metadataN" + i);
      expect(request.validator).to.be.equal(validatorAddr);
      expect(request.data).to.be.equal("0x0" + i);

      const requestFI = await verifier.getZKPRequestFullInfo(i);
      expect(request.metadata).to.be.equal("metadataN" + i);
      expect(request.validator).to.be.equal(validatorAddr);
      expect(request.data).to.be.equal("0x0" + i);
      expect(requestFI.controller).to.be.equal(signerAddress);
      expect(requestFI.isDisabled).to.be.equal(false);

      const requestIdExists = await verifier.requestIdExists(i);
      expect(requestIdExists).to.be.true;
      const requestIdDoesntExists = await verifier.requestIdExists(i + 1);
      expect(requestIdDoesntExists).to.be.false;

      await expect(verifier.getZKPRequest(i + 1)).to.be.rejectedWith("request id doesn't exist");
    }

    const count = await verifier.getZKPRequestsCount();
    expect(count).to.be.equal(requestsCount);
  });

  it("Test submit response", async () => {
    const data = packValidatorParams(query);
    await verifier.setZKPRequest(0, {
      metadata: "metadata",
      validator: await sig.getAddress(),
      data: data,
      controller: signerAddress,
      isDisabled: false,
    });

    const { inputs, pi_a, pi_b, pi_c } = prepareInputs(proofJson);
    const tx = await verifier.submitZKPResponse(0, inputs, pi_a, pi_b, pi_c);
    const txRes = await tx.wait();
    const filter = verifier.filters.ZKPResponseSubmitted

    const events = await verifier.queryFilter(filter, -1)
    expect(events[0].eventName).to.be.equal("ZKPResponseSubmitted");
    expect(events[0].args.requestId).to.be.equal(0);
    expect(events[0].args.caller).to.be.equal(signerAddress);

    const { timestamp: txResTimestamp } = await ethers.provider.getBlock(txRes.blockNumber) as Block;

    await expect(verifier.verifyZKPResponse(0, inputs, pi_a, pi_b, pi_c, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")).not.to.be.rejected;

    const requestId = 0;
    let status = await verifier.getProofStatus(signerAddress, requestId);
    expect(status.isProved).to.be.true;
    expect(status.validatorVersion).to.be.equal("2.0.0-mock");
    expect(status.blockNumber).to.be.equal(txRes.blockNumber);
    expect(status.blockTimestamp).to.be.equal(txResTimestamp);
    status = await verifier.getProofStatus(signerAddress, requestId + 1);
    expect(status.isProved).to.be.equal(false);
    expect(status.validatorVersion).to.be.equal("");
  });

  it("Test getZKPRequests pagination", async () => {
    for (let i = 0; i < 30; i++) {
      await verifier.setZKPRequest(i, {
        metadata: "metadataN" + i,
        validator: await sig.getAddress(),
        data: "0x00",
        controller: signerAddress,
        isDisabled: false,
      });
    }
    let queries = await verifier.getZKPRequests(5, 10);
    expect(queries.length).to.be.equal(10);
    expect(queries[0].metadata).to.be.equal("metadataN5");
    expect(queries[9].metadata).to.be.equal("metadataN14");

    queries = await verifier.getZKPRequests(15, 3);
    expect(queries.length).to.be.equal(3);
    expect(queries[0].metadata).to.be.equal("metadataN15");
    expect(queries[1].metadata).to.be.equal("metadataN16");
    expect(queries[2].metadata).to.be.equal("metadataN17");
  });

  it("Test getZKPRequestsByController", async () => {
    for (let i = 0; i < 5; i++) {
      await verifier
        .connect(signer)
        .setZKPRequest(i, {
          metadata: "metadataN" + i,
          validator: await sig.getAddress(),
          data: "0x00",
          controller: signerAddress,
          isDisabled: false
        });
    }
    for (let i = 0; i < 3; i++) {
      await verifier
        .connect(signer2)
        .setZKPRequest(1000 + i, {
          metadata: "metadataN" + i,
          validator: await sig.getAddress(),data: "0x00",
          controller: signer2Address,
          isDisabled: false
        });
    }
    let queries = await verifier.getZKPRequestsByController(signerAddress, 3, 5);
    expect(queries.length).to.be.equal(2);
    expect(queries[0].metadata).to.be.equal("metadataN3");
    expect(queries[1].metadata).to.be.equal("metadataN4");

    queries = await verifier.getZKPRequestsByController(signer2Address, 0, 5);
    expect(queries.length).to.be.equal(3);
    expect(queries[0].metadata).to.be.equal("metadataN0");

    await expect(verifier.getZKPRequestsByController(signer3Address, 0, 5)).to.be.rejectedWith(
      "Start index out of bounds"
    );
  });

  it("Check disable/enable functionality", async () => {
    const owner = signer;
    const controller = signer2;
    const someSigner = signer3;

    await verifier.connect(controller).setZKPRequest(0, {
      metadata: "metadata",
      validator: await sig.getAddress(),
      data: packValidatorParams(query),
      controller: await controller.getAddress(),
      isDisabled: false,
    });

    await expect(verifier.connect(someSigner).disableZKPRequest(0)).to.be.rejectedWith(
      "Only owner or controller can call this function",
    );
    // owner can disable
    await verifier.connect(owner).disableZKPRequest(0);

    await expect(verifier.connect(someSigner).enableZKPRequest(0)).to.be.rejectedWith(
      "Only owner or controller can call this function",
    );
    // controller can enable
    await verifier.connect(controller).enableZKPRequest(0);

    const { inputs, pi_a, pi_b, pi_c } = prepareInputs(proofJson);
    await verifier.submitZKPResponse(0, inputs, pi_a, pi_b, pi_c);

    await verifier.connect(controller).disableZKPRequest(0);
    await expect(verifier.submitZKPResponse(0, inputs, pi_a, pi_b, pi_c)).to.be.rejectedWith(
      "Request is disabled",
    );
    await expect(verifier.verifyZKPResponse(0, inputs, pi_a, pi_b, pi_c, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")).to.be.rejectedWith(
      "Request is disabled"
    );
  });

  it("Check whitelisted validators", async () => {
    const { validator: mtp } = await deployHelper.deployValidatorContracts(
      "VerifierMTPWrapper",
      "CredentialAtomicQueryMTPV2Validator"
    );

    await expect(
      verifier.setZKPRequest(0, {
        metadata: "metadata",
        validator: await mtp.getAddress(),
        data: "0x00",
        controller: signerAddress,
        isDisabled: false,
      })
    ).to.be.rejectedWith("Validator is not whitelisted");

    verifier.addWhitelistedValidator(await mtp.getAddress());

    await expect(
      verifier.setZKPRequest(0, {
        metadata: "metadata",
        validator: await mtp.getAddress(),
        data: "0x00",
        controller: signerAddress,
        isDisabled: false,
      })
    ).not.to.be.rejected;

    // can't whitelist validator, which does not support ICircuitValidator interface
    await expect(verifier.addWhitelistedValidator(someAddress)).to.be.reverted;

    await expect(
      verifier.setZKPRequest(1, {
        metadata: "metadata",
        validator: someAddress,
        data: "0x00",
        controller: signerAddress,
        isDisabled: false,
      })
    ).to.be.rejectedWith("Validator is not whitelisted");
  });
});
