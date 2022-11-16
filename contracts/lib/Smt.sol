// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;
pragma abicoder v2;

import "../lib/Poseidon.sol";

uint256 constant MAX_SMT_DEPTH = 32;
uint256 constant SMT_ROOT_HISTORY_RETURN_LIMIT = 1000;

/**
 * @dev Enum of SMT node types
 */
enum NodeType {
    EMPTY,
    LEAF,
    MIDDLE
}

/**
 * @dev Sparse Merkle Tree data
 */
struct SmtData {
    mapping(uint256 => Node) nodes;
    uint256[] rootHistory;
    mapping(uint256 => RootEntry) rootEntries;
    // This empty reserved space is put in place to allow future versions
    // of the SMT library to add new SmtData struct fields without shifting down
    // storage of upgradable contracts that use this struct as a state variable
    // (see https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#storage-gaps)
    uint256[50] __gap;
}

/**
 * @dev Struct of the node proof in the SMT
 */
struct Proof {
    uint256 root;
    uint256[MAX_SMT_DEPTH] siblings;
    uint256 oldKey;
    uint256 oldValue;
    bool isOld0;
    uint256 key;
    uint256 value;
    uint256 fnc;
}

/**
 * @dev Struct for public interfaces to represent SMT root info.
 * @param root This SMT root.
 * @param replacedByRoot A root, which replaced this root.
 * @param createdAtTimestamp A time, when the root was saved to blockchain.
 * @param replacedAtTimestamp A time, when the root was replaced by the next root in blockchain.
 * @param createdAtBlock A number of block, when the root was saved to blockchain.
 * @param replacedAtBlock A number of block, when the root was replaced by the next root in blockchain.
 */
struct RootInfo {
    uint256 root;
    uint256 replacedByRoot;
    uint256 createdAtTimestamp;
    uint256 replacedAtTimestamp;
    uint256 createdAtBlock;
    uint256 replacedAtBlock;
}

/**
 * @dev Struct for SMT root internal storage representation.
 * @param replacedByRoot A root, which replaced this root.
 * @param createdAtTimestamp A time, when the root was saved to blockchain.
 * @param createdAtBlock A number of block, when the root was saved to blockchain.
 */
struct RootEntry {
    uint256 replacedByRoot;
    uint256 createdAtTimestamp;
    uint256 createdAtBlock;
}

/**
 * @dev Struct SMT node.
 * @param NodeType type of node.
 * @param childLeft left child of node.
 * @param childRight right child of node.
 * @param Index index of node.
 * @param Value value of node.
 */
struct Node {
    NodeType nodeType;
    uint256 childLeft;
    uint256 childRight;
    uint256 index;
    uint256 value;
}

