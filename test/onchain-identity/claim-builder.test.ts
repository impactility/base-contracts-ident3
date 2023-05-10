import { expect } from "chai";
import { OnchainIdentityDeployHelper } from "../../helpers/OnchainIdentityDeployHelper";
import { StateDeployHelper } from "../../helpers/StateDeployHelper";
import fs from 'fs'

describe.only("Claim builder tests", function() {
  let identity;
  
  before(async () => {
      const stDeployHelper = await StateDeployHelper.initialize();
      const deployHelper = await OnchainIdentityDeployHelper.initialize();
      const stContracts = await stDeployHelper.deployStateV2();
      const contracts = await deployHelper.deployIdentity(
        stContracts.state,
        stContracts.smtLib,
        stContracts.poseidon1,
        stContracts.poseidon2,
        stContracts.poseidon3,
        stContracts.poseidon4
      );
      identity = contracts.identity;
  });

  it("validate buildClaim", async function () {
    const inputs = [
        { // schemaHash
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            expectedClaims: ['75118319212313495155413841331241344325', '0', '0', '0', '0', '0', '0', '0']
        },
        { // id index
            contractInput: ['75118319212313495155413841331241344325', 1, false, false, 0, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 0, 0, 0, 0, 0, 0],
            expectedClaims: ['755683053054190422082163056194777767237', '25425363284463910957419549722021124450832239517990785975889689633068548096', '0', '0', '0', '0', '0', '0']
        },
        { // id value
            contractInput: ['75118319212313495155413841331241344325', 2, false, false, 0, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 0, 0, 0, 0, 0, 0],
            expectedClaims: ['1095965419975128885545537663626545978693', '0', '0', '0', '0', '25425363284463910957419549722021124450832239517990785975889689633068548096', '0', '0']
        },
        { // expirationDate
            contractInput: ['75118319212313495155413841331241344325', 2, true, false, 0, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 1857686340, 0, 0, 0, 0, 0],
            expectedClaims: ['3818224355342636593252534523080691670341', '0', '0', '0', '34268264483206187164568125440', '25425363284463910957419549722021124450832239517990785975889689633068548096', '0', '0']
        },
        { // updatableFlag
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 0, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 1857686340, 0, 0, 0, 0, 0],
            expectedClaims: ['9262742226077652008666528241988983053637', '0', '0', '0', '34268264483206187164568125440', '25425363284463910957419549722021124450832239517990785975889689633068548096', '0', '0']
        },
        { // merklized index
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 1, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 1857686340, '93352129123234552352342342353456456452342343456345234121567843345', 0, 0, 0, 0],
            expectedClaims: ['20151777967547682839494515679805565820229', '0', '93352129123234552352342342353456456452342343456345234121567843345', '0', '34268264483206187164568125440', '25425363284463910957419549722021124450832239517990785975889689633068548096', '0', '0']
        },
        { // merklized value
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 2, 0, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 1857686340, '93352129123234552352342342353456456452342343456345234121567843345', 0, 0, 0, 0],
            expectedClaims: ['31040813709017713670322503117622148586821', '0', '0', '0', '34268264483206187164568125440', '25425363284463910957419549722021124450832239517990785975889689633068548096', '93352129123234552352342342353456456452342343456345234121567843345', '0']
        },
        { // version
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 2, 89220123, '25425363284463910957419549722021124450832239517990785975889689633068548096', 0, 1857686340, '93352129123234552352342342353456456452342343456345234121567843345', 0, 0, 0, 0],
            expectedClaims: ['130395355847364581104005408845894865439016836786170092869', '0', '0', '0', '34268264483206187164568125440', '25425363284463910957419549722021124450832239517990785975889689633068548096', '93352129123234552352342342353456456452342343456345234121567843345', '0']
        },
        { // revocation nonce
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 2, 89220123, '25425363284463910957419549722021124450832239517990785975889689633068548096', 3312445, 1857686340, '93352129123234552352342342353456456452342343456345234121567843345', 0, 0, 0, 0],
            expectedClaims: ['130395355847364581104005408845894865439016836786170092869', '0', '0', '0', '34268264483206187164571437885', '25425363284463910957419549722021124450832239517990785975889689633068548096', '93352129123234552352342342353456456452342343456345234121567843345', '0']
        },
        { // data slots
            contractInput: ['75118319212313495155413841331241344325', 2, true, true, 0, 89220123, '25425363284463910957419549722021124450832239517990785975889689633068548096', 3312445, 1857686340, '0', '16243864111864693853212588481963275789994876191154110553066821559749894481761', '7078462697308959301666117070269719819629678436794910510259518359026273676830', '12448278679517811784508557734102986855579744384337338465055621486538311281772', '9260608685281348956030279125705000716237952776955782848598673606545494194823'],
            expectedClaims: ['130395355847364559325933925905833203783041961153004559685', '0', '16243864111864693853212588481963275789994876191154110553066821559749894481761', '7078462697308959301666117070269719819629678436794910510259518359026273676830', '34268264483206187164571437885', '25425363284463910957419549722021124450832239517990785975889689633068548096', '12448278679517811784508557734102986855579744384337338465055621486538311281772', '9260608685281348956030279125705000716237952776955782848598673606545494194823']
        },
    ];
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const claims = await identity.buildClaim(input.contractInput);
        // console.log(claims);
        claims.forEach((c, cIndex) => {
            console.log(c.toString());
            console.log(input.expectedClaims[cIndex]);
            expect(c.eq(input.expectedClaims[cIndex])).to.be.true;
        });
    }
  });

  it("validate buildClaim errors", async function () {
    const inputs = [
        { // idPosition = 0 & id not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 0, 0, '8764639037689384765', 0, 0, 0, 0, 0, 0, 0],
            expectedErr: 'id should be empty'
        },
        { // idPosition = 1 & id null
            contractInput: ['75118319212313495155413841331241344325', 1, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            expectedErr: 'id should be not empty'
        },
        { // idPosition = 2 & id null
            contractInput: ['75118319212313495155413841331241344325', 2, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            expectedErr: 'id should be not empty'
        },
        { // idPosition = 3 - invalid position
            contractInput: ['75118319212313495155413841331241344325', 3, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            expectedErr: 'invalid id position'
        },
        { // expirable = false & expiration date not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 0, 0, 0, 0, 89220123, 0, 0, 0, 0, 0],
            expectedErr: 'expirationDate should be 0 for non expirable claim'
        },
        { // updatable = false & version not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 0, 12133, 0, 0, 0, 0, 0, 0, 0, 0],
            expectedErr: 'version should be 0 for non updatable claim'
        },
        { // merklizedRootPosition = 1 & indx data slot not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 1, 0, 0, 0, 0, 0, 1234421, 0, 0, 0],
            expectedErr: 'data slots should be empty'
        },
        { // merklizedRootPosition = 2 & value data slot not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 1, 0, 0, 0, 0, 0, 0, 0, 123445, 0],
            expectedErr: 'data slots should be empty'
        },
        { // merklizedRootPosition = 0 & merklizedRoot not null
            contractInput: ['75118319212313495155413841331241344325', 0, false, false, 0, 0, 0, 0, 0, '972355817823445311', 0, 0, 0, 0],
            expectedErr: 'merklizedRoot should be 0 for non merklized claim'
        },
    ];
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        try {
            await identity.buildClaim(input.contractInput);
            expect.fail('The transaction should have thrown an error');
        } catch (err: any) {
            expect(err.reason).to.be.equal(input.expectedErr);
        }
    }
 
  });

  it("validate buildClaim from file", async function () {
    var inputs: any[] = JSON.parse(fs.readFileSync(require.resolve('./vectorsGen/data/claimBuilderData.json'), 'utf-8'))
    console.log(inputs.length)
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const claims = await identity.buildClaim(input.contractInput);
        // console.log(claims);
        claims.forEach((c, cIndex) => {
            // console.log(c.toString());
            // console.log(input.expectedClaims[cIndex]);
            expect(c.eq(input.expectedClaims[cIndex])).to.be.true;
        });
    }
  });

});
