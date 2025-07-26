// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Vault.sol";
import "../src/tokens/VUSDTToken.sol"; // Adjust path if needed

contract VaultLockLogicTest is Test {
    Vault vault;
    VUSDTToken vusdt;

    address user = address(0xABCD);
    address positionManager = address(0xDEAD);

    function setUp() public {
        vusdt = new VUSDTToken();
        vault = new Vault(address(vusdt));
        vault.setPositionManager(positionManager);

        vm.prank(address(this));
        vusdt.mint(user, 1_000e6);

        vm.prank(user);
        vusdt.approve(address(vault), type(uint256).max);

        vm.prank(user);
        vault.depositCollateral(500e6); // ensure prank wraps the actual call
    }

    function testLockCollateral() public {

        vm.prank(positionManager);
        vault.lockCollateral(user, 200e6);

        vm.prank(user);
        Vault.UserData memory data = vault.getUserCollateral();
        assertEq(data.availableBalance, 300e6);
        assertEq(data.lockedBalance, 200e6);
    }

    function testUnlockCollateral() public {
        vm.prank(positionManager);
        vault.lockCollateral(user, 200e6);

        vm.prank(positionManager);
        vault.unlockCollateral(user, 50e6);

        vm.prank(user);
        Vault.UserData memory data = vault.getUserCollateral();
        assertEq(data.lockedBalance, 150e6);
        assertEq(data.availableBalance, 350e6);
    }

    function testUtilizationRateUpdatesCorrectly() public {
        vm.prank(positionManager);
        vault.lockCollateral(user, 400e6); // 400/500 = 80%

        uint256 rate = vault.getUtilizationRate();
        assertEq(rate, 8000);
    }

    function test_RevertWhenLockExceedsAvailable() public {
        vm.prank(positionManager);
        vm.expectRevert("Insufficient available balance");
        vault.lockCollateral(user, 600e6);
    }

    function test_RevertWhenLockExceedsUtilization() public {
        vm.prank(positionManager);
        vm.expectRevert("Exceeds max utilization");
        vault.lockCollateral(user, 450e6); // Would exceed 80%
    }

    function test_RevertUnlockTooMuch() public {
        vm.prank(positionManager);
        vault.lockCollateral(user, 200e6);

        vm.prank(positionManager);
        vm.expectRevert("Insufficient locked balance to unlock");
        vault.unlockCollateral(user, 300e6);
    }

    function test_RevertLockFromNonManager() public {
        vm.expectRevert("Only Position manager can access");
        vault.lockCollateral(user, 100e6);
    }

    function test_RevertUnlockFromNonManager() public {
        vm.expectRevert("Only Position manager can access");
        vault.unlockCollateral(user, 100e6);
    }
}
