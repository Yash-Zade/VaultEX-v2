// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PositionNFT is ERC721, Ownable, ReentrancyGuard {
    // Struct to hold position details
    struct PositionMetadata {
        uint256 tokenId;
        uint8 leverage;
        uint256 collateral;
        uint256 entryPrice;
        uint256 entryTimestamp;
        bool isLong;
        string symbol;
    }

    // Mapping from token ID to position data
    mapping(uint256 => PositionMetadata) public positionMetadata;

    // Mapping from user address to owned token IDs
    mapping(address => uint256[]) private _userTokens;

    // Position manager contract address
    address public positionManager;

    // Base URI for metadata
    string private _baseTokenURI;

    // Token ID counter
    uint256 private _tokenIdCounter;

    // Events
    event PositionMinted(uint256 indexed tokenId, address indexed user, uint256 leverage, uint256 collateral, bool isLong);
    event PositionBurned(uint256 indexed tokenId);
    event PositionUpdated(uint256 indexed tokenId, uint8 leverage, uint256 collateral);

    // Restrict to position manager
    modifier onlyPositionManager() {
        require(msg.sender == positionManager, "Only PositionManager");
        _;
    }

    // Constructor sets base URI and initializes token ID counter
    constructor(string memory baseURI) ERC721("Perpetual Position", "PERP-POS") Ownable(msg.sender) {
        _baseTokenURI = baseURI;
        _tokenIdCounter = 1;
    }

    // Set the address of the position manager
    function setPositionManager(address _positionManager) external onlyOwner {
        require(_positionManager != address(0), "Invalid address");
        positionManager = _positionManager;
    }

    // Mint a new position NFT
    function mintPosition(address to, uint256 collateral, uint8 leverage, uint256 entryPrice, bool isLong) external onlyPositionManager nonReentrant returns (uint256) {
        require(to != address(0), "Invalid user address");
        require(leverage > 0, "leverage must be > 0");
        require(collateral > 0, "Collateral must be > 0");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);

        positionMetadata[tokenId] = PositionMetadata({
            tokenId: tokenId,
            leverage: leverage,
            collateral: collateral,
            entryPrice: entryPrice,
            entryTimestamp: block.timestamp,
            isLong: isLong,
            symbol: isLong ? "vETH-LONG" : "vETH-SHORT"
        });

        _userTokens[to].push(tokenId);

        emit PositionMinted(tokenId, to, leverage, collateral, isLong);
        return tokenId;
    }

    // Burn a position NFT
    function burnPosition(uint256 tokenId) external onlyPositionManager nonReentrant {
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "Position does not exist");

        delete positionMetadata[tokenId];
        _burn(tokenId);

        // Remove token from user's list
        uint256[] storage tokens = _userTokens[owner];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }

        emit PositionBurned(tokenId);
    }

    // Update size and collateral of an existing position
    function updatePosition(uint256 tokenId, uint8 newLeverage, uint256 newCollateral) external onlyPositionManager {
        require(_ownerOf(tokenId) != address(0), "Position does not exist");

        PositionMetadata storage pos = positionMetadata[tokenId];
        pos.leverage = newLeverage;
        pos.collateral = newCollateral;

        emit PositionUpdated(tokenId, newLeverage, newCollateral);
    }

    // View details of a specific position
    function getPosition(uint256 tokenId) external view returns (uint256, uint256, uint8, uint256, uint256, bool, string memory) {
        require(_ownerOf(tokenId) != address(0), "Position does not exist");
        PositionMetadata memory pos = positionMetadata[tokenId];
        return (pos.tokenId, pos.collateral, pos.leverage, pos.entryPrice, pos.entryTimestamp, pos.isLong, pos.symbol);
    }

    // Get list of position token IDs owned by a user
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userTokens[user];
    }

    // Set base URI for token metadata
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // Return base URI (used by tokenURI)
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Return full token URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Position does not exist");
        return string(abi.encodePacked(_baseURI(), Strings.toString(tokenId), ".json"));
    }

    // Prevent transfers; only mint and burn allowed
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "Positions are non-transferable");
        return super._update(to, tokenId, auth);
    }
}
