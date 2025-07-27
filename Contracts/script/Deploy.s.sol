// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/core/Vault.sol";
import "../src/core/VirtualAMM.sol";
import "../src/core/PositionManager.sol";
import "../src/tokens/PositionNFT.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        vm.stopBroadcast();
    }
}