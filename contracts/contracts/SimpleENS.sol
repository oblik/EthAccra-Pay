
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleENS {
    mapping(bytes32 => address) public addr;

    event ENSSet(bytes32 indexed node, address indexed resolved);

    function setAddr(bytes32 node, address resolved) external {
        addr[node] = resolved;
        emit ENSSet(node, resolved);
    }

    function getAddr(bytes32 node) external view returns (address) {
        return addr[node];
    }
}
