import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { Badge } from "@heroui/badge";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { TrendingUp, TrendingDown, Target, Zap, Activity, DollarSign } from "lucide-react";
import { useAccount } from "wagmi";
import { readContract, writeContract, } from '@wagmi/core';
import { parseUnits } from 'ethers';
import { config } from "@/config/wagmi-config";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

import { Clock, Volume2 } from "lucide-react";

import POSITION_MANAGER_ABI from "@/abis/positionManager.json";
import VAMM_ABI from "@/abis/vamm.json";
import POSITION_NFT_ABI from "@/abis/positionNft.json";


const POSITION_MANAGER_ADDRESS = import.meta.env.VITE_POSITION_MANAGER_ADDRESS;
const VAMM_ADDRESS = import.meta.env.VITE_VAMM_ADDRESS;
const POSITION_NFT_ADDRESS = import.meta.env.VITE_POSITION_NFT_ADDRESS;

export default function TradingPage() {
  const { address } = useAccount();
  const [baseAmount, setBaseAmount] = useState(10);
  const [leverage, setLeverage] = useState(10);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [fundingRate, setFundingRate] = useState(0);
  const [position, setPosition] = useState("");
  const [priceChange, setPriceChange] = useState(0);
  const [volume, setVolume] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [positionStats, setPositionStats] = useState({
    totalLong: 0,
    totalShort: 0,
    totalLongCollateral: 0,
    totalShortCollateral: 0,
    fundingRateAccumulated: 0
  });
  type PricePoint = {
    time: string;
    price: number;
    timestamp: number;
  };

  const [priceData, setPriceData] = useState<PricePoint[]>([]);

  // Add this function to generate and update price data
  const updatePriceData = () => {
    const now = new Date();
    const newPoint = {
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: currentPrice || 0,
      timestamp: now.getTime()
    };

    setPriceData(prev => {
      const updated = [...prev, newPoint];
      // Keep only last 20 points
      return updated.slice(-20);
    });
  };

  const pieChartData = [
    {
      name: 'Long Positions',
      value: positionStats.totalLong,
      color: '#22c55e'
    },
    {
      name: 'Short Positions',
      value: positionStats.totalShort,
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
  const longShortRatio = positionStats.totalLong / (positionStats.totalLong + positionStats.totalShort) * 100;


  const getPosition = async () => {
    const price = await readContract(config, {
      address: POSITION_NFT_ADDRESS,
      abi: POSITION_NFT_ABI,
      functionName: "getUserPositions",
      args: [address],
    })
  }

  const getCurrentPrice = async () => {
    const price = await readContract(config, {
      address: VAMM_ADDRESS,
      abi: VAMM_ABI,
      functionName: "getCurrentPrice",
      account: address,
    }) as [bigint, boolean];

    setCurrentPrice((Number(price[0])) / 1e18);
    return price;
  };

  const getFundingRate = async () => {
    const rate = await readContract(config, {
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "getCurrentFundingRate",
      account: address
    })
    setFundingRate(Number(rate) / 100);
  }

  const getPositionStats = async () => {
    try {
      const stats = await readContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "getPositionStats",
        account: address,
      }) as [bigint, bigint, bigint, bigint, bigint];

      // Assuming the contract returns [totalLong, totalShort, totalLongCollateral, totalShortCollateral, fundingRateAccumulated]
      setPositionStats({
        totalLong: Number(stats[0]) / 1e18,
        totalShort: Number(stats[1]) / 1e18,
        totalLongCollateral: Number(stats[2]) / 1e18,
        totalShortCollateral: Number(stats[3]) / 1e18,
        fundingRateAccumulated: Number(stats[4]) / 1e18
      });

      const totalVolume = stats[0] + stats[1];
      setVolume(Number(totalVolume) / 1e18);
    } catch (error) {
      console.error("Error fetching position stats:", error);
    }
  };

  const openPosition = async (isLong: boolean) => {
    const amount = parseUnits(baseAmount.toString(), 18);
    console.log(amount);
    try {
      await writeContract(config, {
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "openPosition",
        args: [amount, leverage, isLong],
        account: address,
      })

      isLong ? setPosition("long") : setPosition("short");
      setIsOpen(true)
    }
    catch (error) {
      setIsOpen(false);
      setPosition("");
      console.error("Error opening trade:", error);
    }
  }

  const closePosition = async () => {
    const id = await getPosition();

    await writeContract(config, {
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "closePosition",
      args: [id],
      account: address,
    })

  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      getCurrentPrice();
      getFundingRate();
      getPositionStats();
      if (currentPrice) {
        updatePriceData();
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);



  const positionSize = baseAmount * leverage;
  const priceChangePercent = (priceChange / Number(currentPrice)) * 100;
  const leverageColor = leverage <= 10 ? "success" : leverage <= 25 ? "warning" : "danger";

  return (

    <div className="min-h-screen p-6 bg-gradient-to-br from-background to-default-100">
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
            <div className="flex justify-center items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div>
                  <p className="text-sm text-foreground-500">Funding Rate</p>
                  <p className="font-bold">{fundingRate}%</p>
                </div>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">Total Volume</p>
                <p className="font-bold">${(volume / 1000).toFixed(0)}K</p>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">Funding Rate</p>
                <p className="font-bold">${fundingRate}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Price Display */}
          {/* Price Display with Market Stats Panel */}
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
                  ${currentPrice?.toFixed ? currentPrice.toFixed(2) : 'N/A'}
                </span>
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
              </div>

              {/* Stats Grid
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center bg-default-50 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-sm text-default-600">24h High</span>
                  </div>
                  <p className="font-bold">${currentPrice ? (currentPrice * 1.05).toFixed(2) : 'N/A'}</p>
                </div>

                <div className="text-center bg-default-50 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <TrendingDown className="w-4 h-4 text-danger" />
                    <span className="text-sm text-default-600">24h Low</span>
                  </div>
                  <p className="font-bold">${currentPrice ? (currentPrice * 0.95).toFixed(2) : 'N/A'}</p>
                </div>

                <div className="text-center bg-default-50 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <Volume2 className="w-4 h-4 text-primary" />
                    <span className="text-sm text-default-600">24h Volume</span>
                  </div>
                  <p className="font-bold">${(volume * 1000).toLocaleString()}</p>
                </div>
              </div> */}

              {/* Additional Info */}
              <div className="space-y-3">
                <Divider />
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-warning" />
                    <span className="text-sm">Funding Rate</span>
                  </div>
                  <span className="font-semibold">{fundingRate}%</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-secondary" />
                    <span className="text-sm">Next Funding</span>
                  </div>
                  <span className="font-semibold">2h 15m</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-sm">Open Interest</span>
                  </div>
                  <span className="font-semibold">$45.2M</span>
                </div>
              </div>

              {/* Price Movement Indicator */}
              <div className="bg-default-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-default-600">Price Movement (24h)</span>
                  <span className="text-xs text-default-500">Range: ${currentPrice ? (currentPrice * 0.95).toFixed(0) : 'N/A'} - ${currentPrice ? (currentPrice * 1.05).toFixed(0) : 'N/A'}</span>
                </div>
                <Progress
                  value={priceChangePercent + 50} // Center at 50%
                  color={priceChange >= 0 ? "success" : "danger"}
                  size="sm"
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
                >
                  Long
                </Button>
                <Button
                  color="danger"
                  size="lg"
                  onPress={() => openPosition(false)}
                  startContent={<TrendingDown size={20} />}
                  className="h-14 font-bold text-lg"
                >
                  Short
                </Button>
              </div>
              <Button
                color="primary"
                size="lg"
                onPress={closePosition}
                startContent={<Target size={20} />}
                className="w-full h-14 font-bold text-lg"
              >
                Close Position
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
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${(Number(value) / 1000).toFixed(0)}K`, 'Value']} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stats */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{longShortRatio.toFixed(1)}%</p>
                    <p className="text-xs text-foreground-500">Long Ratio</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <span className="text-sm">Long</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-danger"></div>
                  <span className="text-sm">Short</span>
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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={collateralData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    formatter={(value, name) => [
                      `$${(Number(value) / 1000).toFixed(2)}K`,
                      name === 'collateral' ? 'Collateral' : 'Position Value'
                    ]}
                  />
                  <Bar dataKey="collateral" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="positions" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                  <span className="text-sm text-foreground-600">Total Volume</span>
                  <span className="font-bold text-lg">
                    ${((positionStats.totalLong + positionStats.totalShort) / 1000).toFixed(2)}K
                  </span>
                </div>
                <Progress
                  value={((positionStats.totalLong + positionStats.totalShort) / 5000000) * 100}
                  color="primary"
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Leverage Ratio */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600">Avg Leverage</span>
                  <span className="font-bold text-lg">
                    {((positionStats.totalLong + positionStats.totalShort) /
                      (positionStats.totalLongCollateral + positionStats.totalShortCollateral)).toFixed(1)}x
                  </span>
                </div>
                <Progress
                  value={((positionStats.totalLong + positionStats.totalShort) /
                    (positionStats.totalLongCollateral + positionStats.totalShortCollateral)) * 2}
                  color="warning"
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Funding Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600">Funding Rate</span>
                  <Chip
                    color={positionStats.fundingRateAccumulated >= 0 ? "success" : "danger"}
                    variant="flat"
                    size="sm"
                  >
                    {positionStats.fundingRateAccumulated >= 0 ? '+' : ''}
                    {(positionStats.fundingRateAccumulated * 100).toFixed(4)}%
                  </Chip>
                </div>
              </div>

              {/* Long/Short Imbalance Indicator */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-600">Market Sentiment</span>
                  <Badge
                    color={longShortRatio > 55 ? "success" : longShortRatio < 45 ? "danger" : "primary"}
                    variant="flat"
                  >
                    {longShortRatio > 55 ? "Bullish" : longShortRatio < 45 ? "Bearish" : "Neutral"}
                  </Badge>
                </div>
                <div className="relative h-2 bg-danger-200 dark:bg-danger-900 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-success transition-all duration-500"
                    style={{ width: `${longShortRatio}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-foreground-500">
                  <span>Short</span>
                  <span>Long</span>
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