// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vault is Ownable {

    // User balances for deposit, locked, and available
    struct UserData {
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
    constructor(address _vUSDT, uint _initialSupply) Ownable(msg.sender) {
        vUSDT = IERC20(_vUSDT);
        totalDeposits += _initialSupply;
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

        userData[msg.sender].availableBalance += _amount;

        totalDeposits += _amount;

        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;

        emit CollateralDeposited(msg.sender, _amount);
    }

    // Withdraw available collateral
    function withdrawCollateral(uint _amount) external {
        require(_amount > 0, "Amount should be greater than 0");
        require(userData[msg.sender].availableBalance >= _amount, "Insufficient available balance");

        userData[msg.sender].availableBalance -= _amount;
        totalDeposits -= _amount;

        require(vUSDT.transfer(msg.sender, _amount), "Transfer failed");

        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;

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

        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;

        emit CollateralLocked(_user, _amount);
    }

    // Unlock previously locked collateral
    function unlockCollateral(address _user, uint _amount) external onlyPositionManager() {
        require(_amount > 0, "Amount should be greater than 0");
        require(userData[_user].lockedBalance >= _amount, "Insufficient locked balance to unlock");

        userData[_user].lockedBalance -= _amount;
        totalLocked -= _amount;
        userData[_user].availableBalance += _amount;

        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;

        emit CollateralUnlocked(_user, _amount);
    }

    //Pays profit to the user
    function payOutProfit(address _user, uint _amount) external onlyPositionManager {
        require(_user != address(0), "Invalid User");
        require(_amount != 0, "Invalid amount to pay out profit");
        require(_amount <= totalDeposits, "Insufficient fund to pay out");
        totalDeposits -= _amount;
        userData[_user].availableBalance += _amount;
        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;
    }

    //Absorb loss from the user
    function absorbLoss(address _user, uint _amount) external onlyPositionManager {
        require(_user != address(0), "Invalid User");
        require(_amount != 0, "Invalid amount to absorb out profit");
        require(userData[_user].availableBalance >= _amount, "Infufficient funds");
        totalDeposits += _amount;
        userData[_user].availableBalance -= _amount;
        utilizationRate = totalDeposits == 0? 0: (totalLocked * 10000) / totalDeposits;
    }

    // Get caller's balances
    function getUserCollateral() external view returns(UserData memory) {
        return userData[msg.sender];
    }

    function getVaultAssets() external view returns(uint, uint, uint){
        return(totalDeposits, totalLocked, utilizationRate);
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
