// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/tokens/PositionNFT.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PositionNFTTest is Test {
    PositionNFT nft;
    address user = address(0xABCD);
    address positionManager = address(this); // Self as manager

    function setUp() public {
        nft = new PositionNFT("https://metadata/");
        nft.setPositionManager(positionManager);
        vm.label(user, "Trader");
    }

    error ERC721NonexistentToken(uint256 tokenId);

    function testMintPosition() public {
        uint tokenId = nft.mintPosition(user, 500e18, 10, 2000e8, -50, true);
        assertEq(nft.ownerOf(tokenId), user);

        (
            uint returnedId,
            uint collateral,
            uint8 lev,
            uint entryPrice,
            ,
            int rate,
            bool isLong,
            string memory sym
        ) = nft.getPosition(tokenId);

        assertEq(returnedId, tokenId);
        assertEq(lev, 10);
        assertEq(collateral, 500e18);
        assertEq(entryPrice, 2000e8);
        assertEq(rate, -50);
        assertEq(sym, "vETH-LONG");
        assertTrue(isLong);
    }

    function testBurnPosition() public {
        uint tokenId = nft.mintPosition(user, 500e18, 5, 2000e8, -20, false);
        nft.burnPosition(tokenId);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, tokenId));
        nft.ownerOf(tokenId);
    }


    function testUpdatePosition() public {
        uint tokenId = nft.mintPosition(user, 300e18, 3, 2000e8, 0, false);
        nft.updatePosition(tokenId, 4, 350e18);

        (, uint collateral, uint8 lev,, , , ,) = nft.getPosition(tokenId);
        assertEq(collateral, 350e18);
        assertEq(lev, 4);
    }

    function testTokenURI() public {
        uint tokenId = nft.mintPosition(user, 100e18, 2, 2000e8, 0, true);
        string memory uri = nft.tokenURI(tokenId);
        assertEq(uri, string.concat("https://metadata/", Strings.toString(tokenId), ".json"));
    }

    function testPreventTransfers() public {
        uint tokenId = nft.mintPosition(user, 100e18, 2, 2000e8, 0, true);
        vm.expectRevert("Positions are non-transferable");
        nft.transferFrom(user, address(0x1234), tokenId);
    }

    function testUserTokensTracking() public {
        uint id1 = nft.mintPosition(user, 100e18, 1, 2000e8, 0, true);
        uint id2 = nft.mintPosition(user, 200e18, 2, 2000e8, 0, false);
        uint[] memory tokens = nft.getUserPositions(user);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], id1);
        assertEq(tokens[1], id2);
    }
}
