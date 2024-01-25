// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ICircuitValidator} from "../interfaces/ICircuitValidator.sol";
import {IZKPVerifier} from "../interfaces/IZKPVerifier.sol";
import {ArrayUtils} from "../lib/ArrayUtils.sol";

/// @title Universal Verifier Contract
/// @notice A contract to manage ZKP (Zero-Knowledge Proof) requests and proofs.
contract UniversalVerifier is OwnableUpgradeable {
    struct StorageField {
        uint256 value;
        bytes rawValue;
    }

    /// @dev Struct to store ZKP proof and associated data
    struct Proof {
        bool isProved;
        mapping(string => StorageField) storageFields;
        bytes metadata;
    }

    /// @dev Main storage structure for the contract
    struct MainStorage {
        mapping(address => mapping(uint64 => Proof)) proofs;
        mapping(uint64 => IZKPVerifier.ZKPRequestExtended) requests;
        uint64[] requestIds;
        mapping(address => uint64[]) userRequestIds;
        mapping(ICircuitValidator => bool) whitelistedValidators;
        mapping(uint256 => bytes) hashPreimages; //TODO add some method to populate
    }

    uint256 constant REQUESTS_RETURN_LIMIT = 1000;

    // keccak256(abi.encode(uint256(keccak256("iden3.storage.UniversalVerifier")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant UNIVERSAL_VERIFIER_STORAGE_LOCATION =
        0x0c87ac878172a541d6ba539a4e02bbe44e1f3a504bea30ed92c32fb1517db700;

    /// @dev Get the main storage using assembly to ensure specific storage location
    function _getMainStorage() private pure returns (MainStorage storage $) {
        assembly {
            $.slot := UNIVERSAL_VERIFIER_STORAGE_LOCATION
        }
    }

    /// @dev Event emitted upon submitting a ZKP request
    event ZKPResponseSubmitted(uint64 indexed requestId, address indexed caller);

    /// @dev Event emitted upon adding a ZKP request
    event ZKPRequestAdded(
        uint64 indexed requestId,
        address indexed controller,
        string metadata,
        bytes data
    );

    event AddStorageFieldRawValue(
        address indexed signer,
        uint64 indexed requestId,
        string key,
        bytes rawValue
    );

    /// @dev Modifier to check if the caller is the owner or controller of the ZKP request
    modifier onlyOwnerOrController(uint64 requestId) {
        require(
            msg.sender == _getMainStorage().requests[requestId].controller || msg.sender == owner(),
            "Only owner or controller can call this function"
        );
        _;
    }

    /// @dev Modifier to check if the ZKP request is enabled
    modifier requestEnabled(uint64 requestId) {
        require(!_getMainStorage().requests[requestId].isDisabled, "Request is disabled");
        _;
    }

    /// @dev Modifier to check if the validator is whitelisted
    modifier isWhitelistedValidator(ICircuitValidator validator) {
        require(_getMainStorage().whitelistedValidators[validator], "Validator is not whitelisted");
        _;
    }

    /// @notice Initializes the contract
    function initialize() public initializer {
        __Ownable_init();
    }

    /// @notice Adds a new whitelisted validator
    function addWhitelistedValidator(ICircuitValidator validator) public onlyOwner {
        _getMainStorage().whitelistedValidators[validator] = true;
    }

    /// @notice Adds a new ZKP request
    /// @param request The ZKP request data
    function addZKPRequest(
        IZKPVerifier.ZKPRequest calldata request
    ) public isWhitelistedValidator(request.validator) {
        address sender = _msgSender();
        uint64 requestId = uint64(_getMainStorage().requestIds.length);
        _getMainStorage().requestIds.push(requestId);
        _getMainStorage().userRequestIds[sender].push(requestId);
        IZKPVerifier.ZKPRequestExtended memory requestWithController = IZKPVerifier
            .ZKPRequestExtended(request.metadata, request.validator, request.data, sender, false);
        _getMainStorage().requests[requestId] = requestWithController;
        emit ZKPRequestAdded(requestId, sender, request.metadata, request.data);
    }

    /// @notice Sets a ZKP request
    /// @param requestId The ID of the ZKP request
    function disableZKPRequest(uint64 requestId) public onlyOwnerOrController(requestId) {
        _getMainStorage().requests[requestId].isDisabled = true;
    }

    /// @notice Sets a ZKP request
    /// @param requestId The ID of the ZKP request
    function enableZKPRequest(uint64 requestId) public onlyOwnerOrController(requestId) {
        _getMainStorage().requests[requestId].isDisabled = false;
    }

    /// @notice Checks if a ZKP request ID exists
    /// @param requestId The ID of the ZKP request
    /// @return Whether the request ID exists
    function requestIdExists(uint64 requestId) public view returns (bool) {
        return _getMainStorage().requests[requestId].validator != ICircuitValidator(address(0));
    }

    /// @notice Gets the count of ZKP requests
    /// @return The count of ZKP requests
    function getZKPRequestsCount() public view returns (uint256) {
        return _getMainStorage().requestIds.length;
    }

    /// @notice Gets a specific ZKP request by ID
    /// @param requestId The ID of the ZKP request
    /// @return The ZKP request data
    function getZKPRequest(
        uint64 requestId
    ) public view returns (IZKPVerifier.ZKPRequestExtended memory) {
        require(requestIdExists(requestId), "request id doesn't exist");
        return _getMainStorage().requests[requestId];
    }

    /// @notice Gets multiple ZKP requests within a range
    /// @param startIndex The starting index of the range
    /// @param length The length of the range
    /// @return An array of ZKP requests within the specified range
    function getZKPRequests(
        uint256 startIndex,
        uint256 length
    ) public view returns (IZKPVerifier.ZKPRequestExtended[] memory) {
        (uint256 start, uint256 end) = ArrayUtils.calculateBounds(
            _getMainStorage().requestIds.length,
            startIndex,
            length,
            REQUESTS_RETURN_LIMIT
        );

        IZKPVerifier.ZKPRequestExtended[] memory result = new IZKPVerifier.ZKPRequestExtended[](
            end - start
        );

        for (uint256 i = start; i < end; i++) {
            result[i - start] = _getMainStorage().requests[_getMainStorage().requestIds[i]];
        }

        return result;
    }

    /// @notice Gets multiple ZKP requests within a range for specific controller
    /// @param controller The controller address
    /// @param startIndex The starting index of the range
    /// @param length The length of the range
    /// @return An array of ZKP requests within the specified range
    function getControllerZKPRequests(
        address controller,
        uint256 startIndex,
        uint256 length
    ) public view returns (IZKPVerifier.ZKPRequestExtended[] memory) {
        (uint256 start, uint256 end) = ArrayUtils.calculateBounds(
            _getMainStorage().userRequestIds[controller].length,
            startIndex,
            length,
            REQUESTS_RETURN_LIMIT
        );

        IZKPVerifier.ZKPRequestExtended[] memory result = new IZKPVerifier.ZKPRequestExtended[](
            end - start
        );

        for (uint256 i = start; i < end; i++) {
            result[i - start] = _getMainStorage().requests[
                _getMainStorage().userRequestIds[controller][i]
            ];
        }

        return result;
    }

    /// @notice Checks the proof status for a given user and request ID
    /// @param user The user's address
    /// @param requestId The ID of the ZKP request
    /// @return The status of the proof
    function getProofStatus(address user, uint64 requestId) public view returns (bool) {
        return _getMainStorage().proofs[user][requestId].isProved;
    }

    /// @notice Submits a ZKP response and updates proof status
    /// @param requestId The ID of the ZKP request
    /// @param inputs The input data for the proof
    /// @param a The first component of the proof
    /// @param b The second component of the proof
    /// @param c The third component of the proof
    function submitZKPResponse(
        uint64 requestId,
        uint256[] calldata inputs,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c // TODO add bytes calldata additionalData, string calldata circuitId
//        string calldata circuitId
//        bytes calldata additionalData,
    ) public requestEnabled(requestId) {
        address sender = _msgSender();
        require(
            _getMainStorage().requests[requestId].validator != ICircuitValidator(address(0)),
            "validator is not set for this request id"
        );

        bytes memory returnData = _callVerifyWithSender(
            requestId,
            inputs,
            a,
            b,
            c,
            sender
        );

        ICircuitValidator.KeyInputIndexPair[] memory pairs = abi.decode(returnData, (
            ICircuitValidator.KeyInputIndexPair[]
        ));

        for (uint256 i = 0; i < pairs.length; i++) {
            _getMainStorage().proofs[sender][requestId].storageFields[pairs[i].key] = StorageField(
                inputs[pairs[i].inputIndex],
                ""
            );
            if (keccak256(bytes(pairs[i].key)) == keccak256(bytes("operatorOutput"))) {
                uint256 hash = inputs[pairs[i].inputIndex];
                // TODO check against selective disclosure key-value
                require(_getMainStorage().hashPreimages[hash].length > 0);
            }
        }

        _getMainStorage().proofs[msg.sender][requestId].isProved = true;
        emit ZKPResponseSubmitted(requestId, sender);
    }

    /// @notice Verifies a ZKP response without updating any proof status
    /// @param requestId The ID of the ZKP request
    /// @param inputs The public inputs for the proof
    /// @param a The first component of the proof
    /// @param b The second component of the proof
    /// @param c The third component of the proof
    function verifyZKPResponse(
        uint64 requestId,
        uint256[] calldata inputs,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) public view requestEnabled(requestId) {
        require(
            _getMainStorage().requests[requestId].validator != ICircuitValidator(address(0)),
            "validator is not set for this request id"
        );

        _callVerifyWithSender(requestId, inputs, a, b, c, _msgSender());
    }

    /// @notice Adds a raw value to the proof storage item for a given user, request ID and key
    /// @param requestId The ID of the ZKP request
    /// @param key The key of the storage item
    /// @param rawValue The raw value to add
    function addStorageFieldRawValue(
        uint64 requestId,
        string memory key,
        bytes memory rawValue
    ) public {
        address signer = _msgSender();
        _getMainStorage().proofs[signer][requestId].storageFields[key].rawValue = rawValue;
        emit AddStorageFieldRawValue(signer, requestId, key, rawValue);
    }

    /// @notice Gets the proof storage item for a given user, request ID and key
    /// @param user The user's address
    /// @param requestId The ID of the ZKP request
    /// @return The proof
    function getProofStorageField(
        address user,
        uint64 requestId,
        string memory key
    ) public view returns (StorageField memory) {
        return _getMainStorage().proofs[user][requestId].storageFields[key];
    }

    function _callVerifyWithSender(
        uint64 requestId,
        uint256[] calldata inputs,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        address sender
    ) internal view returns (bytes memory) {
        IZKPVerifier.ZKPRequestExtended memory request = _getMainStorage().requests[requestId];
        bytes4 selector = request.validator.verify.selector;
        bytes memory data = abi.encodePacked(
            selector,
            abi.encode(inputs, a, b, c, request.data),
            sender
        );
        (bool success, bytes memory returnData) = address(request.validator).staticcall(data);
        if (!success) {
            if (returnData.length > 0) {
                // Extract revert reason from returnData
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert("Failed to verify proof without revert reason");
            }
        }
        return returnData;
    }
}