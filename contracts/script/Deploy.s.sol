// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ShuinFactory} from "../src/ShuinFactory.sol";
import {ShuinCollection} from "../src/ShuinCollection.sol";
import {ShuinStore} from "../src/ShuinStore.sol";

/// Deploys the on-chain file store and the factory through the canonical CREATE2 deployer
/// (same addresses on every chain),
/// then the shared "Shuin Open Book": a free, public collection anyone can seal into.
///
///   forge script script/Deploy.s.sol --rpc-url sepolia --account shuin-deployer --broadcast
contract Deploy is Script {
    bytes32 constant STORE_SALT = keccak256("shuin.store.v1");
    bytes32 constant FACTORY_SALT = keccak256("shuin.factory.v1");
    bytes32 constant OPEN_BOOK_SALT = keccak256("shuin.open-book.v1");

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        ShuinStore store = ShuinStore(vm.computeCreate2Address(STORE_SALT, keccak256(type(ShuinStore).creationCode)));
        if (address(store).code.length == 0) store = new ShuinStore{salt: STORE_SALT}();

        bytes memory factoryInit = abi.encodePacked(type(ShuinFactory).creationCode, abi.encode(store));
        ShuinFactory factory = ShuinFactory(vm.computeCreate2Address(FACTORY_SALT, keccak256(factoryInit)));
        if (address(factory).code.length == 0) factory = new ShuinFactory{salt: FACTORY_SALT}(store);

        address book = factory.predictAddress(deployer, OPEN_BOOK_SALT);
        if (book.code.length == 0) {
            ShuinCollection.Config memory c;
            c.publicMint = true;
            factory.createCollection(OPEN_BOOK_SALT, "Shuin Open Book", "SHUIN", "", deployer, 0, c);
        }
        vm.stopBroadcast();

        console.log("store    ", address(store));
        console.log("factory  ", address(factory));
        console.log("open book", book);
    }
}
