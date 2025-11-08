import React, { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Tab, Tabs } from "@heroui/tabs";

export default function Docs() {
  const [selectedTab, setSelectedTab] = useState("overview");

  return (
    <div className="">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">
            VaultEx <span className="text-violet-600">Documentation</span>
          </h1>
          <p className="text-foreground-500"> Perpetual Trading Platform API Reference</p>
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={setSelectedTab}
            variant="underlined"
            classNames={{
              tabList: "gap-8",
              tab: "px-0 h-10",
              cursor: "bg-blue-600",
              tabContent: "text-gray-600 dark:text-gray-400 group-data-[selected=true]:text-blue-600 dark:group-data-[selected=true]:text-blue-400"
            }}
          >
            <Tab key="overview" title="Overview" />
            <Tab key="trading" title="Trading" />
            <Tab key="vault" title="Vault" />
            <Tab key="reference" title="Reference" />
          </Tabs>
        </div>

        {/* Content */}
        <div className="px-6 py-8">

          {selectedTab === "overview" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Platform Overview</h2>

              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                A decentralized perpetual trading platform supporting ETH/USDT pairs with leverage up to 50x.
                The platform consists of two main components: the trading interface and vault management system.
              </p>

              <h3 className="text-xl font-medium mb-3">Core Components</h3>

              <div className="space-y-4 mb-8">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">Position Manager</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Handles opening, closing, and managing leveraged positions
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium">Vault System</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Manages collateral deposits, withdrawals, and balance tracking
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium">Virtual AMM</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Provides real-time pricing and handles trade execution
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">System Requirements</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Web3 wallet connection (MetaMask, WalletConnect)</li>
                <li>vUSDT tokens for collateral</li>
                <li>Sufficient gas fees for transactions</li>
              </ul>
            </div>
          )}

          {selectedTab === "trading" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Trading Operations</h2>

              <h3 className="text-xl font-medium mb-3">Opening Positions</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Positions can be opened in either long or short direction using the openPosition function.
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4 mb-6">
                <h4 className="font-mono text-sm mb-2">Function Signature</h4>
                <code className="text-sm">
                  openPosition(uint256 amount, uint256 leverage, bool isLong)
                </code>
              </div>

              <h4 className="font-medium mb-2">Parameters</h4>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <code className="text-sm">amount</code>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Base collateral amount in wei</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <code className="text-sm">leverage</code>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Multiplier (1-50)</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <code className="text-sm">isLong</code>
                  <span className="text-sm text-gray-600 dark:text-gray-400">true for long, false for short</span>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Leverage Limits</h3>
              <div className="space-y-2 mb-6">
                <div className="flex items-center space-x-3">
                  <Chip size="sm" variant="flat" color="success">1-10x</Chip>
                  <span className="text-sm">Low risk range</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Chip size="sm" variant="flat" color="warning">11-25x</Chip>
                  <span className="text-sm">Medium risk range</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Chip size="sm" variant="flat" color="danger">26-50x</Chip>
                  <span className="text-sm">High risk range</span>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Closing Positions</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Positions are closed using the position ID returned when opening a position.
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4">
                <code className="text-sm">closePosition(uint256 positionId)</code>
              </div>
            </div>
          )}

          {selectedTab === "vault" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Vault Management</h2>

              <h3 className="text-xl font-medium mb-3">Collateral System</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The vault manages two types of collateral balances for each user.
              </p>

              <div className="space-y-3 mb-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <h4 className="font-medium mb-1">Available Balance</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Collateral that can be used for new positions or withdrawn
                  </p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <h4 className="font-medium mb-1">Locked Balance</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Collateral currently backing open positions
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Deposit Process</h3>
              <ol className="list-decimal list-inside space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                <li>Approve vUSDT spending for vault contract</li>
                <li>Call depositCollateral with desired amount</li>
                <li>Funds become available for trading</li>
              </ol>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4 mb-6">
                <h4 className="font-mono text-sm mb-2">Function</h4>
                <code className="text-sm">depositCollateral(uint256 amount)</code>
              </div>

              <h3 className="text-xl font-medium mb-3">Withdrawal Process</h3>
              <ol className="list-decimal list-inside space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                <li>Ensure all positions are closed</li>
                <li>Call withdrawCollateral with amount</li>
                <li>Funds return to wallet</li>
              </ol>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4">
                <h4 className="font-mono text-sm mb-2">Function</h4>
                <code className="text-sm">withdrawCollateral(uint256 amount)</code>
              </div>
            </div>
          )}

          {selectedTab === "reference" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">API Reference</h2>

              <h3 className="text-xl font-medium mb-3">Contract Addresses</h3>
              <div className="space-y-2 mb-8">
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  <div className="text-gray-500 text-xs mb-1">POSITION_MANAGER</div>
                  <div>process.env.VITE_POSITION_MANAGER_ADDRESS</div>
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  <div className="text-gray-500 text-xs mb-1">VAMM</div>
                  <div>process.env.VITE_VAMM_ADDRESS</div>
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  <div className="text-gray-500 text-xs mb-1">VAULT</div>
                  <div>process.env.VITE_VAULT_ADDRESS</div>
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  <div className="text-gray-500 text-xs mb-1">VUSDT</div>
                  <div>process.env.VITE_VUSDT_ADDRESS</div>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Core Functions</h3>

              <h4 className="font-medium mb-2">Position Manager</h4>
              <div className="space-y-3 mb-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <code className="text-sm">openPosition</code>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">Opens a new leveraged position</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <div>Parameters: amount (uint256), leverage (uint256), isLong (bool)</div>
                      <div>Returns: Position ID</div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <code className="text-sm">closePosition</code>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">Closes an existing position</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <div>Parameters: positionId (uint256)</div>
                      <div>Returns: Settlement amount</div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <code className="text-sm">getCurrentFundingRate</code>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">Returns current funding rate</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <div>Parameters: None</div>
                      <div>Returns: Rate in basis points</div>
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="font-medium mb-2">Vault Contract</h4>
              <div className="space-y-3 mb-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <code className="text-sm">depositCollateral</code>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">Deposits vUSDT as collateral</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <div>Parameters: amount (uint256)</div>
                      <div>Requires: Token approval</div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <code className="text-sm">withdrawCollateral</code>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm">Withdraws available collateral</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <div>Parameters: amount (uint256)</div>
                      <div>Requires: No open positions</div>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Data Types</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4 text-sm font-mono">
                <div className="mb-2">UserCollateral:</div>
                <div className="ml-4 space-y-1">
                  <div>lockedBalance: uint256</div>
                  <div>availableBalance: uint256</div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === "trading" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Trading Guide</h2>

              <h3 className="text-xl font-medium mb-3">Position Lifecycle</h3>
              <div className="space-y-4 mb-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded p-4">
                  <h4 className="font-medium mb-2">1. Position Opening</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Set base amount, leverage, and direction before opening a position.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono">
                    const amount = parseUnits(baseAmount.toString(), 18);<br />
                    await openPosition(amount, leverage, isLong);
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded p-4">
                  <h4 className="font-medium mb-2">2. Position Monitoring</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Track position performance through real-time price updates.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono">
                    const price = await getCurrentPrice();<br />
                    const stats = await getPositionStats();
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded p-4">
                  <h4 className="font-medium mb-2">3. Position Closing</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Close positions to realize profits or limit losses.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono">
                    const positionId = await getUserPositions(address);<br />
                    await closePosition(positionId);
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Risk Management</h3>
              <div className="border-l-4 border-red-500 pl-4 mb-6">
                <h4 className="font-medium text-red-600 dark:text-red-400">Important Notice</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Higher leverage amplifies both profits and losses. Positions may be liquidated
                  if collateral falls below maintenance requirements.
                </p>
              </div>

              <h3 className="text-xl font-medium mb-3">Funding Rates</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Funding rates are calculated based on position imbalances and applied periodically
                to maintain price stability.
              </p>
            </div>
          )}

          {selectedTab === "vault" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Vault Operations</h2>

              <h3 className="text-xl font-medium mb-3">Collateral Management</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The vault system handles all collateral operations including deposits, withdrawals,
                and balance tracking.
              </p>

              <h4 className="font-medium mb-2">Deposit Workflow</h4>
              <ol className="list-decimal list-inside space-y-2 mb-6 text-gray-700 dark:text-gray-300">
                <li>Check current vUSDT balance</li>
                <li>Approve vault contract for token spending</li>
                <li>Execute depositCollateral transaction</li>
                <li>Verify updated vault balance</li>
              </ol>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4 mb-6">
                <h4 className="font-mono text-sm mb-2">Implementation</h4>
                <div className="text-sm font-mono space-y-1">
                  <div>// Approve tokens</div>
                  <div>await approve(VAULT_ADDRESS, amount);</div>
                  <div className="mt-2">// Deposit to vault</div>
                  <div>await depositCollateral(amount);</div>
                </div>
              </div>

              <h4 className="font-medium mb-2">Withdrawal Requirements</h4>
              <ul className="list-disc list-inside space-y-1 mb-6 text-gray-700 dark:text-gray-300">
                <li>All positions must be closed before withdrawal</li>
                <li>Only available balance can be withdrawn</li>
                <li>Minimum withdrawal amount may apply</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Balance Queries</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4">
                <div className="text-sm font-mono space-y-1">
                  <div>// Get user collateral info</div>
                  <div>const collateral = await getUserCollateral();</div>
                  <div>console.log(collateral.availableBalance);</div>
                  <div>console.log(collateral.lockedBalance);</div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === "reference" && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="text-2xl font-light mb-4">Complete Reference</h2>

              <h3 className="text-xl font-medium mb-3">Environment Variables</h3>
              <div className="space-y-2 mb-6">
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  VITE_POSITION_MANAGER_ADDRESS
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  VITE_VAMM_ADDRESS
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  VITE_VAULT_ADDRESS
                </div>
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                  VITE_VUSDT_ADDRESS
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Return Values</h3>
              <div className="space-y-3 mb-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <code className="text-sm">getCurrentPrice()</code>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Returns: [price (uint256), isValid (bool)]
                  </p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
                  <code className="text-sm">getPositionStats()</code>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Returns: [totalLong, totalShort, longCollateral, shortCollateral, fundingRate]
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-medium mb-3">Error Handling</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                All contract interactions should be wrapped in try-catch blocks to handle
                potential transaction failures gracefully.
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded border p-4">
                <div className="text-sm font-mono space-y-1">
                  <div>try &#123;</div>
                  <div className="ml-4">const tx = await writeContract(config, &#123;...&#125;);</div>
                  <div className="ml-4">const receipt = await waitForTransactionReceipt(config, &#123; hash: tx &#125;);</div>
                  <div>&#125; catch (error) &#123;</div>
                  <div className="ml-4">console.error("Transaction failed:", error);</div>
                  <div>&#125;</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Platform Documentation v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}