// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    // Struct for user balances
    struct UserData {
        uint256 depositedBalance;
        uint256 lockedBalance;
        uint256 availableBalance;
    }

    // External functions
    function depositCollateral(uint256 _amount) external;
    function withdrawCollateral(uint256 _amount) external;
    function lockCollateral(address _user, uint256 _amount) external;
    function unlockCollateral(address _user, uint256 _amount) external;
    function transferCollateral(address _to, uint256 _amount) external;
    function setPositionManager(address _positionManager) external;
    function absorbLiquidatedCollateral(address _user, uint _amount) external;

    // View functions
    function getUserCollateral() external view returns (UserData memory);
    function getTotalLiquidity() external view returns (uint256);
    function getUtilizationRate() external view returns (uint256);
}