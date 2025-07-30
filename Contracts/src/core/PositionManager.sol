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


    uint public totalLong;
    uint public totalShort;
    uint public totalLongCollateral;
    uint public totalShortCollateral;
    int public fundingRateAccumulated;

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

    event FundingRateUpdated(int256 fundingRateBps, uint256 timestamp);
    event PositionOpened(address user, uint256 collateraal, uint256 entryPrice, uint8 leverage, int256 entryFundingRate, bool isLong);
    event PositionClosed(address user, uint256 collateral, uint256 entryPrice, uint256 exitPrice, int256 fundingReward,uint8 leverage, int256 pnl, bool isLong);

    constructor(address _priceFeed, address _positionNFT, address _virtualAMM, address _vault ) Ownable(msg.sender){
        priceFeed = IPriceFeed(_priceFeed);
        positionNFT = IPositionNFT(_positionNFT);
        virtualAMM = IVirtualAMM(_virtualAMM);
        vault = IVault(_vault);
    }

function openPosition(uint _collateral, uint8 _leverage, bool _isLong) external nonReentrant {
    
        require(_collateral > 0, "Collateral cannot be zero");
        require(_leverage > 0 && _leverage <= MAX_LEVERAGE, "Invalid leverage");
        require(!positions[msg.sender].isOpen, "Position already open");

        // Fees are taken from margin, not added
        uint256 fees = ((_collateral * _leverage) * TRADING_FEES) / 1e6; // 500/1e6 = 0.05%
        require(_collateral > fees, "Insufficient after fees");

        uint256 netCollateral = _collateral - fees;

        vault.lockCollateral(msg.sender, _collateral);
        uint amount = netCollateral * _leverage;
        virtualAMM.updateReserve(amount, _isLong);

        uint256 entryPrice = uint(priceFeed.getLatestPrice());
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

    function closePosition(uint256 tokenId, uint256 priceDelta) external nonReentrant {
        require(positionNFT.ownerOf(tokenId) == msg.sender, "Not position owner");
        require(priceDelta >= 0, "Invalid priceDelta");

        (   ,
            uint256 collateral,
            uint8 leverage,
            uint256 entryPrice,,
            int entryFundingRate,
            bool isLong,) = positionNFT.getPosition(tokenId);

        require(priceDelta >= collateral, "Collateral delta too large");

        (uint currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid price");

        int finalPnl = _calculatePnl(isLong, leverage, collateral, entryPrice, currentPrice);
        int fundingReward = _calculateFundingReward(isLong, finalPnl, collateral, entryFundingRate);

        uint256 fees = ((collateral * leverage) * TRADING_FEES) / 1e6;
        int settledAmount = int(collateral) + finalPnl + fundingReward - int(fees);

        positionNFT.burnPosition(tokenId);
        delete positions[msg.sender];

        // Handle liquidation
        if (isLiquidated(msg.sender)) {
            vault.absorbLiquidatedCollateral(msg.sender, _amount);
            emit PositionClosed(msg.sender, collateral, entryPrice, currentPrice, fundingReward, leverage, finalPnl, isLong);
            return;
        }

        vault.unlockCollateral(msg.sender, collateral);

        if (settledAmount > 0) {
            vault.transferCollateral(address(this), msg.sender, uint(settledAmount));
        }
        
        emit PositionClosed(msg.sender, collateral, entryPrice, currentPrice, fundingReward, leverage, finalPnl, isLong);
    }


    function isLiquidated(address user) public view returns(bool){
        Position memory pos = positions[user];

        (uint currentPrice, bool isValid) = virtualAMM.getCurrentPrice();
        require(isValid, "Invalid Price");
        
        int pnl = _calculatePnl(pos.isLong, pos.leverage, pos.collateral, pos.entryPrice, currentPrice);
        int256 entryPriceWithFee = (int256(pos.entryPrice) * 95) / 100;

        if((int(currentPrice) + pnl) >= entryPriceWithFee){
            return false;
        }

        return true;
    }

    function _calculatePnl(bool isLong, uint8 leverage, uint256 collateral, uint256 entryPrice, uint256 currentPrice) internal pure returns (int) {
        int priceChangePercentage;

        if (isLong) {
            priceChangePercentage = (int(currentPrice) * 1e18) / int(entryPrice) - 1e18;
        } else {
            priceChangePercentage = 1e18 - (int(currentPrice) * 1e18) / int(entryPrice);
        }

        int pnlPercent = (priceChangePercentage * int8(leverage)) / 1e18;
        return int(collateral) * pnlPercent / 1e18;
    }

    function _calculateFundingReward(bool isLong, int finalPnl, uint256 collateral, int entryFundingRate) internal view returns (int) {
        int settledAmount = int(collateral) + finalPnl;
        int fundingDelta = fundingRateAccumulated - entryFundingRate;
        int fundingReward = (settledAmount * fundingDelta) / 10000;

        if ((isLong && fundingDelta < 0) || (!isLong && fundingDelta > 0)) {
            return -fundingReward; // pay
        } else {
            return fundingReward; // receive
        }
    }


    function updateFundingRate() external onlyOwner(){
        require(block.timestamp >= lastFundingTime + 8 hours, "Funding rate can only be updated every 8 hours");
        int fundingRateBps = virtualAMM.calculateFundingRate();
        fundingRateAccumulated += fundingRateBps;
        lastFundingTime = block.timestamp;
        emit FundingRateUpdated(fundingRateBps, block.timestamp);
    }

}