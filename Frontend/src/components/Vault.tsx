import React, { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Gift } from "lucide-react";
import {useAccount} from "wagmi";
import { readContract, writeContract, } from '@wagmi/core';
import { parseUnits, formatUnits } from "viem";
import { config } from "@/config/wagmi-config";


// Replace with your real addresses & ABIs
import VUSDT_ABI from "@/abis/vusdt.json";
import VAULT_ABI from "@/abis/vault.json";

const VUSDT_ADDRESS = import.meta.env.VITE_VUSDT_ADDRESS;
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;

export default function VaultPage() {
  const { address } = useAccount();
  const [vusdtBalance, setVusdtBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [activeField, setActiveField] = useState<'deposit' | 'withdraw'>('deposit');
  const [userCollateral, setUserCollateral] = useState({
    deposited: '',
    locked: '',
    available: '',
  });


  const loadBalances = async () => {
    if (!address) return;

    try {
      const [vusdtBal, userCollateral] = await Promise.all([
        readContract(config, {
          address: VUSDT_ADDRESS,
          abi: VUSDT_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),

        readContract(config, {
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'getUserCollateral',
          account: address,
        }),
      ]);

      setUserCollateral({
        deposited: formatUnits(userCollateral.depositedBalance, 18),
        locked: formatUnits(userCollateral.lockedBalance, 18),
        available: formatUnits(userCollateral.availableBalance, 18),
      });

      setVusdtBalance(formatUnits(vusdtBal as bigint, 18));

    } catch (error) {
      console.error("Failed to load balances:", error);
    }
  };

  const handleAirdrop = async () => {
    console.log("Airdropping 1000 vUSDT to", address);
    await writeContract(config, {
      address: VUSDT_ADDRESS,
      abi: VUSDT_ABI,
      functionName: 'airDrop',
      args: [address],
      gas: BigInt(60000), // conservative gas limit
      maxFeePerGas: BigInt(30e9), // 30 Gwei
      maxPriorityFeePerGas: BigInt(2e9), // 2 Gwei
    });
    await loadBalances();
  };


  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }

    try {
      setIsDepositing(true);

      const amt = parseUnits(depositAmount, 18);

      console.log("check approval");
      const allowance = await readContract(config, {
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: 'allowance',
        args: [address, VAULT_ADDRESS],
      });

      console.log("Current allowance:", formatUnits(allowance, 18));
      if (allowance < amt) {
        await writeContract(config, {
          address: VUSDT_ADDRESS,
          abi: VUSDT_ABI,
          functionName: 'approve',
          args: [VAULT_ADDRESS, amt],
        });
      }
 
      console.log("Depositing");
      await writeContract(config, {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'depositCollateral',
        args: [amt],
      });

      console.log("Deposit successful");
      setDepositAmount('');
      await loadBalances();
    } catch (error) {
        console.error("Deposit failed:", error);
        alert("Deposit failed. Check console for details.");
    } finally {
      setIsDepositing(false);
    }
  };


  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }

    try {
      setIsWithdrawing(true);

      const amt = parseUnits(withdrawAmount, 18);

      console.log("Withdrawing");
      await writeContract(config, {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdrawCollateral',
        args: [amt],
      });

      console.log("Withdraw successful");
      setWithdrawAmount('');
      await loadBalances();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      alert("Withdrawal failed. Check console for details.");
    } finally {
      setIsWithdrawing(false);
    }
  };


  useEffect(() => {
    if (address) loadBalances();
  }, [address, handleAirdrop, handleDeposit, handleWithdraw]);


  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            Manage <span className="text-violet-600">Vault</span> Funds
          </h1>
          <p className="text-foreground-500">Securely deposit, withdraw, and track your vUSDT</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Wallet Overview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Wallet className="text-primary" size={18} />
                <h3 className="text-lg font-semibold">Wallet Overview</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">Deposited Balance</span>
                  <Chip color="primary" variant="flat" size="sm">
                    {parseFloat(userCollateral.deposited).toFixed(4)} vUSDT
                  </Chip>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">Locked Balance</span>
                  <Chip color="primary" variant="flat" size="sm">
                    {parseFloat(userCollateral.locked).toFixed(4)} vUSDT
                  </Chip>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">vUSDT Balance</span>
                  <Chip color="secondary" variant="flat" size="sm">
                    {parseFloat(vusdtBalance).toFixed(4)} vUSDT
                  </Chip>
                </div>
              </div>

              <Divider />
              <div className="bg-default-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">Vault Balance</span>
                  <span className="font-semibold text-lg text-success">
                    {parseFloat(userCollateral.available).toFixed(4)} vUSDT
                  </span>
                </div>
              </div>
              <Button
                color="success"
                size="lg"
                onPress={handleAirdrop}
                startContent={<Gift size={18} />}
                className="w-full"
              >
                Airdrop 1000 vUSDT
              </Button>
            </CardBody>
          </Card>

          {/* Vault Operations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <h3 className="text-xl font-semibold">Vault Operations</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Deposit Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <ArrowUpCircle className="text-success" size={18} />
                    <h4 className="font-medium">Deposit to Vault</h4>
                  </div>
                  <Input
                    type="number"
                    label="Amount (vUSDT)"
                    placeholder="Enter deposit amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    onFocus={() => setActiveField('deposit')}
                    size="lg"
                  />
                  <Button
                    color="success"
                    size="lg"
                    onPress={handleDeposit}
                    startContent={<ArrowUpCircle size={18} />}
                    className="w-full"
                    isDisabled={!depositAmount || parseFloat(depositAmount) <= 0}
                  >
                    {isDepositing ? "Depositing..." : "Deposit"}
                  </Button>
                </div>

                {/* Withdraw Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <ArrowDownCircle className="text-danger" size={18} />
                    <h4 className="font-medium">Withdraw from Vault</h4>
                  </div>
                  <Input
                    type="number"
                    label="Amount (vUSDT)"
                    placeholder="Enter withdraw amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    onFocus={() => setActiveField('withdraw')}
                    size="lg"
                  />
                  <Button
                    color="danger"
                    variant="bordered"
                    size="lg"
                    onPress={handleWithdraw}
                    startContent={<ArrowDownCircle size={18} />}
                    className="w-full"
                    isDisabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  >
                    {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-default-100 p-4 rounded-lg">
                <h5 className="font-medium mb-3">Quick Actions</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      const value =
                        activeField === 'deposit'
                          ? (parseFloat(vusdtBalance) * 0.25).toString()
                          : (parseFloat(userCollateral.deposited) * 0.25).toString();

                        activeField === 'deposit' ? setWithdrawAmount("") : setDepositAmount("");

                        activeField === 'deposit'
                          ? setDepositAmount(value)
                          : setWithdrawAmount(value);
                    }}
                  >
                    25%
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      const value =
                        activeField === 'deposit'
                          ? (parseFloat(vusdtBalance) * 0.5).toString()
                          : (parseFloat(userCollateral.deposited) * 0.5).toString();

                        activeField === 'deposit' ? setWithdrawAmount("") : setDepositAmount("");

                        activeField === 'deposit'
                          ? setDepositAmount(value)
                          : setWithdrawAmount(value);
                    }}
                  >
                    50%
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      const value =
                        activeField === 'deposit'
                          ? (parseFloat(vusdtBalance) * 0.75).toString()
                          : (parseFloat(userCollateral.deposited) * 0.75).toString();

                        activeField === 'deposit' ? setWithdrawAmount("") : setDepositAmount("");

                        activeField === 'deposit'
                          ? setDepositAmount(value)
                          : setWithdrawAmount(value);
                    }}
                  >
                    75%
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      const value =
                        activeField === 'deposit'
                          ? parseFloat(vusdtBalance).toString()
                          : parseFloat(userCollateral.deposited).toString();

                        activeField === 'deposit' ? setWithdrawAmount("") : setDepositAmount("");

                        activeField === 'deposit'
                          ? setDepositAmount(value)
                          : setWithdrawAmount(value);
                    }}
                  >
                    Max
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Security Notice */}
        <Card className="bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-800">
          <CardBody className="py-3">
            <div className="flex items-center justify-center space-x-2 text-warning-700 dark:text-warning-300">
              <Wallet size={16} />
              <span className="text-sm">
                Always verify contract addresses and transaction details before confirming.
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}