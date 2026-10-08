// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721URIStorageUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ShuinStore} from "./ShuinStore.sol";

/// @title ShuinCollection
/// @notice One collection = one seal book. Every token carries its own metadata, either as a
/// URI (IPFS etc.) or fully on-chain in ShuinStore, rendered by tokenURI as a data: URI.
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
    event SealedOnChain(uint256 indexed tokenId, bytes32 metaFile, bytes32 mediaFile);

    error MintClosed();
    error SoldOut();
    error WrongPrice(uint256 expected);
    error NotAllowlisted();
    error OwnerOnlyMint();
    error Soulbound();
    error EmptyURI();
    error WithdrawFailed();

    /// On-chain token: both parts live in ShuinStore. Metadata JSON has no image field;
    /// tokenURI splices the media in as a base64 data URI.
    struct OnChainToken {
        bytes32 metaFile;
        bytes32 mediaFile;
    }

    /// Shared by every clone (immutables live in the implementation's code).
    ShuinStore public immutable STORE;

    Config public config;
    uint256 public totalMinted;
    string private _contractURI;
    mapping(uint256 => OnChainToken) public onChainToken;

    constructor(ShuinStore store_) {
        STORE = store_;
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
        _checkMint(proof);
        return _seal(to, uri);
    }

    /// @notice Same rules as mint(), but the media and metadata are written on-chain to ShuinStore.
    /// @param metaJson Metadata JSON object without an image/animation_url field.
    /// @param chunks Media bytes split into pieces of at most ShuinStore.MAX_CHUNK bytes.
    function mintOnChain(
        address to,
        string calldata metaJson,
        string calldata mime,
        bytes[] calldata chunks,
        bytes32[] calldata proof
    ) external payable returns (uint256 tokenId) {
        _checkMint(proof);
        bytes[] memory metaChunks = new bytes[](1);
        metaChunks[0] = bytes(metaJson);
        OnChainToken memory t = OnChainToken({
            metaFile: STORE.store("application/json", metaChunks),
            mediaFile: STORE.store(mime, chunks)
        });
        tokenId = _mintNext(to);
        onChainToken[tokenId] = t;
        emit SealedOnChain(tokenId, t.metaFile, t.mediaFile);
        emit Sealed(msg.sender, to, tokenId, "");
    }

    function _checkMint(bytes32[] calldata proof) internal view {
        Config memory c = config;
        if (!c.publicMint && msg.sender != owner()) revert OwnerOnlyMint();
        if (c.mintStart != 0 && block.timestamp < c.mintStart) revert MintClosed();
        if (c.mintEnd != 0 && block.timestamp > c.mintEnd) revert MintClosed();
        if (msg.value != c.price) revert WrongPrice(c.price);
        if (c.allowlistRoot != bytes32(0)) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
            if (!MerkleProof.verifyCalldata(proof, c.allowlistRoot, leaf)) revert NotAllowlisted();
        }
    }

    /// @notice Owner mint: free, ignores window/allowlist, still respects the supply cap.
    function ownerMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        return _seal(to, uri);
    }

    function _seal(address to, string calldata uri) internal returns (uint256 tokenId) {
        if (bytes(uri).length == 0) revert EmptyURI();
        tokenId = _mintNext(to);
        _setTokenURI(tokenId, uri);
        emit Sealed(msg.sender, to, tokenId, uri);
    }

    function _mintNext(address to) internal returns (uint256 tokenId) {
        uint64 cap = config.maxSupply;
        if (cap != 0 && totalMinted >= cap) revert SoldOut();
        tokenId = ++totalMinted;
        _safeMint(to, tokenId);
        if (config.soulbound) emit Locked(tokenId);
    }

    // ───────────────────────────── owner admin ─────────────────────────────

    /// @notice Update a token's metadata (emits ERC-4906 MetadataUpdate). For an on-chain
    /// token this switches it to the given URI.
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _requireOwned(tokenId);
        delete onChainToken[tokenId];
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

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        OnChainToken memory t = onChainToken[tokenId];
        if (t.mediaFile == bytes32(0)) return super.tokenURI(tokenId);
        _requireOwned(tokenId);
        return _renderOnChain(t);
    }

    /// {...meta, "image"|"animation_url": "data:<mime>;base64,<media>"}, itself base64-encoded.
    function _renderOnChain(OnChainToken memory t) internal view returns (string memory) {
        bytes memory meta = STORE.read(t.metaFile);
        (string memory mime,,) = STORE.info(t.mediaFile);
        bytes memory head;
        if (meta.length > 2 && meta[meta.length - 1] == "}") {
            assembly {
                mstore(meta, sub(mload(meta), 1)) // drop the closing brace
            }
            head = bytes.concat(meta, ",");
        } else {
            head = "{";
        }
        string memory key = _startsWith(bytes(mime), "image/") ? "image" : "animation_url";
        bytes memory json = bytes.concat(
            head, '"', bytes(key), '":"data:', bytes(mime), ";base64,", bytes(Base64.encode(STORE.read(t.mediaFile))), '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function _startsWith(bytes memory s, bytes memory prefix) private pure returns (bool) {
        if (s.length < prefix.length) return false;
        for (uint256 i; i < prefix.length; ++i) {
            if (s[i] != prefix[i]) return false;
        }
        return true;
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
