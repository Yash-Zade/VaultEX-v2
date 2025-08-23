// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceFeed.sol";

contract VirtualAMM is Ownable{
    
    uint virtualReserveVETH;
    uint virtualReserveVUSDT;
    uint constant PRICE_PRECISION = 1e8;
    address positionManager;
    IPriceFeed priceFeed;
    
    event ReservesUpdated(uint256 vETHreserve, uint256 vUSDTreserve);

    // Only position manager can call certain functions
    modifier onlyPositionManager() {
        require(positionManager == msg.sender, "Only Position manager can access");
        _;
    }


    constructor(uint _virtualReserveVETH, uint _virtualReserveVUSDT, address _priceFeed) Ownable(msg.sender){
        virtualReserveVETH = _virtualReserveVETH;
        virtualReserveVUSDT = _virtualReserveVUSDT;
        priceFeed = IPriceFeed(_priceFeed);
    }

     // Set position manager address
    function setPositionManager(address _positionManager) external onlyOwner() {
        require(_positionManager != address(0), "Invalid address");
        positionManager = _positionManager;
    }

    function getCurrentPrice() public view returns(uint, bool){
        if(virtualReserveVETH == 0 || virtualReserveVUSDT == 0) return(0,false);
        uint price = (virtualReserveVUSDT * PRICE_PRECISION ) / virtualReserveVETH;
        return(price, true);
    }

    function updateReserve(uint _amount, bool _isLong) external onlyPositionManager(){
        require(_amount > 0, "Amount should be greater than 0");
        require(virtualReserveVETH > 0 && virtualReserveVUSDT > 0, "invalid reserves");
        
        _amount /= 1e10;
        uint256 k = virtualReserveVETH * virtualReserveVUSDT;

        if (_isLong) {
            // Trader adds USDT, remove ETH to keep x*y=k
            virtualReserveVUSDT += _amount;
            virtualReserveVETH = k / virtualReserveVUSDT;
        } else {
            // Trader removes USDT, add ETH to keep x*y=k
            require(virtualReserveVUSDT > _amount, "underflow");
            virtualReserveVUSDT -= _amount;
            virtualReserveVETH = k / virtualReserveVUSDT;
        }

        emit ReservesUpdated(virtualReserveVETH, virtualReserveVUSDT);

    }

    function setInitialPrice() external onlyOwner(){
        uint price = uint(priceFeed.getLatestPrice());
        uint k = virtualReserveVETH * virtualReserveVUSDT;

        uint256 vETH = sqrt(k * PRICE_PRECISION / price);

        uint256 vUSDT = price * vETH / PRICE_PRECISION;

        virtualReserveVETH = vETH;
        virtualReserveVUSDT = vUSDT;
    }

    function calculateFundingRate() external view onlyPositionManager returns (int256 fundingRateBps) {
        uint256 spotPrice = uint256(priceFeed.getLatestPrice());

        (uint256 vAMMPrice, bool isValid) = getCurrentPrice();
        if (!isValid || spotPrice == 0) {
            return 0;
        }

        int256 rawFundingRate = int256(vAMMPrice * 10000 / spotPrice) - 10000;

        if (rawFundingRate > 500) {
            fundingRateBps = 500;
        } else if (rawFundingRate < -500) {
            fundingRateBps = -500;
        } else {
            fundingRateBps = rawFundingRate;
        }
    }


    function sqrt(uint x) internal pure returns (uint y) {
        if (x == 0) return 0;
        uint z = x / 2 + 1;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }


}