/// @title A sparse merkle tree implementation, which keeps tree history.
library Smt {
    using BinarySearchSmtRoots for SmtData;

    /**
     * @dev Add anode to the SMT
     * @param i Index of node
     * @param v Value of node
     */
    function add(
        SmtData storage self,
        uint256 i,
        uint256 v
    ) public {
        _processLeaf(self, i, v, block.timestamp, block.number);
    }

    /**
     * @dev Get max depth of SMT.
     * @return max depth of SMT.
     */
    function getMaxDepth() public pure returns (uint256) {
        return MAX_SMT_DEPTH; // todo put to SmtData struct ???
    }

    /**
     * @dev Get SMT root history length
     * @return SMT history length
     */
    function getRootHistoryLength(SmtData storage self)
        public
        view
        returns (uint256)
    {
        return self.rootHistory.length;
    }

    /**
     * @dev Get SMT root history
     * @param startIndex start index of history
     * @param endIndex end index of history
     * @return array of SMT historical roots with timestamp and block number info
     */
    function getRootHistory(
        SmtData storage self,
        uint256 startIndex,
        uint256 endIndex
    ) public view returns (RootInfo[] memory) {
        require(
            startIndex >= 0 && endIndex < self.rootHistory.length,
            "index out of bounds of array"
        );
        require(
            endIndex - startIndex + 1 <= SMT_ROOT_HISTORY_RETURN_LIMIT,
            "return limit exceeded"
        );
        RootInfo[] memory result = new RootInfo[](endIndex - startIndex + 1);
        uint64 j = 0;
        for (uint256 i = startIndex; i <= endIndex; i++) {
            uint256 root = self.rootHistory[i];
            result[j] = getRootInfo(self, root);
            j++;
        }
        return result;
    }

    function getNodeHash(Node memory node) internal view returns (uint256) {
        uint256 nodeHash;
        if (node.nodeType == NodeType.LEAF) {
            uint256[3] memory params = [node.index, node.value, uint256(1)];
            nodeHash = PoseidonUnit3L.poseidon(params);
        } else if (node.nodeType == NodeType.MIDDLE) {
            nodeHash = PoseidonUnit2L.poseidon(
                [node.childLeft, node.childRight]
            );
        }
        return nodeHash; // Note: expected to return 0 if NodeType.EMPTY, which is the only option left
    }

    /**
     * @dev Get the SMT node by hash
     * @param nodeHash Hash of a node
     * @return A node
     */
    function getNode(SmtData storage self, uint256 nodeHash)
        public
        view
        returns (Node memory)
    {
        return self.nodes[nodeHash];
    }

    /**
     * @dev Get the proof if a node with specific index exists or not exists in the SMT
     * @param index Node index
     * @return The node proof
     */
    function getProof(SmtData storage self, uint256 index)
        public
        view
        returns (Proof memory)
    {
        return getProofByRoot(self, index, getRoot(self));
    }

    /**
     * @dev Get the proof if a node with specific index exists or not exists in the SMT for some historical tree state
     * @param index Node index
     * @param historicalRoot Historical SMT roof to get proof for
     * @return The node proof
     */
    function getProofByRoot(
        SmtData storage self,
        uint256 index,
        uint256 historicalRoot
    ) public view returns (Proof memory) {
        Proof memory proof;
        proof.root = historicalRoot;
        proof.key = index;

        uint256 nextNodeHash = historicalRoot;
        Node memory node;

        for (uint256 i = 0; i < MAX_SMT_DEPTH; i++) {
            node = getNode(self, nextNodeHash);
            if (node.nodeType == NodeType.EMPTY) {
                proof.fnc = 1;
                proof.isOld0 = true;
                break;
            } else if (node.nodeType == NodeType.LEAF) {
                if (node.index == proof.key) {
                    proof.value = node.value;
                    break;
                } else {
                    proof.oldKey = node.index;
                    proof.oldValue = node.value;
                    proof.value = node.value;
                    proof.fnc = 1;
                    break;
                }
            } else if (node.nodeType == NodeType.MIDDLE) {
                if ((proof.key >> i) & 1 == 1) {
                    nextNodeHash = node.childRight;
                    proof.siblings[i] = node.childLeft;
                } else {
                    nextNodeHash = node.childLeft;
                    proof.siblings[i] = node.childRight;
                }
            } else {
                revert("Invalid node type");
            }
        }
        return proof;
    }

    /**
     * @dev Get the proof if a node with specific index exists or not exists in the SMT for some historical timestamp
     * @param index Node index
     * @param timestamp The nearest timestamp to get proof for
     * @return The node proof
     */
    function getProofByTime(
        SmtData storage self,
        uint256 index,
        uint256 timestamp
    ) public view returns (Proof memory) {
        RootInfo memory rootInfo = getRootInfoByTime(self, timestamp);

        require(rootInfo.root != 0, "historical root not found");

        return getProofByRoot(self, index, rootInfo.root);
    }

    /**
     * @dev Get the proof if a node with specific index exists or not exists in the SMT for some historical block number
     * @param index Node index
     * @param blockNumber The nearest block number to get proof for
     * @return The node proof
     */
    function getProofByBlock(
        SmtData storage self,
        uint256 index,
        uint256 blockNumber
    ) public view returns (Proof memory) {
        RootInfo memory rootInfo = getRootInfoByBlock(self, blockNumber);

        require(rootInfo.root != 0, "historical root not found");

        return getProofByRoot(self, index, rootInfo.root);
    }

    function getRoot(SmtData storage self) public view returns (uint256) {
        return
            self.rootHistory.length > 0
                ? self.rootHistory[self.rootHistory.length - 1]
                : 0;
    }

    /**
     * @dev binary search by timestamp
     * @param timestamp timestamp
     * return parameters are (by order): block number, block timestamp, state
     */
    function getRootInfoByTime(SmtData storage self, uint256 timestamp)
        public
        view
        returns (RootInfo memory)
    {
        require(timestamp <= block.timestamp, "errNoFutureAllowed");

        uint256 root = self.binarySearchUint256(
            timestamp,
            SearchType.TIMESTAMP
        );

        return getRootInfo(self, root);
    }

    /**
     * @dev binary search by block number
     * @param blockN block number
     * return parameters are (by order): block number, block timestamp, state
     */
    function getRootInfoByBlock(SmtData storage self, uint256 blockN)
        public
        view
        returns (RootInfo memory)
    {
        require(blockN <= block.number, "errNoFutureAllowed");

        uint256 root = self.binarySearchUint256(blockN, SearchType.BLOCK);

        return getRootInfo(self, root);
    }

    function getRootInfo(SmtData storage self, uint256 root)
        public
        view
        returns (RootInfo memory)
    {
        RootInfo memory rootInfo;
        rootInfo.createdAtTimestamp = self.rootEntries[root].createdAtTimestamp;
        rootInfo.createdAtBlock = self.rootEntries[root].createdAtBlock;
        rootInfo.replacedByRoot = self.rootEntries[root].replacedByRoot;
        rootInfo.replacedAtBlock = rootInfo.replacedByRoot == 0
            ? 0
            : self.rootEntries[rootInfo.replacedByRoot].createdAtBlock;
        rootInfo.replacedAtTimestamp = rootInfo.replacedByRoot == 0
            ? 0
            : self.rootEntries[rootInfo.replacedByRoot].createdAtTimestamp;
        rootInfo.root = root;

        return rootInfo;
    }

    function _processLeaf(
        SmtData storage self,
        uint256 i,
        uint256 v,
        uint256 timestamp,
        uint256 blockNumber
    ) internal {
        Node memory node = Node(NodeType.LEAF, 0, 0, i, v);
        uint256 prevRoot = getRoot(self);
        uint256 newRoot = _addLeaf(self, node, prevRoot, 0);

        self.rootHistory.push(newRoot);

        self.rootEntries[newRoot].createdAtTimestamp = timestamp;
        self.rootEntries[newRoot].createdAtBlock = blockNumber;
        if (prevRoot != 0) {
            self.rootEntries[prevRoot].replacedByRoot = newRoot;
        }
    }

    function _addLeaf(
        SmtData storage self,
        Node memory newLeaf,
        uint256 nodeHash,
        uint256 depth
    ) internal returns (uint256) {
        if (depth > MAX_SMT_DEPTH) {
            revert("Max depth reached");
        }

        Node memory node = self.nodes[nodeHash];
        uint256 nextNodeHash;
        uint256 leafHash;

        if (node.nodeType == NodeType.EMPTY) {
            leafHash = _addNode(self, newLeaf);
        } else if (node.nodeType == NodeType.LEAF) {
            leafHash = node.index == newLeaf.index
                ? _addNode(self, newLeaf)
                : _pushLeaf(
                    self,
                    newLeaf,
                    node,
                    depth,
                    newLeaf.index,
                    node.index
                );
        } else if (node.nodeType == NodeType.MIDDLE) {
            Node memory newNodeMiddle;

            if ((newLeaf.index >> depth) & 1 == 1) {
                nextNodeHash = _addLeaf(
                    self,
                    newLeaf,
                    node.childRight,
                    depth + 1
                );
                newNodeMiddle = Node(
                    NodeType.MIDDLE,
                    node.childLeft,
                    nextNodeHash,
                    0,
                    0
                );
            } else {
                nextNodeHash = _addLeaf(
                    self,
                    newLeaf,
                    node.childLeft,
                    depth + 1
                );
                newNodeMiddle = Node(
                    NodeType.MIDDLE,
                    nextNodeHash,
                    node.childRight,
                    0,
                    0
                );
            }

            leafHash = _addNode(self, newNodeMiddle);
        }

        return leafHash;
    }

    function _pushLeaf(
        SmtData storage self,
        Node memory newLeaf,
        Node memory oldLeaf,
        uint256 depth,
        uint256 pathNewLeaf,
        uint256 pathOldLeaf
    ) internal returns (uint256) {
        if (depth > MAX_SMT_DEPTH - 2) {
            revert("Max depth reached");
        }

        Node memory newNodeMiddle;

        // Check if we need to go deeper!
        if ((pathNewLeaf >> depth) & 1 == (pathOldLeaf >> depth) & 1) {
            uint256 nextNodeHash = _pushLeaf(
                self,
                newLeaf,
                oldLeaf,
                depth + 1,
                pathNewLeaf,
                pathOldLeaf
            );

            if ((pathNewLeaf >> depth) & 1 == 1) {
                // go right
                newNodeMiddle = Node(NodeType.MIDDLE, 0, nextNodeHash, 0, 0);
            } else {
                // go left
                newNodeMiddle = Node(NodeType.MIDDLE, nextNodeHash, 0, 0, 0);
            }
            return _addNode(self, newNodeMiddle);
        }

        if ((pathNewLeaf >> depth) & 1 == 1) {
            newNodeMiddle = Node(
                NodeType.MIDDLE,
                getNodeHash(oldLeaf),
                getNodeHash(newLeaf),
                0,
                0
            );
        } else {
            newNodeMiddle = Node(
                NodeType.MIDDLE,
                getNodeHash(newLeaf),
                getNodeHash(oldLeaf),
                0,
                0
            );
        }

        _addNode(self, newLeaf);
        return _addNode(self, newNodeMiddle);
    }

    function _addNode(SmtData storage self, Node memory node)
        internal
        returns (uint256)
    {
        uint256 nodeHash = getNodeHash(node);
        require(
            self.nodes[nodeHash].nodeType == NodeType.EMPTY,
            "Node already exists with the same index and value"
        );
        // We do not store empty nodes so can check if an entry exists
        self.nodes[nodeHash] = node;
        return nodeHash;
    }
}

