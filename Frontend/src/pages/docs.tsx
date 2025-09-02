import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import { Button } from "@heroui/button";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { config } from "@/config/wagmi-config";
import VAMM_ABI from "@/abis/vamm.json";
import PRICE_FEED_ABI from "@/abis/priceFeed.json";
import POSITION_NFT_ABI from "@/abis/positionNft.json";
import POSITION_MANAGER_ABI from "@/abis/positionManager.json";
import { useState, useEffect, useCallback } from "react";
import VUSDT_ABI from "@/abis/vusdt.json";
import VAULT_ABI from "@/abis/vault.json";
import { toast } from 'react-toastify';

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

  // Transaction tracking
  const [messages, setMessages] = useState([]);
  const [currentTxHash, setCurrentTxHash] = useState(null);

  // Write contract hook
  const {
    data: hash,
    error: writeError,
    isPending: isWritePending,
    writeContract
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
    data: receipt
  } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  // Message helper function
  const addMessage = useCallback((message, type = 'info') => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, []);

  // Handle transaction hash updates
  useEffect(() => {
    if (hash) {
      setCurrentTxHash(hash);
      addMessage(`Transaction submitted: ${hash}`, 'info');
    }
  }, [hash, addMessage]);

  const handleAirdrop = async () => {
    if (!address) return;
    try {
      const hasClaimed = await readContract(config, {
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: "hasClaimed",
        args: [address],
      }) as boolean;

      if (hasClaimed) {
        toast.error("You already claimed your airdrop.");
        return;
      }

      const tx = await writeContract(config, {
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: "airDrop",
        args: [],
      });

      toast.info("Transaction sent. Waiting for confirmation...");

      const receipt = await waitForTransactionReceipt(config, { hash: tx });

      if (receipt.status === "success") {
        toast.success("Airdrop successful!");
        await loadVaultBalances();
      } else {
        toast.error("Airdrop failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Airdrop failed.");
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirming) {
      addMessage('Confirming transaction...', 'info');
    }

    if (isConfirmed && receipt) {
      addMessage('Transaction confirmed successfully! 🎉', 'success');
    }

    if (confirmError) {
      addMessage(`Transaction failed: ${confirmError.shortMessage || confirmError.message}`, 'error');
    }
  }, [isConfirming, isConfirmed, receipt, confirmError, addMessage]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      addMessage(`Transaction error: ${writeError.shortMessage || writeError.message}`, 'error');
    }
  }, [writeError, addMessage]);

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
    getUserPosition();
    try {
      addMessage('Closing position...', 'info');
      writeContract({
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "closePosition",
        args: [tokenId],
      });
    } catch (error) {
      console.error("Failed to close position:", error);
      addMessage("Could not close position.", 'error');
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
    try {
      addMessage('Updating position...', 'info');
      writeContract({
        address: POSITION_NFT_ADDRESS,
        abi: POSITION_NFT_ABI,
        functionName: "updatePosition",
        args: [2, 25, BigInt(500 * 1e18)],
      });
    } catch (error) {
      console.log(error);
      addMessage('Failed to update position', 'error');
    }
  }

  const mint = async () => {
    try {
      addMessage('Minting tokens...', 'info');
      writeContract({
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: "mint",
        args: [VAULT_ADDRESS, BigInt(100000000000000 * 1e18)],
      });
    } catch (error) {
      addMessage('Failed to mint tokens', 'error');
    }
  }

  const updateRate = async () => {
    try {
      addMessage('Updating funding rate...', 'info');
      writeContract({
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "updateFundingRate",
      });
    } catch (error) {
      console.log(error);
      addMessage('Failed to update rate', 'error');
    }
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
          <h1 className={title()}>Docs</h1>

          {/* Transaction Messages - Added Part */}
          {messages.length > 0 && (
            <div className="mb-4">
              <div className="max-h-32 overflow-y-auto space-y-1">
                {messages.slice(-5).map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded text-sm ${msg.type === 'success' ? 'bg-green-100 text-green-800' :
                        msg.type === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                      }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator - Added Part */}
          {(isWritePending || isConfirming) && (
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm">
                {isWritePending ? 'Preparing transaction...' : 'Confirming transaction...'}
              </span>
            </div>
          )}

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
            <Button onClick={closePosition} disabled={isWritePending || isConfirming}>
              closePosition
            </Button>
            <Button onClick={getPositions}>
              getPositions
            </Button>
            <Button onClick={updatePosition} disabled={isWritePending || isConfirming}>
              update Position
            </Button>
            <Button onClick={mint} disabled={isWritePending || isConfirming}>
              mint to vault
            </Button>
            <Button onClick={vaultBalance}>
              vaultBalance
            </Button>
            <Button onClick={updateRate} disabled={isWritePending || isConfirming}>
              updateRate
            </Button>
            <Button onClick={getFundingRate}>
              getFundingRate
            </Button>
            <Button onClick={getPositionStats}>
              getPositionStats
            </Button>
            <Button onClick={handleAirdrop}>
              Air Drop
            </Button>
          </h1>
        </div>
      </section>
    </DefaultLayout>
  )
}