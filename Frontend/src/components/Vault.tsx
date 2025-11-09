import React, { useEffect, useState, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Gift } from "lucide-react";
import { useAccount } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { parseUnits, formatUnits } from "viem";
import { config } from "@/config/wagmi-config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [activeField, setActiveField] = useState<'deposit' | 'withdraw'>('deposit');
  const [userCollaterals, setUserCollaterals] = useState({
    locked: '',
    available: '',
  });

  const toastIdRef = useRef<any>(null);

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
      ]) as [bigint, { lockedBalance: bigint; availableBalance: bigint }];

      setUserCollaterals({
        locked: formatUnits(userCollateral.lockedBalance, 18),
        available: formatUnits(userCollateral.availableBalance, 18),
      });

      setVusdtBalance(formatUnits(vusdtBal as bigint, 18));
    } catch (error) {
      console.error("Failed to load balances:", error);
    }
  };

  const handleAirdrop = async () => {
    if (!address || isAirdropping) return;

    setIsAirdropping(true);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    try {
      toastIdRef.current = toast.info("Preparing airdrop...", { autoClose: false });

      const tx = await writeContract(config, {
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: 'airDrop',
        args: [address],
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
            render: "✅ Airdrop successful! 10,000 vUSDT received.",
            type: "success",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadBalances();
      } else {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "❌ Airdrop failed. Please try again.",
            type: "error",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
      }
    } catch (error: any) {
      console.error("Airdrop failed:", error);

      let errorMessage = "Airdrop failed.";
      
      if (error?.message) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas fees.";
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
      setIsAirdropping(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      toast.error("❌ Please enter a valid deposit amount.", { autoClose: 3000 });
      return;
    }

    if (!address) {
      toast.error("❌ Please connect your wallet.", { autoClose: 3000 });
      return;
    }

    setIsDepositing(true);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    try {
      const amt = parseUnits(depositAmount, 18);

      const allowance = await readContract(config, {
        address: VUSDT_ADDRESS,
        abi: VUSDT_ABI,
        functionName: 'allowance',
        args: [address, VAULT_ADDRESS],
      }) as bigint;

      if (allowance < amt) {
        toastIdRef.current = toast.info("Approving tokens...", { autoClose: false });

        const approveTx = await writeContract(config, {
          address: VUSDT_ADDRESS,
          abi: VUSDT_ABI,
          functionName: 'approve',
          args: [VAULT_ADDRESS, amt],
        });

        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "Waiting for approval confirmation...",
            type: "info",
            autoClose: false
          });
        }

        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveTx });
        
        if (approveReceipt.status === "success") {
          if (toastIdRef.current) {
            toast.update(toastIdRef.current, {
              render: "✅ Approval successful!",
              type: "success",
              autoClose: 2000
            });
          }
          toastIdRef.current = null;
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          if (toastIdRef.current) {
            toast.update(toastIdRef.current, {
              render: "❌ Approval failed.",
              type: "error",
              autoClose: 5000
            });
          }
          toastIdRef.current = null;
          setIsDepositing(false);
          return;
        }
      }

      toastIdRef.current = toast.info("Depositing collateral...", { autoClose: false });

      const depositTx = await writeContract(config, {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'depositCollateral',
        args: [amt],
      });

      if (toastIdRef.current) {
        toast.update(toastIdRef.current, {
          render: "Transaction sent. Waiting for confirmation...",
          type: "info",
          autoClose: false
        });
      }

      const receipt = await waitForTransactionReceipt(config, { hash: depositTx });

      if (receipt.status === "success") {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: `✅ Deposit successful! ${depositAmount} vUSDT deposited.`,
            type: "success",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
        setDepositAmount('');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadBalances();
      } else {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "❌ Deposit failed. Please try again.",
            type: "error",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
      }
    } catch (error: any) {
      console.error("Deposit failed:", error);

      let errorMessage = "Deposit failed.";
      
      if (error?.message) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas fees.";
        } else if (error.message.includes("InsufficientFunds")) {
          errorMessage = "Insufficient vUSDT balance.";
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
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      toast.error("❌ Please enter a valid withdrawal amount.", { autoClose: 3000 });
      return;
    }

    if (!address) {
      toast.error("❌ Please connect your wallet.", { autoClose: 3000 });
      return;
    }

    setIsWithdrawing(true);

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    try {
      const amt = parseUnits(withdrawAmount, 18);

      toastIdRef.current = toast.info("Withdrawing collateral...", { autoClose: false });

      const tx = await writeContract(config, {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdrawCollateral',
        args: [amt],
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
            render: `✅ Withdrawal successful! ${withdrawAmount} vUSDT withdrawn.`,
            type: "success",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
        setWithdrawAmount('');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadBalances();
      } else {
        if (toastIdRef.current) {
          toast.update(toastIdRef.current, {
            render: "❌ Withdrawal failed. Please try again.",
            type: "error",
            autoClose: 5000
          });
        }
        toastIdRef.current = null;
      }
    } catch (error: any) {
      console.error("Withdrawal failed:", error);

      let errorMessage = "Withdrawal failed.";
      
      if (error?.message) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas fees.";
        } else if (error.message.includes("InsufficientFunds")) {
          errorMessage = "Insufficient available balance.";
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
      setIsWithdrawing(false);
    }
  };

  useEffect(() => {
    if (address) loadBalances();
  }, [address]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen p-6 bg-background">
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
                  <span className="text-sm text-foreground-500">Available Balance</span>
                  <Chip color="success" variant="flat" size="sm">
                    {parseFloat(userCollaterals.available).toFixed(4)} vUSDT
                  </Chip>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">Locked Balance</span>
                  <Chip color="danger" variant="flat" size="sm">
                    {parseFloat(userCollaterals.locked).toFixed(4)} vUSDT
                  </Chip>
                </div>
              </div>

              <Divider />
              <div className="bg-default-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground-500">vUSDT Balance</span>
                  <span className="font-semibold text-lg text-success">
                    {parseFloat(vusdtBalance).toFixed(4)} vUSDT
                  </span>
                </div>
              </div>
              <Button
                color="success"
                size="lg"
                onPress={handleAirdrop}
                startContent={<Gift size={18} />}
                className="w-full"
                isLoading={isAirdropping}
                isDisabled={isAirdropping || !address}
              >
                {isAirdropping ? "Processing..." : "Airdrop 10,000 vUSDT"}
              </Button>
              <Button
                color="secondary"
                size="lg"
                onPress={loadBalances}
                startContent={<Wallet size={18} />}
                className="w-full"
                isDisabled={!address}
              >
                Refresh Balances
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
                    disabled={isDepositing}
                  />
                  <Button
                    color="success"
                    size="lg"
                    onPress={handleDeposit}
                    startContent={<ArrowUpCircle size={18} />}
                    className="w-full"
                    isLoading={isDepositing}
                    isDisabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing || !address}
                  >
                    {isDepositing ? "Processing..." : "Deposit"}
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
                    disabled={isWithdrawing}
                  />
                  <Button
                    color="danger"
                    variant="bordered"
                    size="lg"
                    onPress={handleWithdraw}
                    startContent={<ArrowDownCircle size={18} />}
                    className="w-full"
                    isLoading={isWithdrawing}
                    isDisabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawing || !address}
                  >
                    {isWithdrawing ? "Processing..." : "Withdraw"}
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
                          : (parseFloat(userCollaterals.available) * 0.25).toString();

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
                          : (parseFloat(userCollaterals.available) * 0.5).toString();

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
                          : (parseFloat(userCollaterals.available) * 0.75).toString();

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
                          : (userCollaterals.available).toString();

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