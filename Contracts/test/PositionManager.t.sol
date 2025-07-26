// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/PositionManager.sol";
import "../src/interfaces/IPriceFeed.sol";
import "../src/interfaces/IPositionNFT.sol";
import "../src/interfaces/IVirtualAMM.sol";
import "../src/interfaces/IVault.sol";

// --- Mocks ---

contract MockFeed is IPriceFeed {
    function getLatestPrice() external pure override returns (int256) {
        return 2000e8;
    }
    function getDecimals() external pure override returns (uint8) {
        return 8;
    }
}

contract MockAMM is IVirtualAMM {
    address public manager;
    function updateReserve(uint256, bool) external override {}
    function getCurrentPrice() external pure override returns (uint256, bool) {
        return (2100e8, true);
    }
    function calculateFundingRate() external pure override returns (int256) {
        return 75;
    }
    function setPositionManager(address _manager) external override {
        manager = _manager;
    }
    function setInitialPrice() external override {}
}

contract MockVault is IVault {
    function lockCollateral(address, uint256) external override {}
    function unlockCollateral(address, uint256) external override {}
    function transferCollateral(address, uint256) external override {}
    function depositCollateral(uint256) external override {}
    function withdrawCollateral(uint256) external override {}
    function setPositionManager(address) external override {}
    function getTotalLiquidity() external pure override returns (uint256) { return 0; }
    function getUserCollateral() external pure override returns (UserData memory) {
        return UserData({ depositedBalance: 0, lockedBalance: 0, availableBalance: 0 });
    }
    function getUtilizationRate() external pure override returns (uint256) { return 0; }
}

contract MockNFT is IPositionNFT {
    address public owner = address(this);

    function setOwner(address _owner) external {
        owner = _owner;
    }

    function mintPosition(address, uint256, uint8, uint256, int256, bool) external override pure returns (uint256) {
        return 1;
    }

    function burnPosition(uint256) external override {}

    function getPosition(uint256) external pure override  returns (uint256 collateral, uint256 positionSize, uint8 leverage, uint256 entryPrice, uint256 exitPrice, int256 entryFundingRate, bool isLong,string memory metadata) {
        return (1000e8, 1000e8, 10, 2000e8, 0, 25, true, "");
    }

    function ownerOf(uint256) external view override returns (address) {
        return owner;
    }

    function updatePosition(uint256, uint256, uint256) external override {}
    function getUserPositions(address) external pure override returns (uint256[] memory) {
        uint256[] memory dummy = new uint256[](1);
        dummy[0] = 1;
        return dummy;
    }
}

// --- Tests ---

contract PositionManagerTest is Test {
    PositionManager pm;
    MockNFT mockNFT;

    function setUp() public {
        mockNFT = new MockNFT();
        pm = new PositionManager(
            address(new MockFeed()),
            address(mockNFT),
            address(new MockAMM()),
            address(new MockVault())
        );
    }

    function testOpenPosition() public {
        pm.openPosition(1000e8, 10, true);
    }

    function testClosePosition() public {
        pm.openPosition(1000e8, 10, true);
        mockNFT.setOwner(address(this));
        pm.closePosition(1, 1000e8);
    }

    function testUpdateFundingRate() public {
        vm.warp(block.timestamp + 9 hours);
        pm.updateFundingRate();
        assertEq(pm.fundingRateAccumulated(), 75);
    }

    function testOpenReverts() public {
        vm.expectRevert("Collateral cannot be zero");
        pm.openPosition(0, 10, true);

        vm.expectRevert("Invalid leverage");
        pm.openPosition(1000e8, 100, true);

        pm.openPosition(1000e8, 10, true);
        vm.expectRevert("Position already open");
        pm.openPosition(500e8, 10, true);
    }

    function testCloseRevert_NotOwner() public {
        vm.expectRevert("Not position owner");
        pm.closePosition(99, 1000e8);
    }

    function testCloseRevert_CollateralDeltaTooLarge() public {
        pm.openPosition(1000e8, 10, true);
        mockNFT.setOwner(address(this));
        vm.expectRevert("collateral delta too large");
        pm.closePosition(1, 0);
    }

    function testFundingTooSoon() public {
        vm.expectRevert("Funding rate can only be updated every 8 hours");
        pm.updateFundingRate();
    }
}
