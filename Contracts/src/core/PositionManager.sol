// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IPositionNFT.sol";
import "../interfaces/IVirtualAMM.sol";
import "../interfaces/IVault.sol";

contract PositionManager is ReentrancyGuard, Ownable{

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

    IPriceFeed public priceFeed;
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


    error ContractPaused();
    error InsufficientCollateral();
    error InvalidLeverage();
    error InsufficientFunds();
    error PositionNotFound();
    error NotPositionOwner();
    error PositionNotLiquidatable();
    error FundingTooEarly();

    modifier whenNotPaused() {
        if (emergencyPause) revert ContractPaused();
        _;
    }

    event FundingRateUpdated(int256 fundingRateBps, uint256 timestamp);
    event PositionOpened(address user, uint256 collateraal, uint256 entryPrice, uint8 leverage, int256 entryFundingRate, bool isLong);
    event PositionClosed(uint256 indexed tokenId, address indexed user, int256 pnl, int256 fundingPayment, uint256 fees);
    event PositionLiquidated(uint256 indexed tokenId, address indexed user, address indexed liquidator, uint256 liquidationReward);
    event FundingRateUpdated(int256 newRate, int256 accumulated);
    event EmergencyPauseToggled(bool paused);

    constructor(address _priceFeed, address _positionNFT, address _virtualAMM, address _vault ) Ownable(msg.sender){
        priceFeed = IPriceFeed(_priceFeed);
        positionNFT = IPositionNFT(_positionNFT);
        virtualAMM = IVirtualAMM(_virtualAMM);
        vault = IVault(_vault);
    }

function openPosition(uint _collateral, uint8 _leverage, bool _isLong) external nonReentrant whenNotPaused {
    
        require(_collateral > 0, "Collateral cannot be zero");
        require(_leverage > 0 && _leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(!positions[msg.sender].isOpen, "Position already open");

        // Fees are taken from margin, not added
        uint256 fees = (_collateral * TRADING_FEES) / 1e6; // 500/1e6 = 0.05%
        require(_collateral > fees, "Insufficient after fees");

        uint256 netCollateral = _collateral - fees;

        vault.lockCollateral(msg.sender, netCollateral);
        uint amount = netCollateral * _leverage;
        virtualAMM.updateReserve(amount, _isLong);

        uint256 entryPrice = uint(priceFeed.getLatestPrice()) * 1e10;
        int entryFundingRate = (virtualAMM.calculateFundingRate());

        positions[msg.sender] = Position({
            user: msg.sender,
            collateral: netCollateral,
            entryPrice: entryPrice,
            exitPrice: 0,
            positionSize: amount,
            entryFundingRate: entryFundingRate,
            leverage: _leverage,
            isLong: _isLong,
            isOpen: true
        });

        if (_isLong) {
            totalLong += (amount);
            totalLongCollateral += netCollateral;
        } else {
            totalShort += (amount);
            totalShortCollateral += netCollateral;
        }

         // record NFT for open position
        positionNFT.mintPosition(msg.sender, netCollateral, _leverage, entryPrice, entryFundingRate, _isLong);

        emit PositionOpened(msg.sender, netCollateral, entryPrice, _leverage, entryFundingRate, _isLong);

    }

    function closePosition(uint256 tokenId) external nonReentrant whenNotPaused {
        (uint256 collateral, uint8 leverage, uint256 entryPrice, int256 entryFundingRate, bool isLong) = _getPositionData(tokenId);
        require(positionNFT.ownerOf(tokenId) == msg.sender, "Not position owner");

        (uint256 currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        uint256 notionalSize = collateral * leverage;
        uint256 fees = (collateral * TRADING_FEES) / 10000;

        int256 pnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int256 fundingPayment = _calculateFundingPayment(isLong, collateral, entryFundingRate);
        int256 settlementAmount = int256(collateral) + pnl - fundingPayment - int256(fees);

        if (isLong) {
            totalLong -= notionalSize;
            totalLongCollateral -= collateral;
        } else {
            totalShort -= notionalSize;
            totalShortCollateral -= collateral;
        }

        positionNFT.burnPosition(tokenId);

        if (settlementAmount > 0) {
            vault.unlockCollateral(msg.sender, uint256(settlementAmount));
        } else {
            vault.absorbLiquidatedCollateral(msg.sender, collateral);
        }


        emit PositionClosed(tokenId, msg.sender, pnl, fundingPayment, fees);
    }

  function liquidatePosition(uint256 tokenId) external nonReentrant whenNotPaused {
        (uint256 collateral, uint8 leverage, uint256 entryPrice, int256 entryFundingRate, bool isLong) = _getPositionData(tokenId);        
        address owner = positionNFT.ownerOf(tokenId);
        require(owner == msg.sender, "Not position owner");

        if (!_isLiquidatable(collateral, leverage, entryPrice, entryFundingRate, isLong)) {
            revert PositionNotLiquidatable();
        }

        (uint256 currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        int256 pnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int256 fundingPayment = _calculateFundingPayment(isLong, collateral, entryFundingRate);
        uint256 liquidationReward = (collateral * 200) / 10000;
        int256 remainingValue = int256(collateral) + pnl - fundingPayment - int256(liquidationReward);

        uint256 notionalSize = collateral * leverage;
        if (isLong) {
            totalLong -= notionalSize;
            totalLongCollateral -= collateral;
        } else {
            totalShort -= notionalSize;
            totalShortCollateral -= collateral;
        }

        positionNFT.burnPosition(tokenId);

        if (liquidationReward > 0) {
            vault.transferCollateral(msg.sender, liquidationReward);
        }

        if (remainingValue > 0) {
            vault.unlockCollateral(owner, uint256(remainingValue));
        }

        vault.absorbLiquidatedCollateral(owner, collateral);

        emit PositionLiquidated(tokenId, owner, msg.sender, liquidationReward);
    }

    function updateFundingRate() external onlyOwner {
        if (block.timestamp < lastFundingTime + FUNDING_INTERVAL) revert FundingTooEarly();

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
        int256 priceChangePercentage;

        if (isLong) {
            priceChangePercentage = (int256(currentPrice) * 1e18) / int256(entryPrice) - 1e18;
        } else {
            priceChangePercentage = 1e18 - (int256(currentPrice) * 1e18) / int256(entryPrice);
        }

        int256 pnlPercent = (priceChangePercentage * int256(uint256(leverage))) / 1e18;
        return (int256(collateral) * pnlPercent) / 1e18;
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

        int256 remainingValue = int256(collateral) + pnl - fundingPayment;
        int256 maintenanceMargin = int256(collateral * LIQUIDATION_THRESHOLD_BPS) / 10000;

        return remainingValue <= maintenanceMargin;
    }

    function getPositionStats() external view returns (uint256, uint256, uint256, uint256, int256) {
        return (totalLong, totalShort, totalLongCollateral, totalShortCollateral, fundingRateAccumulated);
    }
}