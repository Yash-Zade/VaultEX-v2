// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPriceFeed {
    function getLatestPrice() external view returns (int256);
    function getDecimals() external view returns (uint8);
    function setAggregator(address _aggregator) external;
}
