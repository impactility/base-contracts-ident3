// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

import "solidity-bytes-utils/contracts/BytesLib.sol";

library GenesisUtils {
    /**
     * @dev int256ToBytes
     */
    function int256ToBytes(uint256 x) internal pure returns (bytes memory b) {
        b = new bytes(32);
        assembly {
            mstore(add(b, 32), x)
        }
    }

    /**
     * @dev reverse
     */
    function reverse(uint256 input) internal pure returns (uint256 v) {
        v = input;

        // swap bytes
        v =
            ((v & 0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00) >> 8) |
            ((v & 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v =
            ((v & 0xFFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000) >> 16) |
            ((v & 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v =
            ((v & 0xFFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000) >> 32) |
            ((v & 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF) << 32);

        // swap 8-byte long pairs
        v =
            ((v & 0xFFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF0000000000000000) >> 64) |
            ((v & 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF) << 64);

        // swap 16-byte long pairs
        v = (v >> 128) | (v << 128);
    }

    /**
     * @dev reverse uint16
     */
    function reverse16(uint16 input) internal pure returns (uint16 v) {
        v = input;

        // swap bytes
        v = (v >> 8) | (v << 8);
    }

    /**
     *   @dev sum
     */
    function sum(bytes memory array) internal pure returns (uint16 s) {
        require(array.length == 29, "Checksum requires 29 length array");

        for (uint256 i = 0; i < array.length; ++i) {
            s += uint16(uint8(array[i]));
        }
    }

    /**
     * @dev bytesToHexString
     */
    function bytesToHexString(bytes memory buffer) internal pure returns (string memory) {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer.length * 2);

        bytes memory _base = "0123456789abcdef";

        for (uint256 i = 0; i < buffer.length; i++) {
            converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
        }

        return string(abi.encodePacked("0x", converted));
    }

    /**
     * @dev compareStrings
     */
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        if (bytes(a).length != bytes(b).length) {
            return false;
        }
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    /**
     * @dev isGenesisState
     */
    function isGenesisState(uint256 id, uint256 idState) internal pure returns (bool)
    {
        bytes memory idBytes = int256ToBytes(id);

        bytes memory idType = BytesLib.slice(idBytes, idBytes.length - 31, 2);

        // TODO: maybe we can do just bytes2(idBytes) - should take first 2 bytes
        uint256 computedId = calcIdFromGenesisState(bytes2(idType), idState);

        return id == computedId;
    }

    /**
     * @dev calcIdFromGenesisState
     */
    function calcIdFromGenesisState(bytes2 idType, uint256 idState) internal pure returns (uint256) {
        bytes memory userStateB1 = int256ToBytes(idState);

        bytes memory cutState = BytesLib.slice(userStateB1, userStateB1.length - 27, 27);

        bytes memory beforeChecksum = BytesLib.concat(abi.encodePacked(idType), cutState);
        require(beforeChecksum.length == 29, "Checksum requires 29 length array");

        uint16 checksum = reverse16(sum(beforeChecksum));

        bytes memory checkSumBytes = abi.encodePacked(checksum);

        bytes memory idBytes = BytesLib.concat(beforeChecksum, checkSumBytes);
        require(idBytes.length == 31, "idBytes requires 31 length array");

        return uint256(uint248(bytes31(idBytes)));
    }

    /**
     * @dev calcOnchainIdFromAddress
     */
    function calcOnchainIdFromAddress(bytes2 idType, address caller) internal pure returns (uint256)
    {
        // shift address left 7 bytes, because calcIdFromGenesisState cuts last 5 bytes after swapping endianness:
        // 32 bytes of uint256 - 20bytes of address - 5 bytes cut by calcIdFromGenesisState == 7 bytes shift
        uint256 addrShifted = reverse(uint256(uint160(caller))<<56);
        return calcIdFromGenesisState(idType, addrShifted);
    }

    /**
     * @dev toUint256
     */
    function toUint256(bytes memory _bytes) internal pure returns (uint256 value) {
        assembly {
            value := mload(add(_bytes, 0x20))
        }
    }

    /**
     * @dev bytesToAddress
     */
    function bytesToAddress(bytes memory bys) internal pure returns (address addr) {
        assembly {
            addr := mload(add(bys, 20))
        }
    }

    /**
     * @dev int256ToAddress
     */
    function int256ToAddress(uint256 input) internal pure returns (address) {
        return bytesToAddress(int256ToBytes(reverse(input)));
    }
}
