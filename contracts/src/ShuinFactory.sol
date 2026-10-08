// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ShuinCollection} from "./ShuinCollection.sol";

/// @title ShuinFactory
/// @notice Deploys ShuinCollection clones. The factory itself is deployed through the
/// deterministic CREATE2 deployer, so it lives at the same address on every chain.
contract ShuinFactory {
    address public immutable implementation;

    event CollectionCreated(address indexed creator, address indexed collection, string name, string symbol);

    constructor() {
        implementation = address(new ShuinCollection());
    }

    function createCollection(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        string calldata contractURI,
        address royaltyReceiver,
        uint96 royaltyBps,
        ShuinCollection.Config calldata config
    ) external returns (address collection) {
        collection = Clones.cloneDeterministic(implementation, _salt(msg.sender, salt));
        ShuinCollection(collection).initialize(
            name, symbol, contractURI, msg.sender, royaltyReceiver, royaltyBps, config
        );
        emit CollectionCreated(msg.sender, collection, name, symbol);
    }

    function predictAddress(address creator, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(creator, salt));
    }

    /// Salt is namespaced by creator so nobody can front-run someone else's address.
    function _salt(address creator, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(creator, salt));
    }
}
