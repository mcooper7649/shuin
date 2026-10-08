// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ShuinFactory} from "../src/ShuinFactory.sol";
import {ShuinCollection} from "../src/ShuinCollection.sol";

contract ShuinTest is Test {
    ShuinFactory factory;
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        factory = new ShuinFactory();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _config() internal pure returns (ShuinCollection.Config memory c) {
        c.publicMint = true;
    }

    function _create(ShuinCollection.Config memory c) internal returns (ShuinCollection) {
        vm.prank(creator);
        return ShuinCollection(
            factory.createCollection(bytes32("s1"), "Seals", "SEAL", "ipfs://contract", creator, 500, c)
        );
    }

    function test_createIsDeterministicAndOwned() public {
        address predicted = factory.predictAddress(creator, bytes32("s1"));
        ShuinCollection col = _create(_config());
        assertEq(address(col), predicted);
        assertEq(col.owner(), creator);
        assertEq(col.name(), "Seals");
        assertEq(col.contractURI(), "ipfs://contract");
        (address r, uint256 amt) = col.royaltyInfo(1, 10_000);
        assertEq(r, creator);
        assertEq(amt, 500);
    }

    function test_cannotReinitialize() public {
        ShuinCollection col = _create(_config());
        vm.expectRevert();
        col.initialize("x", "x", "", alice, alice, 0, _config());
    }

    function test_implementationIsLocked() public {
        ShuinCollection impl = ShuinCollection(factory.implementation());
        vm.expectRevert();
        impl.initialize("x", "x", "", alice, alice, 0, _config());
    }

    function test_publicMint() public {
        ShuinCollection col = _create(_config());
        vm.prank(alice);
        uint256 id = col.mint(alice, "ipfs://a", new bytes32[](0));
        assertEq(id, 1);
        assertEq(col.ownerOf(1), alice);
        assertEq(col.tokenURI(1), "ipfs://a");
    }

    function test_emptyUriReverts() public {
        ShuinCollection col = _create(_config());
        vm.prank(alice);
        vm.expectRevert(ShuinCollection.EmptyURI.selector);
        col.mint(alice, "", new bytes32[](0));
    }

    function test_ownerOnlyMint() public {
        ShuinCollection.Config memory c = _config();
        c.publicMint = false;
        ShuinCollection col = _create(c);
        vm.prank(alice);
        vm.expectRevert(ShuinCollection.OwnerOnlyMint.selector);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.prank(creator);
        col.ownerMint(bob, "ipfs://b");
        assertEq(col.ownerOf(1), bob);
    }

    function test_priceAndWithdraw() public {
        ShuinCollection.Config memory c = _config();
        c.price = 0.01 ether;
        ShuinCollection col = _create(c);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ShuinCollection.WrongPrice.selector, 0.01 ether));
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.prank(alice);
        col.mint{value: 0.01 ether}(alice, "ipfs://a", new bytes32[](0));

        uint256 before = creator.balance;
        vm.prank(creator);
        col.withdraw(payable(creator));
        assertEq(creator.balance - before, 0.01 ether);
    }

    function test_supplyCap() public {
        ShuinCollection.Config memory c = _config();
        c.maxSupply = 1;
        ShuinCollection col = _create(c);
        vm.prank(alice);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.prank(bob);
        vm.expectRevert(ShuinCollection.SoldOut.selector);
        col.mint(bob, "ipfs://b", new bytes32[](0));
    }

    function test_mintWindow() public {
        ShuinCollection.Config memory c = _config();
        c.mintStart = uint64(block.timestamp + 1 days);
        c.mintEnd = uint64(block.timestamp + 2 days);
        ShuinCollection col = _create(c);
        vm.prank(alice);
        vm.expectRevert(ShuinCollection.MintClosed.selector);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(alice);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(ShuinCollection.MintClosed.selector);
        col.mint(alice, "ipfs://b", new bytes32[](0));
    }

    function _leaf(address a) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a))));
    }

    function test_allowlist() public {
        // Two-leaf tree: root = hash of the sorted pair.
        bytes32 la = _leaf(alice);
        bytes32 lb = _leaf(bob);
        bytes32 root = la < lb ? keccak256(abi.encode(la, lb)) : keccak256(abi.encode(lb, la));
        ShuinCollection.Config memory c = _config();
        c.allowlistRoot = root;
        ShuinCollection col = _create(c);

        bytes32[] memory proofA = new bytes32[](1);
        proofA[0] = lb;
        vm.prank(alice);
        col.mint(alice, "ipfs://a", proofA);

        address eve = makeAddr("eve");
        vm.prank(eve);
        vm.expectRevert(ShuinCollection.NotAllowlisted.selector);
        col.mint(eve, "ipfs://e", proofA);
    }

    function test_soulbound() public {
        ShuinCollection.Config memory c = _config();
        c.soulbound = true;
        ShuinCollection col = _create(c);
        vm.prank(alice);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        assertTrue(col.locked(1));
        assertTrue(col.supportsInterface(0xb45a3c0e));
        vm.prank(alice);
        vm.expectRevert(ShuinCollection.Soulbound.selector);
        col.transferFrom(alice, bob, 1);

        // soulbound can't be switched off afterwards
        c.soulbound = false;
        vm.prank(creator);
        col.setConfig(c);
        (,,,,, bool sb,) = col.config();
        assertTrue(sb);
    }

    function test_transferWhenNotSoulbound() public {
        ShuinCollection col = _create(_config());
        vm.prank(alice);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        assertFalse(col.locked(1));
        vm.prank(alice);
        col.transferFrom(alice, bob, 1);
        assertEq(col.ownerOf(1), bob);
    }

    function test_updateTokenUri() public {
        ShuinCollection col = _create(_config());
        vm.prank(alice);
        col.mint(alice, "ipfs://a", new bytes32[](0));
        vm.prank(alice);
        vm.expectRevert();
        col.setTokenURI(1, "ipfs://hacked");
        vm.prank(creator);
        col.setTokenURI(1, "ipfs://v2");
        assertEq(col.tokenURI(1), "ipfs://v2");
    }

    function test_interfaces() public {
        ShuinCollection col = _create(_config());
        assertTrue(col.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(col.supportsInterface(0x2a55205a)); // ERC-2981
        assertTrue(col.supportsInterface(0x49064906)); // ERC-4906
    }
}
