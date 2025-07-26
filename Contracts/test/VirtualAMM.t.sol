// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "../src/core/VirtualAMM.sol";
import "../src/core/PriceFeed.sol";

contract MockAggregator is AggregatorV3Interface {
    function latestRoundData() external pure override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (0, 2000e8, 0, 0, 0);
    }

    function decimals() external pure override returns (uint8) {
        return 8;
    }

    function description() external pure override returns (string memory) {
        return "MockAggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external pure override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        revert("not implemented");
    }
}

contract VirtualAMMTest is Test {
    VirtualAMM amm;
    PriceFeed priceFeed;

    address owner = address(this);
    address positionManager = address(0xDEAD);

    function setUp() public {
        MockAggregator mock = new MockAggregator();
        priceFeed = new PriceFeed(address(mock));

        amm = new VirtualAMM(1000e8, 2000e8, address(priceFeed));
        amm.setPositionManager(positionManager);
    }

    function testGetCurrentPrice() public {
        (uint256 price, bool valid) = amm.getCurrentPrice();
        assertTrue(valid);
        assertEq(price, 200000000); // 2000e8 / 1000e8 * 1e8 = 200e8
    }

    function testUpdateReserveLong() public {
        vm.prank(positionManager);
        amm.updateReserve(100e8, true);

        (uint256 price, ) = amm.getCurrentPrice();
        assertGt(price, 200000000); // vETH down, vUSDT up → price increases
    }

    function testUpdateReserveShort() public {
        vm.prank(positionManager);
        amm.updateReserve(100e8, false);

        (uint256 price, ) = amm.getCurrentPrice();
        assertLt(price, 200000000); // vETH up, vUSDT down → price decreases
    }

    function testCalculateFundingRate() public {
        vm.prank(positionManager);
        int256 rate = amm.calculateFundingRate();

        // Assuming Chainlink price = 200e8, and vAMM price ≈ 200e8
        assertLe(rate, 500);
        assertGe(rate, -500);
    }

    function testSetInitialPrice() public {
        amm.setInitialPrice();

        (uint256 price, bool valid) = amm.getCurrentPrice();
        assertTrue(valid);
        assertGt(price, 0);
    }

    function test_RevertUpdateReserveFromNonManager() public {
        vm.expectRevert("Only Position manager can access");
        amm.updateReserve(100e8, true);
    }

    function test_RevertFundingRateFromNonManager() public {
        vm.expectRevert("Only Position manager can access");
        amm.calculateFundingRate();
    }

    function test_RevertInvalidAmountUpdateReserve() public {
        vm.prank(positionManager);
        vm.expectRevert("Amount should be greater than 0");
        amm.updateReserve(0, true);
    }

    function test_RevertSetPositionManagerToZero() public {
        vm.expectRevert("Invalid address");
        amm.setPositionManager(address(0));
    }
}
