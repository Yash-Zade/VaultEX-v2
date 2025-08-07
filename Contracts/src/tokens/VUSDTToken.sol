// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VUSDTToken is ERC20, Ownable {
    constructor() ERC20("Virtual USDT", "vUSDT") Ownable(msg.sender) {}

    mapping(address => bool) public hasClaimed;

    function mint(address to, uint _amount) public onlyOwner {
        _mint(to, _amount);
    }

    function airDrop(address to) public {
        require(!hasClaimed[to], "Already claimed");
        _mint(to, 10000 * (10 ** decimals()));
        hasClaimed[to] = true;
    }

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }
}
