import { ethers } from 'ethers';
import { config } from '../config/config';
import { db, Position } from './database';
import positionManagerAbi from '../abis/PositionManager.json';
import vammAbi from '../abis/vamm.json';

export class Liquidator {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private positionManager: ethers.Contract;
    private vamm: ethers.Contract;
    private isRunning: boolean = false;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.rpc.httpUrl, config.rpc.chainId);
        this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);

        this.positionManager = new ethers.Contract(
            config.contracts.positionManager,
            positionManagerAbi,
            this.wallet
        );

        this.vamm = new ethers.Contract(
            config.contracts.vamm,
            vammAbi,
            this.provider
        );

        console.log(`💼 Liquidator wallet: ${this.wallet.address}`);
    }

    async start() {
        console.log('🤖 Starting Liquidation Bot...');
        this.isRunning = true;

        while (this.isRunning) {
            try {
                await this.checkAndLiquidatePositions();
            } catch (error) {
                console.error('❌ Liquidation check error:', error);
            }

            await new Promise(resolve =>
                setTimeout(resolve, config.bot.liquidationCheckInterval)
            );
        }
    }

    private async checkAndLiquidatePositions() {
        const positions = await db.getActivePositions();

        if (positions.length === 0) {
            console.log('No active positions to check');
            return;
        }

        console.log(`🔍 Checking ${positions.length} positions for liquidation...`);

        // Get current price from vAMM
        const [currentPriceRaw] = await this.vamm.getCurrentPrice?.();
        const currentPrice = Number(ethers.formatEther(currentPriceRaw));

        // Get current funding rate
        let accumulatedFundingRate = 0;
        try {
            const fundingRate = await this.positionManager.fundingRateAccumulated?.();
            accumulatedFundingRate = Number(fundingRate);
        } catch (error) {
            console.error('Failed to fetch funding rate:', error);
        }

        for (const position of positions) {
            try {
                const isLiquidatable = await this.isPositionLiquidatable(
                    position,
                    currentPrice,
                    accumulatedFundingRate
                );

                if (isLiquidatable) {
                    await this.liquidatePosition(position);
                }

                await db.updatePositionLastChecked(position.tokenId);
            } catch (error) {
                console.error(`Error checking position ${position.tokenId}:`, error);
            }
        }
    }

    private async isPositionLiquidatable(
        position: Position,
        currentPrice: number,
        accumulatedFundingRate: number
    ): Promise<boolean> {
        // Parse values from storage
        const collateral = Number(ethers.formatEther(position.collateral));
        const entryPrice = Number(ethers.formatEther(position.entryPrice));
        const leverage = position.leverage;

        // ===== CORRECT PNL CALCULATION (from PDF) =====
        // priceChangePercentage calculation
        let priceChangePercentage: number;
        if (position.isLong) {
            // For longs: (currentPrice / entryPrice) - 1
            priceChangePercentage = (currentPrice / entryPrice) - 1;
        } else {
            // For shorts: 1 - (currentPrice / entryPrice)
            priceChangePercentage = 1 - (currentPrice / entryPrice);
        }

        // PnL = collateral × leverage × priceChangePercentage
        const pnl = collateral * leverage * priceChangePercentage;

        // ===== CORRECT FUNDING PAYMENT CALCULATION (from PDF) =====
        const fundingDelta = accumulatedFundingRate - (position.entryFundingRate || 0);
        // fundingPayment = (collateral × fundingDelta) / 10000
        let fundingPayment = (collateral * fundingDelta) / 10000;
        
        // For longs: negative (they pay)
        // For shorts: positive (they receive if rate is positive)
        if (position.isLong) {
            fundingPayment = -fundingPayment;
        }

        // ===== CORRECT LIQUIDATION CHECK (from PDF) =====
        // remainingValue = collateral + pnl + fundingPayment
        const remainingValue = collateral + pnl + fundingPayment;
        
        // maintenanceMargin = 5% of collateral (LIQUIDATION_THRESHOLD_BPS = 500)
        const maintenanceMargin = collateral * 0.05;
        
        // Position is liquidatable if remainingValue <= maintenanceMargin
        const isLiquidatable = remainingValue <= maintenanceMargin;

        if (isLiquidatable) {
            console.log(`
🚨 Liquidatable Position Found!
  Token ID: ${position.tokenId}
  Owner: ${position.owner}
  Type: ${position.isLong ? 'LONG' : 'SHORT'}
  Leverage: ${leverage}x
  Entry Price: $${entryPrice.toFixed(2)}
  Current Price: $${currentPrice.toFixed(2)}
  Price Change: ${(priceChangePercentage * 100).toFixed(2)}%
  
  Collateral: $${collateral.toFixed(2)}
  PnL: $${pnl.toFixed(2)}
  Funding Payment: $${fundingPayment.toFixed(2)}
  Remaining Value: $${remainingValue.toFixed(2)}
  Maintenance Margin: $${maintenanceMargin.toFixed(2)}
            `);
        }

        return isLiquidatable;
    }

    private async liquidatePosition(position: Position) {
        console.log(`⚡ Attempting to liquidate position ${position.tokenId}...`);

        try {
            // Check gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits(config.bot.maxGasPrice, 'gwei');

            if (gasPrice > ethers.parseUnits(config.bot.maxGasPrice, 'gwei')) {
                console.log(`⛽ Gas price too high: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
                return;
            }

            // Estimate gas
            const gasEstimate = await this.positionManager.liquidatePosition?.estimateGas?.(position.tokenId);

            // Send liquidation transaction
            const tx = await this.positionManager.liquidatePosition?.(
                position.tokenId,
                {
                    gasLimit: gasEstimate ? gasEstimate * 120n / 100n : undefined, // 20% buffer
                    gasPrice: gasPrice,
                }
            );

            console.log(`📤 Liquidation tx sent: ${tx.hash}`);

            const receipt = await tx.wait();

            if (receipt.status === 1) {
                console.log(`✅ Successfully liquidated position ${position.tokenId}`);

                await db.recordLiquidation({
                    tokenId: position.tokenId,
                    timestamp: Date.now(),
                    success: true,
                    txHash: receipt.hash,
                });

                await db.markPositionInactive(position.tokenId);
            } else {
                throw new Error('Transaction failed');
            }
        } catch (error: any) {
            console.error(`❌ Failed to liquidate position ${position.tokenId}:`, error.message);

            await db.recordLiquidation({
                tokenId: position.tokenId,
                timestamp: Date.now(),
                success: false,
                error: error.message,
            });
        }
    }

    stop() {
        this.isRunning = false;
        console.log('Liquidation bot stopped');
    }
}