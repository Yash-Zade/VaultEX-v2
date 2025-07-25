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
        int8 entryFundingRate;
        uint8 leverage;
        bool isLong;
        bool isOpen;
    }

    mapping (address => Position) positions;

    event FundingRateUpdated(int256 fundingRateBps, uint256 timestamp);
    event PositionOpened(address user, uint256 collateraal, uint256 entryPrice, uint8 leverage, int8 entryFundingRate, bool isLong);
    event PositionClosed(address user, uint256 collateral, uint256 entryPrice, uint256 exitPrice, uint8 leverage, uint8 accumulatedFundingrate, int256 pnl, bool isLong);

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
        int8 entryFundingRate = int8(virtualAMM.calculateFundingRate());

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
        positionNFT.mintPosition(msg.sender, netCollateral, _leverage, entryPrice, _isLong);

        emit PositionOpened(msg.sender, netCollateral, entryPrice, _leverage, entryFundingRate, _isLong);

    }

    function updateFundingRate() external onlyOwner(){
        require(block.timestamp >= lastFundingTime + 8 hours, "Funding rate can only be updated every 8 hours");
        int fundingRateBps = virtualAMM.calculateFundingRate();
        fundingRateAccumulated += fundingRateBps;
        lastFundingTime += block.timestamp;
        emit FundingRateUpdated(fundingRateBps, block.timestamp);
    }


}