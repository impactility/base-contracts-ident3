import { deployGenesisUtilsWrapper } from "../utils/deploy-utils";
import { expect } from "chai";

let guWrpr;
const testVectors = [
  { // (Iden3, NoChain, NoNetwork)
    id: '0x00141300000000000000000000000000000000000000000000000000000001',
    idType: '0x0100',
    genIdState:    '0x13',
    nonGenIdState: '0x12'
  },
  { // (PolygonId, NoChain, NoNetwork)
    id: '0x00151300000000000000000000000000000000000000000000000000000002',
    idType: '0x0200',
    genIdState:    '0x13',
    nonGenIdState: '0x14'
  },
  { // (PolygonId, Polygon, Main)
    id: '0x00261300000000000000000000000000000000000000000000000000001102',
    idType: '0x0211',
    genIdState:    '0x13',
    nonGenIdState: '0x25'
  },
  { // (PolygonId, Polygon, Mumbai)
    id: '0x00271300000000000000000000000000000000000000000000000000001202',
    idType: '0x0212',
    genIdState:    '0x13',
    nonGenIdState: '0x32'
  },
  {
    id: '0x0d9c10a0bfb514f30b64e115d7eeb3d547c240c104e03d4548375669fe1201',
    idType: '0x0112',
    genIdState:    '0xfe69563748453de004c140c247d5b3eed715e1640bf314b5bfa010',
    nonGenIdState: '0xfe69563748453de004c140c147d5b3eed715e1640bf314b5bfa010'
  },
  {
    // generated in go-iden3-core
    id: '0x0d9c10a0bfb514f30b64e115d7eeb3d547c240c104e03d4548375669fe1201',
    idType: '0x0112',
    genIdState:    '0x1a2817575efe69563748453de004c140c247d5b3eed715e1640bf314b5bfa010',
    nonGenIdState: '0x1a2817575efe69563748453de004c140c247d5b3eed715e1640bf314b5bfa011'
  },
  {
    id: '0x0d9c10a0bfb514f30b64e115d7eeb3d547c240c104e03d4548375669fe1201',
    idType: '0x0112',
    // only lower 27 bytes are used, so first 5 bytes do not influence the result
    genIdState:    '0x0000000000fe69563748453de004c140c247d5b3eed715e1640bf314b5bfa010',
    nonGenIdState: '0x0000000000fe69563748453de004c140c247d5b3eed715e1640bf314b5bfa011'
  },
  {
    id: '0x0d9c10a0bfb514f30b64e115d7eeb3d547c240c104e03d4548375669fe1201',
    idType: '0x0112',
    // only lower 27 bytes are used, so first 5 bytes do not influence the result
    genIdState:    '0xfffffffffffe69563748453de004c140c247d5b3eed715e1640bf314b5bfa010',
    nonGenIdState: '0xfffffffffffe69563748453de004c140c247d5b3eed715e1640bf314b5bfa011'
  },
  {
    id: '0x0bd8293f015c484435453dc1b4ad17e462f5d0017b3dbfec0b4b25e9c30100',
    idType: '0x0001',
    genIdState:    '0xc3e9254b0becbf3d7b01d0f562e417adb4c13d453544485c013f29',
    nonGenIdState: '0xc3e9254b0becbf3d7b01d1f562e517adb3c13d453544485c013f29'
  },
  {
    id: '0x100abffc97a8c5c2b4b76499b8c9496ea542ef5d96d9734696f91d79561201',
    idType: '0x0112',
    genIdState:    '0x56791df9964673d9965def42a56e49c9b89964b7b4c2c5a897fcbf',
    nonGenIdState: '0x56791df9964673d9965def42a56e49c9b89964b7b4c2c5a897fcaa'
  },
  {
    id: '0x0e001218934f7ce626f0db5ea9459013d24a6400bd93dffafe4abb26e00000',
    idType: '0x0000',
    genIdState:    '0xe026bb4afefadf93bd00644ad2139045a95edbf026e67c4f931812',
    nonGenIdState: '0xe126bb4afefadf93bd00644ad2139045a95edbf026e67c4f931812'
  },
  {
    id: '0x0de448ffa90304f2f5c93ced0fedd52450638a0b625916feb9c0a519d10000',
    idType: '0x0000',
    genIdState:    '0xd119a5c0b9fe1659620b8a635024d5ed0fed3cc9f5f20403a9ff48',
    nonGenIdState: '0xd219a5c0b9fe1669620b8a635024d5ed0fed3cc9f5f20403a9ff49'
  },
  {
    id: '0x0ff8bffc97a8c5c2b4b76499b8c9496ea542ef5d96d9734696f91d79560001',
    idType: '0x0100',
    genIdState:    '0x56791df9964673d9965def42a56e49c9b89964b7b4c2c5a897fcbf',
    nonGenIdState: '0x76791df9964673d9965def42a56e49c9b89964b7b4c2c5a897fcbf'
  },
];

before(async () => {
  guWrpr = await deployGenesisUtilsWrapper();
});

describe("generate ID from genesis state and idType", function () {
    for (let i = 0; i < testVectors.length; i++) {
      it("testVector: " + i, async () => {
        const idResult = await guWrpr.calcIdFromGenesisState(testVectors[i].idType, testVectors[i].genIdState);
        await expect(BigInt(idResult._hex)).to.be.equal(BigInt(testVectors[i].id));
      });
    }
});

describe("check provided IDs in the genesis state", function () {
  for (let i = 0; i < testVectors.length; i++) {
    it("testVector: " + i, async () => {
      const genResult = await guWrpr.isGenesisState(testVectors[i].id, testVectors[i].genIdState);
      await expect(genResult).to.be.true;

      const nonGenResult = await guWrpr.isGenesisState(testVectors[i].id, testVectors[i].nonGenIdState);
      await expect(nonGenResult).to.be.false;
    });
  }

});
