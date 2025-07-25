// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IVirtualAMM {

    // External functions
    function updateReserve(uint256 amount, bool isLong) external;
    function setPositionManager(address positionManager) external;
    function setInitialPrice() external;

    // View functions
    function getCurrentPrice() external view returns (uint256, bool);
    function calculateFundingRate() external view returns (int256);
}
