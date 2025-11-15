import { ethers } from 'ethers';
import { config } from '../config/config';
import { db, Position } from './database';
import positionManagerAbi from "../abis/positionManager.json";
import vammAbi from "../abis/vamm.json";

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

        // Get accumulated funding rate
        let accumulatedFunding = 0;
        try {
            accumulatedFunding = Number(await this.positionManager.fundingRateAccumulated?.());
        } catch (error) {
            console.error('Failed to fetch funding rate:', error);
        }

        for (const position of positions) {
            try {
                const isLiquidatable = await this.isPositionLiquidatable(
                    position,
                    currentPrice,
                    accumulatedFunding
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
        accumulatedFunding: number
    ): Promise<boolean> {
        const collateral = Number(ethers.formatEther(position.collateral));
        const entryPrice = Number(ethers.formatEther(position.entryPrice));
        const leverage = position.leverage;
        const priceFactor = currentPrice / entryPrice;
        const priceChange = position.isLong
            ? priceFactor - 1 // LONG PNL%
            : 1 - priceFactor; // SHORT PNL%

        // PnL = collateral * leverage * priceChange%
        const pnl = collateral * leverage * priceChange;

        const fundingDelta = accumulatedFunding - (position.entryFundingRate ?? 0);

        // fundingPayment = collateral * fundingDelta / 10_000
        let fundingPayment = (collateral * fundingDelta) / 10000;

        // LONG pays if funding positive
        if (position.isLong) {
            fundingPayment = -fundingPayment;
        }
        const remainingValue = collateral + pnl + fundingPayment;

        // MAINTENANCE MARGIN = 5% of collateral
        const maintenanceMargin = collateral * 0.05;

        const liquidatable = remainingValue <= maintenanceMargin;

        if (liquidatable) {
            console.log(`
                🚨 LIQUIDATABLE POSITION
                TOKEN: ${position.tokenId}
                OWNER: ${position.owner}
                TYPE: ${position.isLong ? "LONG" : "SHORT"}
                LEV: ${leverage}x

                Entry Price: $${entryPrice}
                Current Price: $${currentPrice}
                Price Change: ${(priceChange * 100).toFixed(2)}%

                Collateral: ${collateral}
                PnL: ${pnl}
                Funding: ${fundingPayment}

                Remaining Value: ${remainingValue}
                Maintenance Margin: ${maintenanceMargin}
            `);
        }

        return liquidatable;
    }

    private async liquidatePosition(position: Position) {
        console.log(`⚡ Attempting to liquidate position ${position.tokenId}...`);

        try {
            // Check gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits(config.bot.maxGasPrice, 'gwei');

            if (gasPrice > ethers.parseUnits(config.bot.maxGasPrice, 'gwei')) {
                console.log(`⛽ Gas too high: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
                return;
            }

            // Estimate gas
            const gasEstimate = await this.positionManager.liquidatePosition?.estimateGas?.(position.tokenId);

            const tx = await this.positionManager.liquidatePosition?.(
                position.tokenId,
                {
                    gasLimit: gasEstimate ? gasEstimate * 120n / 100n : undefined,
                    gasPrice: gasPrice,
                }
            );

            console.log(`📤 Liquidation tx sent: ${tx.hash}`);

            const receipt = await tx.wait();

            if (receipt.status === 1) {
                console.log(`✅ Successfully liquidated ${position.tokenId}`);

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
            console.error(`❌ Failed to liquidate ${position.tokenId}:`, error.message);

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