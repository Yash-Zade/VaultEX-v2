// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vault is Ownable {

    // User balances for deposit, locked, and available
    struct UserData {
        uint depositedBalance;
        uint lockedBalance;
        uint availableBalance;
    }

    mapping (address => UserData) userData;

    // Global stats
    uint totalDeposits;
    uint totalLocked;
    uint utilizationRate;
    uint maxUtilization = 8000; // 80%

    address positionManager;
    IERC20 immutable vUSDT; // Collateral token

    // Events
    event CollateralDeposited(address indexed user, uint amount);
    event CollateralWithdrawn(address indexed user, uint amount);
    event CollateralLocked(address indexed user, uint amount);
    event CollateralUnlocked(address indexed user, uint amount);
    event CollateralTransferred(address indexed from, address indexed to, uint amount);

    // Only position manager can call certain functions
    modifier onlyPositionManager() {
        require(positionManager == msg.sender, "Only Position manager can access");
        _;
    }

    // Set token address during deployment
    constructor(address _vUSDT) Ownable(msg.sender) {
        vUSDT = IERC20(_vUSDT);
    }

    // Set position manager address
    function setPositionManager(address _positionManager) external onlyOwner() {
        require(_positionManager != address(0), "Invalid address");
        positionManager = _positionManager;
    }

    // Deposit collateral into the vault
    function depositCollateral(uint _amount) external {
        require(_amount > 0, "Amount should be greater than 0");
        require(vUSDT.allowance(msg.sender, address(this)) >= _amount);
        require(vUSDT.transferFrom(msg.sender, address(this), _amount), "Unable to transfer");

        userData[msg.sender].depositedBalance += _amount;
        userData[msg.sender].availableBalance += _amount;

        totalDeposits += _amount;

        emit CollateralDeposited(msg.sender, _amount);
    }

    // Withdraw available collateral
    function withdrawCollateral(uint _amount) external {
        require(_amount > 0, "Amount should be greater than 0");
        require(userData[msg.sender].availableBalance >= _amount, "Insufficient available balance");

        userData[msg.sender].availableBalance -= _amount;
        userData[msg.sender].depositedBalance -= _amount;

        totalDeposits -= _amount;

        require(vUSDT.transfer(msg.sender, _amount), "Transfer failed");

        emit CollateralWithdrawn(msg.sender, _amount);
    }

    // Lock collateral for a user
    function lockCollateral(address _user, uint _amount) external onlyPositionManager() {
        require(_amount > 0, "Amount should be greater than 0");
        require(userData[_user].availableBalance >= _amount, "Insufficient available balance");
        require((((totalLocked + _amount) * 10000) / totalDeposits) <= maxUtilization, "Exceeds max utilization");

        userData[_user].availableBalance -= _amount;
        userData[_user].lockedBalance += _amount;

        totalLocked += _amount;

        utilizationRate = (totalLocked * 10000) / totalDeposits;

        emit CollateralLocked(_user, _amount);
    }

    // Unlock previously locked collateral
    function unlockCollateral(address _user, uint _amount) external onlyPositionManager() {
        require(_amount > 0, "Amount should be greater than 0");
        require(userData[_user].lockedBalance >= _amount, "Insufficient locked balance to unlock");

        userData[_user].lockedBalance -= _amount;
        totalLocked -= _amount;
        userData[_user].availableBalance += _amount;

        utilizationRate = (totalLocked * 10000) / totalDeposits;

        emit CollateralUnlocked(_user, _amount);
    }

    // Transfer locked collateral from contract to user
    function transferCollateral(address _to, uint _amount) external onlyPositionManager() {
        require(_amount > 0, "Amount should be greater than 0");
        require(totalLocked >= _amount, "Insufficient locked balance to unlock");

        totalLocked -= _amount;
        userData[_to].availableBalance += _amount;

        utilizationRate = (totalLocked * 10000) / totalDeposits;

        emit CollateralTransferred(address(this), _to, _amount);
    }

    // Called when a user's position is liquidated
    function absorbLiquidatedCollateral(address _user, uint _amount) external onlyPositionManager {
        require(_amount > 0, "Amount must be greater than 0");
        require(userData[_user].lockedBalance >= _amount, "Insufficient locked balance");

        userData[_user].lockedBalance -= _amount;
        totalLocked -= _amount;

        utilizationRate = (totalLocked * 10000) / totalDeposits;

        emit CollateralTransferred(_user, address(this), _amount);
    }


    // Get caller's balances
    function getUserCollateral() external view returns(UserData memory) {
        return userData[msg.sender];
    }

    // Get total deposits in vault
    function getTotalLiquidity() external view returns(uint) {
        return totalDeposits;
    }

    // Get current utilization rate (0–10000 for 0–100%)
    function getUtilizationRate() external view returns (uint256) {
        return utilizationRate;
    }

    // Fallback function - handles unknown calls
    fallback() external{
        revert("Incorrect function call");
    }

    // Receive function - handles plain ETH transfers
    receive() external payable {
        revert("Contract does not accept ETH");
    }

}
