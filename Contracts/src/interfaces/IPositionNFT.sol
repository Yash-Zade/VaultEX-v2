// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IPositionNFT
 * @notice Interface for Position NFT contract that represents trading positions as NFTs
 */
interface IPositionNFT is IERC721 {
    
    /**
     * @notice Struct representing position metadata
     */
    struct PositionMetadata {
        uint256 tokenId;
        uint8 leverage;
        uint256 collateral;
        uint256 entryPrice;
        int256 entryFundingRate;
        uint256 entryTimestamp;
        bool isLong;
        bool isOpen;
        string symbol;
    }

    /**
     * @notice Events
     */
    event PositionMinted(
        uint256 indexed tokenId, 
        address indexed user, 
        uint256 leverage, 
        uint256 collateral, 
        bool isLong
    );
    
    event PositionBurned(uint256 indexed tokenId);
    
    event PositionUpdated(
        uint256 indexed tokenId, 
        uint8 leverage, 
        uint256 collateral
    );

    /**
     * @notice Mint a new position NFT
     * @param to Address to mint the NFT to
     * @param collateral Amount of collateral in the position
     * @param leverage Leverage multiplier (1-50)
     * @param entryPrice Entry price of the position
     * @param entryFundingRate Entry funding rate
     * @param isLong Whether this is a long or short position
     * @return tokenId The ID of the newly minted token
     */
    function mintPosition(
        address to,
        uint256 collateral,
        uint8 leverage,
        uint256 entryPrice,
        int256 entryFundingRate,
        bool isLong
    ) external returns (uint256 tokenId);

    /**
     * @notice Burn a position NFT
     * @param tokenId ID of the token to burn
     */
    function burnPosition(uint256 tokenId) external;

    /**
     * @notice Update position metadata (leverage and collateral)
     * @param tokenId ID of the position to update
     * @param newLeverage New leverage value
     * @param newCollateral New collateral amount
     */
    function updatePosition(
        uint256 tokenId,
        uint8 newLeverage,
        uint256 newCollateral
    ) external;

    /**
     * @notice Close a position (mark as closed without burning)
     * @param tokenId ID of the position to close
     */
    function closePosition(uint256 tokenId) external;

    /**
     * @notice Get detailed information about a position
     * @param tokenId ID of the position
     * @return tokenId Token ID
     * @return collateral Collateral amount
     * @return leverage Leverage multiplier
     * @return entryPrice Entry price
     * @return entryTimestamp Entry timestamp
     * @return entryFundingRate Entry funding rate
     * @return isLong Whether it's a long position
     * @return isOpen Whether the position is open
     * @return symbol Position symbol
     */
    function getPosition(uint256 tokenId) 
        external 
        view 
        returns (
            uint256, // tokenId
            uint256, // collateral
            uint8,   // leverage
            uint256, // entryPrice
            uint256, // entryTimestamp
            int256,  // entryFundingRate
            bool,    // isLong
            bool,    // isOpen
            string memory // symbol
        );

    /**
     * @notice Get all position token IDs owned by a user
     * @param user Address of the user
     * @return Array of token IDs
     */
    function getUserPositions(address user) external view returns (uint256[] memory);

    /**
     * @notice Get only open position token IDs owned by a user
     * @param user Address of the user
     * @return Array of open position token IDs
     */
    function getUserOpenPositions(address user) external view returns (uint256[] memory);

    /**
     * @notice Check if a position exists and is open
     * @param tokenId ID of the position
     * @return True if position exists and is open
     */
    function isPositionOpen(uint256 tokenId) external view returns (bool);

    /**
     * @notice Set the position manager contract address (only owner)
     * @param _positionManager Address of the position manager contract
     */
    function setPositionManager(address _positionManager) external;

    /**
     * @notice Set base URI for token metadata (only owner)
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external;

    /**
     * @notice Get position manager address
     * @return Address of the position manager
     */
    function positionManager() external view returns (address);

    /**
     * @notice Get position metadata for a token
     * @param tokenId ID of the position
     * @return PositionMetadata struct
     */
    function positionMetadata(uint256 tokenId) external view returns (PositionMetadata memory);
}