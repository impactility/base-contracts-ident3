// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.20;

import {CredentialAtomicQueryValidatorBase} from "./CredentialAtomicQueryValidatorBase.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {ICircuitValidator} from "../interfaces/ICircuitValidator.sol";

abstract contract CredentialAtomicQueryV2ValidatorBase is CredentialAtomicQueryValidatorBase {
    /**
     * @dev Version of contract
     */

    struct CredentialAtomicQuery {
        uint256 schema;
        uint256 claimPathKey;
        uint256 operator;
        uint256 slotIndex;
        uint256[] value;
        uint256 queryHash;
        uint256[] allowedIssuers;
        string[] circuitIds;
        bool skipClaimRevocationCheck;
        // 0 for inclusion in merklized credentials, 1 for non-inclusion and for non-merklized credentials
        uint256 claimPathNotExists;
    }

    struct PubSignals {
        uint256 merklized;
        uint256 userID;
        uint256 issuerState;
        uint256 circuitQueryHash;
        uint256 requestID;
        uint256 challenge;
        uint256 gistRoot;
        uint256 issuerID;
        uint256 isRevocationChecked;
        uint256 issuerClaimNonRevState;
        uint256 timestamp;
    }

    function version() public pure virtual override returns (string memory);

    function parsePubSignals(
        uint256[] calldata inputs
    ) public pure virtual returns (PubSignals memory);

    function verify(
        uint256[] calldata inputs,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes calldata data,
        address sender
    ) external view override returns (ICircuitValidator.KeyToInputIndex[] memory) {
        CredentialAtomicQuery memory credAtomicQuery = abi.decode(data, (CredentialAtomicQuery));
        IVerifier verifier = _getCredentialAtomicQueryValidatorBaseStorage()._circuitIdToVerifier[
            credAtomicQuery.circuitIds[0]
        ];

        require(
            credAtomicQuery.circuitIds.length == 1 && verifier != IVerifier(address(0)),
            "Invalid circuit ID"
        );

        // verify that zkp is valid
        require(verifier.verify(a, b, c, inputs), "Proof is not valid");

        PubSignals memory signals = parsePubSignals(inputs);

        // check circuitQueryHash
        require(
            signals.circuitQueryHash == credAtomicQuery.queryHash,
            "Query hash does not match the requested one"
        );

        // TODO: add support for query to specific userID and then verifying it

        _checkMerklized(signals.merklized, credAtomicQuery.claimPathKey);
        _checkGistRoot(signals.gistRoot);
        //_checkAllowedIssuers(signals.issuerID, credAtomicQuery.allowedIssuers);
        //_checkClaimIssuanceState(signals.issuerID, signals.issuerState);
        //_checkClaimNonRevState(signals.issuerID, signals.issuerClaimNonRevState);
        //_checkProofExpiration(signals.timestamp);
        _checkIsRevocationChecked(
            signals.isRevocationChecked,
            credAtomicQuery.skipClaimRevocationCheck
        );

        // Checking challenge to prevent replay attacks from other addresses
        _checkChallenge(signals.challenge, sender);

        // selective disclosure is not supported for v2 onchain circuits
        return _getSpecialInputPairs();
    }

    function _checkMerklized(uint256 merklized, uint256 queryClaimPathKey) internal pure {
        uint256 shouldBeMerklized = queryClaimPathKey != 0 ? 1 : 0;
        require(merklized == shouldBeMerklized, "Merklized value is not correct");
    }

    function _checkIsRevocationChecked(
        uint256 isRevocationChecked,
        bool skipClaimRevocationCheck
    ) internal pure {
        uint256 expectedIsRevocationChecked = 1;
        if (skipClaimRevocationCheck) {
            expectedIsRevocationChecked = 0;
        }
        require(
            isRevocationChecked == expectedIsRevocationChecked,
            "Revocation check should match the query"
        );
    }

    function _getSpecialInputPairs()
        internal
        pure
        returns (ICircuitValidator.KeyToInputIndex[] memory)
    {
        ICircuitValidator.KeyToInputIndex[] memory pairs = new ICircuitValidator.KeyToInputIndex[](
            2
        );
        pairs[0] = ICircuitValidator.KeyToInputIndex({key: "userID", inputIndex: 1});
        pairs[1] = ICircuitValidator.KeyToInputIndex({key: "timestamp", inputIndex: 10});
        return pairs;
    }
}
