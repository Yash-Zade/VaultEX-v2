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

    function updateReserve(uint _amount, bool isLong) external onlyPositionManager(){
        require(_amount > 0, "Amount should be greater than 0");

        uint size = _amount * virtualReserveVETH / (virtualReserveVUSDT + _amount);

        if(isLong){
            // Buy ETH using USDT → ETH down, USDT up
            virtualReserveVETH -=size;
            virtualReserveVUSDT += _amount;
        }else{
            // Sell ETH for USDT → ETH up, USDT down
            virtualReserveVETH +=size;
            virtualReserveVUSDT -= _amount;
        }
    }

    function setInitialPrice() external onlyOwner(){
        uint price = uint(priceFeed.getLatestPrice());
        uint k = virtualReserveVETH * virtualReserveVUSDT;

        uint256 vETH = sqrt(k * PRICE_PRECISION / price);

        uint256 vUSDT = price * vETH / PRICE_PRECISION;

        virtualReserveVETH = vETH;
        virtualReserveVUSDT = vUSDT;
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