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

        // Get current price
        const [currentPrice] = await this.vamm.getCurrentPrice?.();
        const price = Number(ethers.formatEther(currentPrice));

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
                    price,
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
        const collateral = Number(ethers.formatEther(position.collateral));
        const entryPrice = Number(ethers.formatEther(position.entryPrice));
        const positionSize = collateral * position.leverage;

        // Calculate PnL
        const priceDiff = position.isLong
            ? currentPrice - entryPrice
            : entryPrice - currentPrice;

        const pnl = (priceDiff / entryPrice) * positionSize;

        // Calculate funding payment
        const fundingPayment =
            ((accumulatedFundingRate - position.entryFundingRate) / 10000) * positionSize;

        const adjustedPnl = position.isLong
            ? pnl - fundingPayment
            : pnl + fundingPayment;

        // Check if position is underwater (losses exceed 90% of collateral)
        const liquidationThreshold = collateral * 0.9;
        const isLiquidatable = adjustedPnl < -liquidationThreshold;

        if (isLiquidatable) {
            console.log(`
🚨 Liquidatable Position Found!
  Token ID: ${position.tokenId}
  Owner: ${position.owner}
  Type: ${position.isLong ? 'LONG' : 'SHORT'}
  Entry Price: $${entryPrice.toFixed(2)}
  Current Price: $${currentPrice.toFixed(2)}
  Collateral: $${collateral.toFixed(2)}
  PnL: $${adjustedPnl.toFixed(2)}
  Threshold: -$${liquidationThreshold.toFixed(2)}
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