// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {GenesisUtils} from "../lib/GenesisUtils.sol";
import {ICircuitValidator} from "../interfaces/ICircuitValidator.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";
import {IState} from "../interfaces/IState.sol";
import {PoseidonFacade} from "../lib/Poseidon.sol";

abstract contract CredentialAtomicQueryValidator is OwnableUpgradeable, ICircuitValidator {
    struct CredentialAtomicQuery {
        uint256 schema;
        uint256 claimPathKey;
        uint256 operator;
        uint256[] value;
        uint256 queryHash;
        uint256[] allowedIssuers;
    }

    IVerifier public verifier;
    IState public state;

    uint256 public revocationStateExpirationTime;
    uint256 public proofGenerationExpirationTime;

    function initialize(
        address _verifierContractAddr,
        address _stateContractAddr
    ) public initializer {
        revocationStateExpirationTime = 1 hours;
        proofGenerationExpirationTime = 1 hours;
        verifier = IVerifier(_verifierContractAddr);
        state = IState(_stateContractAddr);
        __Ownable_init();
    }

    function setRevocationStateExpirationTime(uint256 expirationTime) public virtual onlyOwner {
        revocationStateExpirationTime = expirationTime;
    }

    function setProofGenerationExpirationTime(uint256 expirationTime) public virtual onlyOwner {
        proofGenerationExpirationTime = expirationTime;
    }

    function getCircuitId() external pure virtual returns (string memory id);

    function getChallengeInputIndex() external pure virtual returns (uint256 index);

    function verify(
        ZKPResponse calldata zkpResponse,
        bytes calldata cirquitQueryData
    ) external view virtual returns (bool) {
        // verify that zkp is valid
        require(
            verifier.verifyProof(zkpResponse.a, zkpResponse.b, zkpResponse.c, zkpResponse.inputs),
            "Proof is not valid"
        );
        CredentialAtomicQuery memory credAtomicQuery = abi.decode(
            cirquitQueryData,
            (CredentialAtomicQuery)
        );

        if (credAtomicQuery.queryHash == 0) {
            // only merklized claims are supported (claimPathNotExists is false, slot index is set to 0 )
            uint256 valueHash = PoseidonFacade.poseidonSponge(credAtomicQuery.value);
            uint256 queryHash = PoseidonFacade.poseidon6(
                [
                    credAtomicQuery.schema,
                    0,
                    credAtomicQuery.operator,
                    credAtomicQuery.claimPathKey,
                    0,
                    valueHash
                ]
            );
            credAtomicQuery.queryHash = queryHash;
        }

        //destrcut values from result array
        uint256[] memory validationParams = _getInputValidationParameters(zkpResponse.inputs);
        uint256 inputQueryHash = validationParams[0];
        require(
            inputQueryHash == credAtomicQuery.queryHash,
            "query hash does not match the requested one"
        );

        uint256 gistRoot = validationParams[1];
        _checkGistRoot(gistRoot);

        uint256 issuerId = validationParams[2];
        _checkAllowedIssuers(issuerId, credAtomicQuery.allowedIssuers);
        uint256 issuerClaissuerClaimState = validationParams[3];
        _checkStateContractOrGenesis(issuerId, issuerClaissuerClaimState);
        uint256 issuerClaimNonRevState = validationParams[4];
        _checkClaimNonRevState(issuerId, issuerClaimNonRevState);
        uint256 proofGenerationTimestamp = validationParams[5];
        _checkProofGeneratedExpiration(proofGenerationTimestamp);
        return (true);
    }

    function _getInputValidationParameters(
        uint256[] calldata inputs
    ) internal pure virtual returns (uint256[] memory);

    function _checkGistRoot(uint256 gistRoot) internal view {
        IState.GistRootInfo memory rootInfo = state.getGISTRootInfo(gistRoot);
        require(rootInfo.root == gistRoot, "Gist root state isn't in state contract");
    }

    function _checkStateContractOrGenesis(uint256 _id, uint256 _state) internal view {
        bool isStateGenesis = GenesisUtils.isGenesisState(_id, _state);

        if (!isStateGenesis) {
            IState.StateInfo memory stateInfo = state.getStateInfoByIdAndState(_id, _state);
            require(_id == stateInfo.id, "state doesn't exist in state contract");
        }
    }

    function _checkClaimNonRevState(uint256 _id, uint256 _claimNonRevState) internal view {
        IState.StateInfo memory claimNonRevStateInfo = state.getStateInfoById(_id);

        if (claimNonRevStateInfo.state == 0) {
            require(
                GenesisUtils.isGenesisState(_id, _claimNonRevState),
                "Non-Revocation state isn't in state contract and not genesis"
            );
        } else {
            // The non-empty state is returned, and it's not equal to the state that the user has provided.
            if (claimNonRevStateInfo.state != _claimNonRevState) {
                // Get the time of the latest state and compare it to the transition time of state provided by the user.
                IState.StateInfo memory claimNonRevLatestStateInfo = state.getStateInfoByIdAndState(
                    _id,
                    _claimNonRevState
                );

                if (claimNonRevLatestStateInfo.id == 0 || claimNonRevLatestStateInfo.id != _id) {
                    revert("state in transition info contains invalid id");
                }

                if (claimNonRevLatestStateInfo.replacedAtTimestamp == 0) {
                    revert("Non-Latest state doesn't contain replacement information");
                }

                if (
                    block.timestamp - claimNonRevLatestStateInfo.replacedAtTimestamp >
                    revocationStateExpirationTime
                ) {
                    revert("Non-Revocation state of Issuer expired");
                }
            }
        }
    }

    function _checkProofGeneratedExpiration(uint256 _proofGenerationTimestamp) internal view {
        if (block.timestamp - _proofGenerationTimestamp > proofGenerationExpirationTime) {
            revert("Generated proof is outdated");
        }
    }

    function _checkAllowedIssuers(uint256 issuerId, uint256[] memory allowedIssuers) internal pure {
        // empty array is 'allow all' equivalent - ['*']
        if (allowedIssuers.length == 0) {
            return;
        }

        for (uint i = 0; i < allowedIssuers.length; i++) {
            if (issuerId == allowedIssuers[i]) {
                return;
            }
        }

        revert("Issuer is not on the Allowed Issuers list");
    }
}
