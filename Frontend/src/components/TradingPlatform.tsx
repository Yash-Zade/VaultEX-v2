import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { Badge } from "@heroui/badge";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { TrendingUp, TrendingDown, Target, Zap, Activity, DollarSign, Clock } from "lucide-react";
import { useAccount } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { parseUnits } from 'ethers';
import { config } from "@/config/wagmi-config";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import POSITION_MANAGER_ABI from "@/abis/positionManager.json";
import VAMM_ABI from "@/abis/vamm.json";
import POSITION_NFT_ABI from "@/abis/positionNft.json";

const POSITION_MANAGER_ADDRESS = import.meta.env.VITE_POSITION_MANAGER_ADDRESS;
const VAMM_ADDRESS = import.meta.env.VITE_VAMM_ADDRESS;
const POSITION_NFT_ADDRESS = import.meta.env.VITE_POSITION_NFT_ADDRESS;

type PricePoint = {
  time: string;
  price: number;
  timestamp: number;
};

type UserPosition = {
  tokenId: bigint;
  collateral: number;
  leverage: number;
  entryPrice: number;
  entryFundingRate: number;
  isLong: boolean;
  size: number;
  pnl: number;
};

export default function TradingPage() {
  const { address } = useAccount();
  const [baseAmount, setBaseAmount] = useState(10);
  const [leverage, setLeverage] = useState(10);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [fundingRate, setFundingRate] = useState(0);
  const [accumulatedFundingRate, setAccumulatedFundingRate] = useState(0);
  const [position, setPosition] = useState("");
  const [priceChange, setPriceChange] = useState(0);
  const [volume, setVolume] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [positionStats, setPositionStats] = useState({
    totalLong: 0,
    totalShort: 0,
    totalLongCollateral: 0,
    totalShortCollateral: 0,
    fundingRateAccumulated: 0
  });
  const [priceData, setPriceData] = useState<PricePoint[]>([]);

  // Refs to track loading states and prevent duplicate calls
  const isFetchingRef = useRef(false);
  const lastPriceRef = useRef(0);
  const toastIdRef = useRef<any>(null);
  const lastFetchTimeRef = useRef(0);

  // Calculate PnL for user position
  const calculatePnL = useCallback((pos: UserPosition) => {
    if (!currentPrice || currentPrice === 0) return 0;
    
    const priceDiff = pos.isLong 
      ? currentPrice - pos.entryPrice 
      : pos.entryPrice - currentPrice;
    
    const positionSize = pos.collateral * pos.leverage;
    const pnl = (priceDiff / pos.entryPrice) * positionSize;
    
    // Calculate funding payment
    const fundingPayment = ((accumulatedFundingRate - pos.entryFundingRate) / 10000) * positionSize;
    const adjustedPnl = pos.isLong ? pnl - fundingPayment : pnl + fundingPayment;
    
    return adjustedPnl;
  }, [currentPrice, accumulatedFundingRate]);

  // Get user positions with full data
  const getUserPositionData = useCallback(async () => {
    if (!address) {
      setUserPosition(null);
      return;
    }
    
    try {
      const positions = await readContract(config, {
        address: POSITION_NFT_ADDRESS,
        abi: POSITION_NFT_ABI,
        functionName: "getUserPositions",
        args: [address],
      }) as bigint[];

      if (!positions || positions.length === 0) {
        setUserPosition(null);
        setIsOpen(false);
        return;
      }

      const tokenId = positions[0];
      
      // Get position details
      const posData = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "_getPositionData",
        args: [tokenId],
      }) as [bigint, number, bigint, bigint, boolean];

      const positionInfo: UserPosition = {
        tokenId,
        collateral: Number(posData[0]) / 1e18,
        leverage: Number(posData[1]),
        entryPrice: Number(posData[2]) / 1e18,
        entryFundingRate: Number(posData[3]),
        isLong: posData[4],
        size: (Number(posData[0]) / 1e18) * Number(posData[1]),
        pnl: 0
      };

      // Calculate PnL
      positionInfo.pnl = calculatePnL(positionInfo);

      setUserPosition(positionInfo);
      setIsOpen(true);
      setPosition(positionInfo.isLong ? "long" : "short");
    } catch (error) {
      console.error("Error fetching user position data:", error);
      setUserPosition(null);
      setIsOpen(false);
    }
  }, [address, calculatePnL]);

  // Get current price
  const getCurrentPrice = useCallback(async () => {
    try {
      const price = await readContract(config, {
        address: VAMM_ADDRESS,
        abi: VAMM_ABI,
        functionName: "getCurrentPrice",
        account: address,
      }) as [bigint, boolean];

      const newPrice = Number(price[0]) / 1e18;
      
      if (newPrice !== lastPriceRef.current && newPrice > 0) {
        const change = lastPriceRef.current > 0 ? newPrice - lastPriceRef.current : 0;
        setPriceChange(change);
        setCurrentPrice(newPrice);
        lastPriceRef.current = newPrice;
        
        // Update price data chart
        const now = new Date();
        const newPoint = {
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: newPrice,
          timestamp: now.getTime()
        };
        
        setPriceData(prev => {
          const updated = [...prev, newPoint];
          return updated.slice(-20);
        });
      }
    } catch (error) {
      console.error("Error fetching current price:", error);
    }
  }, [address]);

  // Get funding rate
  const getFundingRate = useCallback(async () => {
    try {
      const rate = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "getCurrentFundingRate",
        account: address
      });
      setFundingRate(Number(rate) / 10000);
    } catch (error) {
      console.error("Error fetching funding rate:", error);
    }
  }, [address]);

  // Get accumulated funding rate
  const getAccumulatedFundingRate = useCallback(async () => {
    try {
      const rate = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "fundingRateAccumulated",
      });
      setAccumulatedFundingRate(Number(rate));
    } catch (error) {
      console.error("Error fetching accumulated funding rate:", error);
    }
  }, []);

  // Get position stats
  const getPositionStats = useCallback(async () => {
    try {
      const stats = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "getPositionStats",
        account: address,
      }) as [bigint, bigint, bigint, bigint, bigint];

      setPositionStats({
        totalLong: Number(stats[0]) / 1e18,
        totalShort: Number(stats[1]) / 1e18,
        totalLongCollateral: Number(stats[2]) / 1e18,
        totalShortCollateral: Number(stats[3]) / 1e18,
        fundingRateAccumulated: Number(stats[4]) / 10000,
      });

      const totalVolume = stats[0] + stats[1];
      setVolume(Number(totalVolume) / 1e18);
    } catch (error) {
      console.error("Error fetching position stats:", error);
    }
  }, [address]);

  // Combined fetch function with rate limiting
  const fetchAllData = useCallback(async () => {
    if (isFetchingRef.current) return;
    
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 3000) return;
    
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;
    
    try {
      await Promise.all([
        getCurrentPrice(),
        getFundingRate(),
        getAccumulatedFundingRate(),
        getPositionStats(),
        getUserPositionData()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [getCurrentPrice, getFundingRate, getAccumulatedFundingRate, getPositionStats, getUserPositionData]);

  // Open position
  const openPosition = async (isLong: boolean) => {
    if (!address || isLoading) return;
    
    setIsLoading(true);
    const amount = parseUnits(baseAmount.toString(), 18);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    try {
      toastIdRef.current = toast.info("Preparing transaction...", { autoClose: false });

      const tx = await writeContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "openPosition",
        args: [amount, leverage, isLong],
        account: address,
      });

      if (toastIdRef.current) {
        toast.update(toastIdRef.current, {
          render: "Transaction sent. Waiting for confirmation...",
          type: "info",
          autoClose: false
        });
      }

      const receipt = await waitForTransactionReceipt(config, { hash: tx });

      if (receipt.status === "success") {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "✅ Position opened successfully!",
            type: "success",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchAllData();
      } else {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "❌ Transaction failed. Please try again.",
            type: "error",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
      }
    } catch (error: any) {
      console.error("Error opening trade:", error);
      
      // Parse error message gracefully
      let errorMessage = "Failed to open position.";
      
      if (error?.message) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds in your wallet.";
        } else if (error.message.includes("InsufficientCollateral")) {
          errorMessage = "Insufficient collateral for this position.";
        } else if (error.message.includes("InvalidLeverage")) {
          errorMessage = "Invalid leverage value selected.";
        } else if (error.message.includes("ContractPaused")) {
          errorMessage = "Trading is currently paused.";
        } else if (error.message.length < 100) {
          errorMessage = error.message;
        }
      }
      
      if (toastIdRef.current) {
        toast.update(toastIdRef.current, {
          render: `❌ ${errorMessage}`,
          type: "error",
          autoClose: 5000
        });
      } else {
        toast.error(`❌ ${errorMessage}`, { autoClose: 5000 });
      }
      toastIdRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  // Close position
  const closePosition = async () => {
    if (!address || isLoading || !userPosition) return;
    
    setIsLoading(true);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    try {
      toastIdRef.current = toast.info("Preparing to close position...", { autoClose: false });

      const tx = await writeContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "closePosition",
        args: [userPosition.tokenId],
        account: address,
      });

      if (toastIdRef.current) {
        toast.update(toastIdRef.current, {
          render: "Closing position... Waiting for confirmation.",
          type: "info",
          autoClose: false
        });
      }

      const receipt = await waitForTransactionReceipt(config, { hash: tx });

      if (receipt.status === "success") {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "✅ Position closed successfully!",
            type: "success",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchAllData();
      } else {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "❌ Failed to close position. Please try again.",
            type: "error",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
      }
    } catch (error: any) {
      console.error("Error closing position:", error);
      
      // Parse error message gracefully
      let errorMessage = "Failed to close position.";
      
      if (error?.message) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas fees.";
        } else if (error.message.includes("NotPositionOwner")) {
          errorMessage = "You don't own this position.";
        } else if (error.message.includes("PositionNotFound")) {
          errorMessage = "Position not found.";
        } else if (error.message.includes("ContractPaused")) {
          errorMessage = "Trading is currently paused.";
        } else if (error.message.length < 100) {
          errorMessage = error.message;
        }
      }
      
      if (toastIdRef.current) {
        toast.update(toastIdRef.current, {
          render: `❌ ${errorMessage}`,
          type: "error",
          autoClose: 5000
        });
      } else {
        toast.error(`❌ ${errorMessage}`, { autoClose: 5000 });
      }
      toastIdRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (address) {
      fetchAllData();
    }
  }, [address, fetchAllData]);

  // Polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAllData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [fetchAllData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  // Update PnL when price changes
  useEffect(() => {
    if (userPosition && currentPrice > 0) {
      const updatedPnL = calculatePnL(userPosition);
      setUserPosition(prev => prev ? { ...prev, pnl: updatedPnL } : null);
    }
  }, [currentPrice, accumulatedFundingRate, userPosition?.tokenId]);

  const positionSize = baseAmount * leverage;
  const priceChangePercent = currentPrice ? (priceChange / currentPrice) * 100 : 0;
  const leverageColor = leverage <= 10 ? "success" : leverage <= 25 ? "warning" : "danger";

  const pieChartData = [
    {
      name: 'Long Positions',
      value: positionStats.totalLong || 1,
      color: '#22c55e'
    },
    {
      name: 'Short Positions',
      value: positionStats.totalShort || 1,
      color: '#ef4444'
    }
  ];

  const collateralData = [
    {
      name: 'Long',
      collateral: positionStats.totalLongCollateral,
      positions: positionStats.totalLong,
    },
    {
      name: 'Short',
      collateral: positionStats.totalShortCollateral,
      positions: positionStats.totalShort,
    }
  ];

  const longShortRatio = positionStats.totalLong + positionStats.totalShort > 0
    ? (positionStats.totalLong / (positionStats.totalLong + positionStats.totalShort)) * 100
    : 50;

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-background to-default-100">
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        style={{
          zIndex: 9999,
        }}
        toastStyle={{
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
          fontWeight: "500",
          fontSize: "14px",
        }}
      />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            Trade <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">ETH/USDT</span>
          </h1>
          <p className="text-foreground-500 text-lg">Perpetual contracts with professional tools</p>
        </div>

        {/* Market Overview Bar */}
        <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-none">
          <CardBody className="py-4">
            <div className="flex justify-center items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div>
                  <p className="text-sm text-foreground-500">Current Funding Rate</p>
                  <p className="font-bold">{fundingRate.toFixed(4)}%</p>
                </div>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">Accumulated Funding</p>
                <p className="font-bold">{(accumulatedFundingRate / 10000).toFixed(4)}%</p>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">Total Volume</p>
                <p className="font-bold">${(volume / 1000).toFixed(2)}K</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* User Position Display */}
        {userPosition && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-indigo-800">
            <CardBody className="py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <Badge color={userPosition.isLong ? "success" : "danger"} variant="solid" size="lg">
                    {userPosition.isLong ? "LONG" : "SHORT"} {userPosition.leverage}x
                  </Badge>
                  <div>
                    <p className="text-sm text-foreground-500">Position Size</p>
                    <p className="font-bold text-lg">${userPosition.size.toFixed(2)}</p>
                  </div>
                  <Divider orientation="vertical" className="h-8" />
                  <div>
                    <p className="text-sm text-foreground-500">Entry Price</p>
                    <p className="font-bold">${userPosition.entryPrice.toFixed(2)}</p>
                  </div>
                  <Divider orientation="vertical" className="h-8" />
                  <div>
                    <p className="text-sm text-foreground-500">Collateral</p>
                    <p className="font-bold">${userPosition.collateral.toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground-500">Unrealized PnL</p>
                  <p className={`font-bold text-2xl ${userPosition.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                    {userPosition.pnl >= 0 ? '+' : ''}${userPosition.pnl.toFixed(2)}
                  </p>
                  <p className="text-xs text-foreground-400">
                    {((userPosition.pnl / userPosition.collateral) * 100).toFixed(2)}% ROI
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Price Display */}
          <Card className="lg:col-span-2 bg-content1">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-success" />
                  <h3 className="text-xl font-bold">ETH/USDT</h3>
                </div>
                <Badge color="success" variant="solid">Live</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Main Price */}
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold tracking-tight">
                  ${currentPrice ? currentPrice.toFixed(2) : 'Loading...'}
                </span>
                {currentPrice > 0 && (
                  <div className={`flex items-center space-x-2 ${priceChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {priceChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    <span className="font-semibold text-lg">
                      {priceChange >= 0 ? '+' : ''}${Math.abs(priceChange).toFixed(2)}
                    </span>
                    <Chip
                      color={priceChange >= 0 ? "success" : "danger"}
                      variant="flat"
                    >
                      {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                    </Chip>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              <div className="space-y-3">
                <Divider />
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-warning" />
                    <span className="text-sm">Funding Rate</span>
                  </div>
                  <span className="font-semibold">{fundingRate.toFixed(4)}%</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-secondary" />
                    <span className="text-sm">Next Funding</span>
                  </div>
                  <span className="font-semibold">8h</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-sm">24h Volume</span>
                  </div>
                  <span className="font-semibold">${(volume / 1000).toFixed(2)}K</span>
                </div>
              </div>

              {/* Price Movement Indicator */}
              <div className="bg-default-50 dark:bg-default-100/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-default-600 font-medium">Price Movement</span>
                  <span className="text-xs text-default-500">
                    Range: ${currentPrice ? (currentPrice * 0.95).toFixed(0) : 'N/A'} - ${currentPrice ? (currentPrice * 1.05).toFixed(0) : 'N/A'}
                  </span>
                </div>
                <Progress
                  aria-label="Price movement indicator"
                  value={Math.max(0, Math.min(100, priceChangePercent + 50))}
                  color={priceChange >= 0 ? "success" : "danger"}
                  size="sm"
                  classNames={{
                    indicator: "bg-gradient-to-r " + (priceChange >= 0 ? "from-success-400 to-success-600" : "from-danger-400 to-danger-600")
                  }}
                />
              </div>
            </CardBody>
          </Card>

          {/* Trading Panel */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-warning" />
                <h3 className="text-xl font-bold">Trading Panel</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center space-x-1">
                    <DollarSign size={14} />
                    <span>Base Amount (USDT)</span>
                  </label>
                  <Input
                    type="number"
                    value={baseAmount.toString()}
                    onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter amount"
                    size="lg"
                    startContent={<DollarSign size={16} className="text-foreground-400" />}
                    classNames={{
                      input: "text-lg font-mono",
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Leverage</label>
                    <Chip color={leverageColor} variant="flat" size="lg">
                      {leverage}×
                    </Chip>
                  </div>
                  <Slider
                    aria-label="Leverage selector"
                    size="lg"
                    step={1}
                    minValue={1}
                    maxValue={50}
                    value={leverage}
                    onChange={(value) => setLeverage(Array.isArray(value) ? value[0] : value)}
                    color={leverageColor}
                    className="max-w-full"
                    marks={[
                      { value: 1, label: "1×" },
                      { value: 10, label: "10×" },
                      { value: 25, label: "25x" },
                      { value: 50, label: "50x" },
                    ]}
                    isDisabled={isLoading}
                  />
                </div>
              </div>

              {/* Position Size Display */}
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
                <CardBody className="py-4">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground-600">Position Size</span>
                    <span className="text-2xl font-bold text-violet-600">
                      ${positionSize.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-foreground-500">
                    Margin: ${baseAmount.toLocaleString()} • Risk Level: {leverage <= 10 ? 'Low' : leverage <= 25 ? 'Medium' : 'High'}
                  </div>
                </CardBody>
              </Card>

              {/* Trading Actions */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  color="success"
                  size="lg"
                  onPress={() => openPosition(true)}
                  startContent={<TrendingUp size={20} />}
                  className="h-14 font-bold text-lg"
                  isLoading={isLoading}
                  isDisabled={isLoading || !address || isOpen}
                >
                  {isLoading ? "Processing..." : "Long"}
                </Button>
                <Button
                  color="danger"
                  size="lg"
                  onPress={() => openPosition(false)}
                  startContent={<TrendingDown size={20} />}
                  className="h-14 font-bold text-lg"
                  isLoading={isLoading}
                  isDisabled={isLoading || !address || isOpen}
                >
                  {isLoading ? "Processing..." : "Short"}
                </Button>
              </div>
              <Button
                color="primary"
                size="lg"
                onPress={closePosition}
                startContent={<Target size={20} />}
                className="w-full h-14 font-bold text-lg"
                isLoading={isLoading}
                isDisabled={isLoading || !address || !isOpen}
              >
                {isLoading ? "Processing..." : "Close Position"}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Position Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Long/Short Distribution Pie Chart */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"></div>
                <h3 className="text-lg font-bold">Position Distribution</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="relative" style={{ minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={5}
                      dataKey="value"
                      aria-label="Position distribution chart"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${(Number(value) / 1000).toFixed(2)}K`, 'Value']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stats */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full w-24 h-24 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-violet-600">{longShortRatio.toFixed(1)}%</p>
                    <p className="text-xs text-foreground-500">Long</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex justify-center space-x-8 mt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-success shadow-sm"></div>
                  <div className="text-sm">
                    <p className="font-semibold">Long</p>
                    <p className="text-xs text-foreground-500">${(positionStats.totalLong / 1000).toFixed(1)}K</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-danger shadow-sm"></div>
                  <div className="text-sm">
                    <p className="font-semibold">Short</p>
                    <p className="text-xs text-foreground-500">${(positionStats.totalShort / 1000).toFixed(1)}K</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Collateral Comparison Bar Chart */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-cyan-800">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <h3 className="text-lg font-bold">Collateral Analysis</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart 
                  data={collateralData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  aria-label="Collateral comparison chart"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    style={{ fontSize: '12px', fontWeight: '600' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${(Number(value) / 1000).toFixed(2)}K`,
                      name === 'collateral' ? 'Collateral' : 'Position Value'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                  <Bar dataKey="collateral" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="positions" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex justify-center space-x-6 mt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-blue-500 shadow-sm"></div>
                  <span className="text-xs font-medium">Collateral</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-cyan-500 shadow-sm"></div>
                  <span className="text-xs font-medium">Position Value</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Metrics Dashboard */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-teal-800">
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <h3 className="text-lg font-bold">Key Metrics</h3>
              </div>
            </CardHeader>
            <CardBody className="pt-0 space-y-4">
              {/* Total Volume */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600 font-medium">Total Volume</span>
                  <span className="font-bold text-lg text-emerald-600">
                    ${((positionStats.totalLong + positionStats.totalShort) / 1000).toFixed(2)}K
                  </span>
                </div>
                <Progress
                  aria-label="Total volume progress"
                  value={Math.min(100, ((positionStats.totalLong + positionStats.totalShort) / 5000000) * 100)}
                  color="primary"
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Leverage Ratio */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600 font-medium">Avg Leverage</span>
                  <span className="font-bold text-lg text-amber-600">
                    {((positionStats.totalLongCollateral + positionStats.totalShortCollateral) > 0
                      ? (positionStats.totalLong + positionStats.totalShort) / (positionStats.totalLongCollateral + positionStats.totalShortCollateral)
                      : 0).toFixed(1)}x
                  </span>
                </div>
                <Progress
                  aria-label="Average leverage progress"
                  value={Math.min(100, ((positionStats.totalLongCollateral + positionStats.totalShortCollateral) > 0
                    ? ((positionStats.totalLong + positionStats.totalShort) / (positionStats.totalLongCollateral + positionStats.totalShortCollateral)) * 2
                    : 0))}
                  color="warning"
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Funding Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600 font-medium">Funding Rate</span>
                  <Chip
                    color={positionStats.fundingRateAccumulated >= 0 ? "success" : "danger"}
                    variant="flat"
                    size="sm"
                  >
                    {positionStats.fundingRateAccumulated >= 0 ? '+' : ''}
                    {(positionStats.fundingRateAccumulated).toFixed(4)}%
                  </Chip>
                </div>
              </div>

              {/* Long/Short Imbalance Indicator */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600 font-medium">Market Sentiment</span>
                  <Badge
                    color={longShortRatio > 55 ? "success" : longShortRatio < 45 ? "danger" : "primary"}
                    variant="flat"
                  >
                    {longShortRatio > 55 ? "Bullish" : longShortRatio < 45 ? "Bearish" : "Neutral"}
                  </Badge>
                </div>
                <div className="relative h-3 bg-gradient-to-r from-danger-200 to-danger-300 dark:from-danger-900 dark:to-danger-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-success-400 to-success-500 transition-all duration-500 shadow-sm"
                    style={{ width: `${longShortRatio}%` }}
                    aria-label="Long vs short ratio indicator"
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-foreground-500 font-medium">
                  <span>← Short</span>
                  <span className="text-foreground-400">{longShortRatio.toFixed(0)}% Long</span>
                  <span>Long →</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Risk Notice */}
        <Card className="bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-800">
          <CardBody className="py-3">
            <div className="flex items-center justify-center space-x-2 text-warning-700 dark:text-warning-300">
              <Zap size={16} />
              <span className="text-sm font-medium">
                High leverage trading involves substantial risk of loss. Trade responsibly.
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}