import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { Badge } from "@heroui/badge";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { Avatar } from "@heroui/avatar";
import { TrendingUp, TrendingDown, Target, Zap, Activity, DollarSign } from "lucide-react";
import {useAccount} from "wagmi";
import { readContract, writeContract, } from '@wagmi/core';
import { ethers } from 'ethers';


import POSITION_MANAGER_ABI from "@/abis/positionManager.json";
import VAMM_ABI from "@/abis/vamm.json";
import { write } from "fs";
import { config } from "@/config/wagmi-config";
import { setInterval } from "timers/promises";

const POSITION_MANAGER_ADDRESS = import.meta.env.VITE_POSITION_MANAGER_ADDRESS;
const VAMM_ADDRESS = import.meta.env.VITE_VAMM_ADDRESS;

export default function TradingPage() {
  const { address } = useAccount();
  const [baseAmount, setBaseAmount] = useState(1000);
  const [leverage, setLeverage] = useState(10);
  const [currentPrice, setCurrentPrice] = useState();
  const [fundingRate, setFundingRate] = useState();
  const [entryPrice, setEntryPrice] = useState(0);
  const [position, setPosition] = useState("");
  const [pnl, setPnl] = useState(0);
  const [priceChange, setPriceChange] = useState(1247.82);
  const [volume, setVolume] = useState(2456789);
  const [isOpen, setIsOpen] = useState(false);
  

  const getCurrentPrice = async () => {
    const price = await readContract(config, {
      address: VAMM_ADDRESS,
      abi: VAMM_ABI,
      functionName: "getCurrentPrice",
      account: address,
    })
    setCurrentPrice(Number(price[0])/1e8);
    return price;
  };

  // const getFundingRate = async () => {
  //   const rate = readContract(config,{
  //     address: POSITION_MANAGER_ADDRESS,
  //     abi: POSITION_MANAGER_ABI,
  //     functionName: "updateFundingRate",
  //     account: address
  //   })
  //   console.log(rate);
  //   setFundingRate(rate);
  // }

  const openPosition = async (isLong) => {
    try{
      await writeContract(config,{
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: "openPosition",
        args:[baseAmount, leverage, isLong],
        account:address,
      })

      isLong ? setPosition("long") : setPosition("short");
      setIsOpen(true)
    }
    catch(error){
      setIsOpen(false);
      setPosition("");
      console.error("Error opening trade:", error);
    }
  }

  const closePosition = async () => {

  }

  useEffect(() => {
    getCurrentPrice();
    // getFundingRate();
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
                  <p className="font-bold">${fundingRate}</p>
                </div>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">24h Volume</p>
                <p className="font-bold">${(volume / 1000).toFixed(0)}K</p>
              </div>
              <Divider orientation="vertical" className="h-8" />
              <div>
                <p className="text-sm text-foreground-500">Dominance</p>
                <p className="font-bold">52.3%</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* Price Display */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-content1 to-content2">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-success" />
                  <h3 className="text-xl font-bold">BTC/USDT</h3>
                </div>
                <Badge color="success" variant="dot">Live</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold tracking-tight">
                  ${currentPrice}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className={`flex items-center space-x-2 ${
                  priceChange >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {priceChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  <span className="font-semibold text-lg">
                    {priceChange >= 0 ? '+' : ''}${Math.abs(priceChange).toFixed(2)}
                  </span>
                </div>
                <Chip 
                  color={priceChange >= 0 ? "success" : "danger"} 
                  variant="flat"
                  size="lg"
                >
                  {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </Chip>
              </div>

              <Progress 
                value={Math.abs(priceChangePercent) * 10} 
                color={priceChange >= 0 ? "success" : "danger"}
                className="max-w-full"
                size="sm"
              />
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
              {!position ? (
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
              ) : (
                <div className="space-y-4">
                  {/* Active Position Card */}
                  <Card className={`border-2 ${
                    position === "long" 
                      ? "border-success bg-success-50 dark:bg-success-950/20" 
                      : "border-danger bg-danger-50 dark:bg-danger-950/20"
                  }`}>
                    <CardBody className="py-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <Chip 
                            color={position === "long" ? "success" : "danger"} 
                            variant="solid" 
                            size="lg"
                            className="font-bold"
                          >
                            {position.toUpperCase()}
                          </Chip>
                          <div>
                            <p className="font-bold">ETH/USDT</p>
                            <p className="text-xs text-foreground-500">Perpetual</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-foreground-500">Entry</p>
                          <p className="font-bold">${entryPrice.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* PnL Display */}
                  <Card className="bg-gradient-to-r from-content1 to-content2">
                    <CardBody className="py-6">
                      <div className="text-center space-y-2">
                        <p className="text-sm text-foreground-500">Unrealized PnL</p>
                        <p className={`text-4xl font-bold ${
                          pnl >= 0 ? "text-success" : "text-danger"
                        }`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </p>
                        <Chip 
                          color={pnl >= 0 ? "success" : "danger"} 
                          variant="flat"
                          size="lg"
                        >
                          ROI: {pnl >= 0 ? "+" : ""}{((pnl / baseAmount) * 100).toFixed(2)}%
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>

                  <Button
                    color="primary"
                    size="lg"
                    onPress={closePosition}
                    startContent={<Target size={20} />}
                    className="w-full h-14 font-bold text-lg"
                  >
                    Close Position
                  </Button>
                </div>
              )}
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