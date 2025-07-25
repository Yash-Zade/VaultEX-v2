// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPositionNFT {
    
    // Struct to store position details
    struct PositionMetadata {
        uint256 tokenId;
        uint256 collateral;
        uint8 leverage;
        uint256 entryPrice;
        uint256 entryTimestamp;
        bool isLong;
        string symbol;
    }

    // External functions
    function mintPosition(address to, uint256 collateral, uint8 leverage, uint256 entryPrice, bool isLong) external returns (uint256);
    function burnPosition(uint256 tokenId) external;
    function updatePosition(uint256 tokenId, uint256 newSize, uint256 newCollateral) external;

    // View functions
    function getPosition(uint256 tokenId) external view returns (uint256, uint256, uint8, uint256, uint256, bool, string memory);
    function getUserPositions(address user) external view returns (uint256[] memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}
