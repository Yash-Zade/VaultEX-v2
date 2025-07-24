// SPDX-License-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceFeed {
    function getLatestPrice() external view returns (int256);
    function getDecimals() external view returns (uint8);
}