/**
 * @dev Enum for the SMT history field selection
 */
enum SearchType {
    TIMESTAMP,
    BLOCK
}

/// @title A binary search for the sparse merkle tree root history
library BinarySearchSmtRoots {
    function binarySearchUint256(
        SmtData storage self,
        uint256 value,
        SearchType searchType
    ) internal view returns (uint256) {
        if (self.rootHistory.length == 0) {
            return 0;
        }

        uint256 min = 0;
        uint256 max = self.rootHistory.length - 1;
        uint256 mid;
        uint256 midRoot;

        while (min <= max) {
            mid = (max + min) / 2;
            midRoot = self.rootHistory[mid];

            uint256 midValue = fieldSelector(
                self.rootEntries[midRoot],
                searchType
            );
            if (midValue == value) {
                while (mid < self.rootHistory.length - 1) {
                    uint256 nextRoot = self.rootHistory[mid + 1];
                    uint256 nextValue = fieldSelector(
                        self.rootEntries[nextRoot],
                        searchType
                    );
                    if (nextValue == value) {
                        mid++;
                        midRoot = nextRoot;
                    } else {
                        return midRoot;
                    }
                }
                return midRoot;
            } else if (value > midValue) {
                min = mid + 1;
            } else if (value < midValue && mid > 0) {
                // mid > 0 is to avoid underflow
                max = mid - 1;
            } else {
                // This means that value < midValue && mid == 0. So we return zero,
                // when search for a value less than the value in the first root
                return 0;
            }
        }

        // The case when the searched value does not exist and we should take the closest smaller value
        // Index in the "max" var points to the root with max value smaller than the searched value
        return self.rootHistory[max];
    }

    function fieldSelector(RootEntry memory rti, SearchType st)
        internal
        pure
        returns (uint256)
    {
        if (st == SearchType.BLOCK) {
            return rti.createdAtBlock;
        } else if (st == SearchType.TIMESTAMP) {
            return rti.createdAtTimestamp;
        } else {
            revert("Invalid search type");
        }
    }
}
