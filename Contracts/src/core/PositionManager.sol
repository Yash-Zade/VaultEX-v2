// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IPositionNFT.sol";
import "../interfaces/IVirtualAMM.sol";
import "../interfaces/IVault.sol";

contract PositionManager is ReentrancyGuard, Ownable {

    uint constant MAX_LEVERAGE = 50;
    uint256 constant TRADING_FEES = 50;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 500; // 5%
    uint256 public constant FUNDING_INTERVAL = 8 hours;


    uint public totalLong;
    uint public totalShort;
    uint public totalLongCollateral;
    uint public totalShortCollateral;
    int public fundingRateAccumulated;
    bool public emergencyPause;

    uint public lastFundingTime;

    IPositionNFT public positionNFT;
    IVirtualAMM public virtualAMM;
    IVault public vault;


    struct Position {
        address user;
        uint256 collateral;
        uint256 entryPrice;
        uint256 exitPrice;
        uint256 positionSize;
        int256 entryFundingRate;
        uint8 leverage;
        bool isLong;
        bool isOpen;
    }

    mapping (address => Position) positions;

    modifier whenNotPaused() {
        require(!emergencyPause, "Contract paused");
        _;
    }

    event FundingRateUpdated(int256 fundingRateBps, int256 accumulated);
    event PositionOpened(uint256 indexed tokenId, address user, uint256 collateraal, uint256 entryPrice, uint8 leverage, int256 entryFundingRate, bool isLong);
    event PositionClosed(uint256 indexed tokenId, address indexed user, int256 pnl, int256 fundingPayment, uint256 fees);
    event PositionLiquidated(uint256 indexed tokenId, address indexed user);
    event EmergencyPauseToggled(bool paused);

    constructor(address _positionNFT, address _virtualAMM, address _vault ) Ownable(msg.sender){
        positionNFT = IPositionNFT(_positionNFT);
        virtualAMM = IVirtualAMM(_virtualAMM);
        vault = IVault(_vault);
    }

    function openPosition(uint _collateral, uint8 _leverage, bool _isLong) external nonReentrant {
    
        require(_collateral > 0, "Collateral cannot be zero");
        require(_leverage > 0 && _leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(!positions[msg.sender].isOpen, "Position already open");

        vault.lockCollateral(msg.sender, _collateral);
        uint amount = _collateral * _leverage;
        (uint256 entryPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        positions[msg.sender] = Position({
            user: msg.sender,
            collateral: _collateral,
            entryPrice: entryPrice,
            exitPrice: 0,
            positionSize: amount,
            entryFundingRate: fundingRateAccumulated,
            leverage: _leverage,
            isLong: _isLong,
            isOpen: true
        });

        if (_isLong) {
            totalLong += (amount);
            totalLongCollateral += _collateral;
        } else {
            totalShort += (amount);
            totalShortCollateral += _collateral;
        }

         // record NFT for open position
        uint256 tokenId = positionNFT.mintPosition(msg.sender, _collateral, _leverage, entryPrice, fundingRateAccumulated, _isLong);

        virtualAMM.updateReserve(amount, _isLong);

        emit PositionOpened(tokenId, msg.sender, _collateral, entryPrice, _leverage, fundingRateAccumulated, _isLong);

    }

    function closePosition(uint256 tokenId) external nonReentrant whenNotPaused {
        (uint256 collateral, uint8 leverage, uint256 entryPrice, int256 entryFundingRate, bool isLong) = _getPositionData(tokenId);
        require(positionNFT.ownerOf(tokenId) == msg.sender, "Not position owner");

        (uint256 currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        uint256 amount = collateral * leverage;
        uint256 fees = (collateral * TRADING_FEES) / 1e6;
        
        int256 pnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int256 fundingPayment = _calculateFundingPayment(isLong, collateral, entryFundingRate);
        int256 settlementAmount = pnl + fundingPayment - int256(fees);


        if (isLong) {
            totalLong -= amount;
            totalLongCollateral -= collateral;
        } else {
            totalShort -= amount;
            totalShortCollateral -= collateral;
        }

        positionNFT.burnPosition(tokenId);
        vault.unlockCollateral(msg.sender, collateral);

        if (settlementAmount > 0) {
            vault.payOutProfit(msg.sender, uint256(settlementAmount));
        } else {
            // settlementAmount <= 0 -> loss to be absorbed by vault
            vault.absorbLoss(msg.sender, uint256(-settlementAmount));
        }
        delete positions[msg.sender];
        virtualAMM.updateReserve(amount, !isLong);

        emit PositionClosed(tokenId, msg.sender, pnl, fundingPayment, fees);
    }

    function liquidatePosition(uint256 tokenId) external nonReentrant whenNotPaused {
        (uint256 collateral, uint8 leverage, uint256 entryPrice, int256 entryFundingRate, bool isLong) = _getPositionData(tokenId);        
        address owner = positionNFT.ownerOf(tokenId);
        
        // use require instead of custom error
        require(_isLiquidatable(collateral, leverage, entryPrice, entryFundingRate, isLong), "Position not liquidatable");

        (uint256 currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        int256 pnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int256 fundingPayment = _calculateFundingPayment(isLong, collateral, entryFundingRate);

        // remaining value on the position (collateral + pnl + funding)
        int256 remainingValue = int256(collateral) + pnl + fundingPayment;

        uint256 amount = collateral * leverage;
        if (isLong) {
            totalLong -= amount;
            totalLongCollateral -= collateral;
        } else {
            totalShort -= amount;
            totalShortCollateral -= collateral;
        }

        positionNFT.burnPosition(tokenId);

        // unlock collateral back to owner (vault handles transfer)
        vault.unlockCollateral(owner, collateral);

        // pay out remaining or absorb loss
        if (remainingValue > 0) {
            // remainingValue includes collateral + pnl + funding; pay what's left as profit
            vault.payOutProfit(owner, uint256(remainingValue));
        } else {
            vault.absorbLoss(owner, uint256(-remainingValue));
        }

        // delete the position entry keyed by the owner (not msg.sender!)
        delete positions[owner];

        // update AMM reserve consistently using full position size
        virtualAMM.updateReserve(amount, !isLong);

        emit PositionLiquidated(tokenId, owner);
    }

    function updateFundingRate() external onlyOwner {
        require(block.timestamp >= lastFundingTime + FUNDING_INTERVAL, "Funding too early");

        int256 fundingRateBps = virtualAMM.calculateFundingRate();
        fundingRateAccumulated += fundingRateBps;
        lastFundingTime = block.timestamp;

        emit FundingRateUpdated(fundingRateBps, fundingRateAccumulated);
    }

    function isPositionLiquidatable(uint256 tokenId) external view returns (bool) {
         (uint256 collateral, uint8 leverage, uint256 entryPrice, int256 entryFundingRate, bool isLong) = _getPositionData(tokenId);
        return _isLiquidatable(collateral, leverage, entryPrice, entryFundingRate, isLong);
    }

    function _getPositionData(uint256 tokenId) public view returns (uint256 , uint8 , uint256 , int256 , bool ) {
        (
            ,
            uint256 collateral,
            uint8 leverage,
            uint256 entryPrice,
            ,
            int256 entryFundingRate,
            bool isLong,
        ) = positionNFT.getPosition(tokenId);

        return(collateral, leverage, entryPrice, entryFundingRate, isLong);

    }

    function _calculatePnl(
        bool isLong,
        uint8 leverage,
        uint256 collateral,
        uint256 entryPrice,
        uint256 currentPrice
    ) internal pure returns (int256) {
        require(entryPrice > 0 && currentPrice > 0, "Invalid price");
        require(leverage > 0, "Invalid leverage");
        require(collateral > 0, "Invalid collateral");

        int256 priceChangePercentage;
        int256 current = int256(currentPrice);
        int256 entry = int256(entryPrice);

        if (isLong) {
            priceChangePercentage = (current * 1e18) / entry - 1e18;
        } else {
            priceChangePercentage = 1e18 - (current * 1e18) / entry;
        }
        int256 leveragedPercentage = (priceChangePercentage * int256(uint256(leverage)));
        int256 pnl = (int256(collateral) * leveragedPercentage) / 1e18;
        return pnl;
    }

    function _calculateFundingPayment(
        bool isLong,
        uint256 collateral,
        int256 entryFundingRate
    ) internal view returns (int256) {
        int256 fundingDelta = fundingRateAccumulated - entryFundingRate;
        int256 fundingPayment = (int256(collateral) * fundingDelta) / 10000;

        return isLong ? fundingPayment : -fundingPayment;
    }

    function _isLiquidatable(
        uint256 collateral,
        uint8 leverage,
        uint256 entryPrice,
        int256 entryFundingRate,
        bool isLong
    ) internal view returns (bool) {
        (uint256 currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        if (!isValid) return false;

        int256 pnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int256 fundingPayment = _calculateFundingPayment(isLong, collateral, entryFundingRate);

        int256 remainingValue = int256(collateral) + pnl + fundingPayment;
        int256 maintenanceMargin = int256(collateral * LIQUIDATION_THRESHOLD_BPS) / 10000;

        return remainingValue <= maintenanceMargin;
    }

    function getPositionStats() external view returns (uint256, uint256, uint256, uint256, int256) {
        return (totalLong, totalShort, totalLongCollateral, totalShortCollateral, fundingRateAccumulated);
    }

    function getCurrentFundingRate() external view returns(int256){
        return virtualAMM.calculateFundingRate();
    }

    // convenience administrative function to toggle pause
    function toggleEmergencyPause(bool _paused) external onlyOwner {
        emergencyPause = _paused;
        emit EmergencyPauseToggled(_paused);
    }
}
