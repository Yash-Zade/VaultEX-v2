import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Button } from "@heroui/button";
import { useAccount } from "wagmi";
import { readContract, writeContract, } from '@wagmi/core';
import { config } from "@/config/wagmi-config";
import VAMM_ABI from "@/abis/vamm.json";
import PRICE_FEED_ABI from "@/abis/priceFeed.json";
import POSITION_NFT_ABI from "@/abis/positionNft.json";
import POSITION_MANAGER_ABI from "@/abis/positionManager.json";
import { useState } from "react";
import VUSDT_ABI from "@/abis/vusdt.json";
import VAULT_ABI from "@/abis/vault.json";
import { read, write } from "node:fs";

const VUSDT_ADDRESS = import.meta.env.VITE_VUSDT_ADDRESS;
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;
const VAMM_ADDRESS = import.meta.env.VITE_VAMM_ADDRESS;
const PRICE_FEED_ADDRESS = import.meta.env.VITE_PRICE_FEED_ADDRESS;
const POSITION_NFT_ADDRESS = import.meta.env.VITE_POSITION_NFT_ADDRESS;
const POSITION_MANAGER_ADDRESS = import.meta.env.VITE_POSITION_MANAGER_ADDRESS;


export default function DocsPage() {
  const { address } = useAccount();
  const [tokenId, setTokenID] = useState(null);
  const [fundingRate, setFundingRate] = useState();


  const getPrice = async () => {
    const price = await readContract(config, {
      address: VAMM_ADDRESS,
      abi: VAMM_ABI,
      functionName: "getCurrentPrice",
      account: address,
    })
    console.log(price[0]);
  }

  const getPriceOracle = async () => {
    const price = await readContract(config, {
      address: PRICE_FEED_ADDRESS,
      abi: PRICE_FEED_ABI,
      functionName: "getLatestPrice",
      account: address,
    })
    console.log(price);
  }

  const getUserPosition = async () => {
    const tokens = await readContract(config, {
      address: POSITION_NFT_ADDRESS,
      abi: POSITION_NFT_ABI,
      functionName: "getUserPositions",
      args: [address],
    })
    setTokenID((tokens[0]));
    console.log(tokenId)
  }

  const getPositionStats = async () => {
    const stats = await readContract(config, {
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "getPositionStats",
      account: address,
    })
    console.log(stats)
  }

  const getFundingRate = async () => {
    const rate = await readContract(config, {
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "getCurrentFundingRate",
      account: address,
    })
    setFundingRate(rate);
    console.log(fundingRate);
  }

  const closePosition = async () => {
    if (!address) return;
    getPositions();

    try {
      await writeContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "closePosition",
        args: [tokenId],
      });
    } catch (error) {
      console.error("Failed to close position:", error);
      alert("Could not close position.");
    }
  };

  const getPositions = async () => {
    if (!address) return;
    try {
      const token = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "_getPositionData",
        args: [tokenId],
      });
      console.log(token);
    } catch (error) {
      console.error("Failed to load position data:", error);
      alert("Could not load position data.");
    }
  };

  const updatePosition = async () => {
    const pos = await writeContract(config, {
      address: POSITION_NFT_ADDRESS,
      abi: POSITION_NFT_ABI,
      functionName: "updatePosition",
      args: [2, 25, 500 * 1e18],
      account: address,
    })
    console.log(pos);
  }

  const mint = async () => {
    await writeContract(config, {
      address: VUSDT_ADDRESS,
      abi: VUSDT_ABI,
      functionName: "mint",
      args: [VAULT_ADDRESS, 100000000000000 * 1e18],
      account: address,
    })
  }

  const updateRate = async () => {
    const rate = await writeContract(config, {
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "updateFundingRate",
      account: address,
    })
    console.log(rate);
  }

  const vaultBalance = async () => {
    const balance = await readContract(config, {
      address: VUSDT_ADDRESS,
      abi: VUSDT_ABI,
      functionName: "balanceOf",
      args: [VAULT_ADDRESS],
      account: address,
    })
    console.log(balance);
  }

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center justify-center">
          <h1 className={title()}>
            <Button onClick={getPrice}>
              Get Price
            </Button>
            <Button onClick={getPriceOracle}>
              getPriceOracle
            </Button>
            <Button onClick={getUserPosition}>
              getUserPosition
            </Button>
            <Button onClick={closePosition}>
              closePosition
            </Button>
            <Button onClick={getPositions}>
              getPositions
            </Button>
            <Button onClick={updatePosition}>
              update Position
            </Button>

            <Button onClick={mint}>
              mint to vault
            </Button>

            <Button onClick={vaultBalance}>
              vaultBalance
            </Button>

            <Button onClick={updateRate}>
              updateRate
            </Button>

            <Button onClick={getFundingRate}>
              getFundingRate
            </Button>

            <Button onClick={getPositionStats}>
              getPositionStats
            </Button>
          </h1>
        </div>
      </section>
    </DefaultLayout>
  );
}
