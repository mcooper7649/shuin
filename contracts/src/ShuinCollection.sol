// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721URIStorageUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ShuinCollection
/// @notice One collection = one seal book. Every token carries its own metadata URI.
/// Deployed as an ERC-1167 clone by ShuinFactory, so it is initialized rather than constructed.
contract ShuinCollection is ERC721URIStorageUpgradeable, ERC2981Upgradeable, OwnableUpgradeable {
    struct Config {
        uint64 maxSupply; // 0 = unlimited
        uint64 mintStart; // unix seconds, 0 = immediately
        uint64 mintEnd; // unix seconds, 0 = never closes
        uint128 price; // in native wei, per token
        bool publicMint; // false = only the owner can mint
        bool soulbound; // ERC-5192: tokens can never be transferred
        bytes32 allowlistRoot; // 0 = no allowlist; leaf = keccak256(bytes.concat(keccak256(abi.encode(minter))))
    }

    /// ERC-5192
    event Locked(uint256 tokenId);

    event Sealed(address indexed minter, address indexed to, uint256 indexed tokenId, string uri);
    event ConfigUpdated(Config config);
    event ContractURIUpdated();

    error MintClosed();
    error SoldOut();
    error WrongPrice(uint256 expected);
    error NotAllowlisted();
    error OwnerOnlyMint();
    error Soulbound();
    error EmptyURI();
    error WithdrawFailed();

    Config public config;
    uint256 public totalMinted;
    string private _contractURI;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata contractURI_,
        address owner_,
        address royaltyReceiver,
        uint96 royaltyBps,
        Config calldata config_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __ERC721URIStorage_init();
        __ERC2981_init();
        __Ownable_init(owner_);
        if (royaltyBps > 0) _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        _contractURI = contractURI_;
        config = config_;
    }

    // ───────────────────────────── minting ─────────────────────────────

    /// @notice Public mint: pays `price`, respects the window, supply cap and allowlist.
    function mint(address to, string calldata uri, bytes32[] calldata proof) external payable returns (uint256) {
        Config memory c = config;
        if (!c.publicMint && msg.sender != owner()) revert OwnerOnlyMint();
        if (c.mintStart != 0 && block.timestamp < c.mintStart) revert MintClosed();
        if (c.mintEnd != 0 && block.timestamp > c.mintEnd) revert MintClosed();
        if (msg.value != c.price) revert WrongPrice(c.price);
        if (c.allowlistRoot != bytes32(0)) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
            if (!MerkleProof.verifyCalldata(proof, c.allowlistRoot, leaf)) revert NotAllowlisted();
        }
        return _seal(to, uri);
    }

    /// @notice Owner mint: free, ignores window/allowlist, still respects the supply cap.
    function ownerMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        return _seal(to, uri);
    }

    function _seal(address to, string calldata uri) internal returns (uint256 tokenId) {
        if (bytes(uri).length == 0) revert EmptyURI();
        uint64 cap = config.maxSupply;
        if (cap != 0 && totalMinted >= cap) revert SoldOut();
        tokenId = ++totalMinted;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        if (config.soulbound) emit Locked(tokenId);
        emit Sealed(msg.sender, to, tokenId, uri);
    }

    // ───────────────────────────── owner admin ─────────────────────────────

    /// @notice Update a token's metadata (emits ERC-4906 MetadataUpdate).
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _requireOwned(tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// @notice Mint settings can change, but soulbound is fixed at creation so holders can trust it.
    function setConfig(Config calldata config_) external onlyOwner {
        bool wasSoulbound = config.soulbound;
        config = config_;
        config.soulbound = wasSoulbound;
        emit ConfigUpdated(config);
    }

    function setContractURI(string calldata uri) external onlyOwner {
        _contractURI = uri;
        emit ContractURIUpdated();
    }

    function setDefaultRoyalty(address receiver, uint96 bps) external onlyOwner {
        _setDefaultRoyalty(receiver, bps);
    }

    function withdraw(address payable to) external onlyOwner {
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    // ───────────────────────────── views ─────────────────────────────

    /// @notice Collection-level metadata (OpenSea contractURI standard / ERC-7572).
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /// ERC-5192
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return config.soulbound;
    }

    // ───────────────────────────── overrides ─────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (config.soulbound && from != address(0) && to != address(0)) revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorageUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return interfaceId == 0xb45a3c0e // ERC-5192
            || super.supportsInterface(interfaceId);
    }
}
