"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Liquidator = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config/config");
const database_1 = require("./database");
const PositionManager_json_1 = __importDefault(require("../abis/PositionManager.json"));
const vamm_json_1 = __importDefault(require("../abis/vamm.json"));
class Liquidator {
    constructor() {
        this.isRunning = false;
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc.httpUrl, config_1.config.rpc.chainId);
        this.wallet = new ethers_1.ethers.Wallet(config_1.config.wallet.privateKey, this.provider);
        this.positionManager = new ethers_1.ethers.Contract(config_1.config.contracts.positionManager, PositionManager_json_1.default, this.wallet);
        this.vamm = new ethers_1.ethers.Contract(config_1.config.contracts.vamm, vamm_json_1.default, this.provider);
        console.log(`💼 Liquidator wallet: ${this.wallet.address}`);
    }
    async start() {
        console.log('🤖 Starting Liquidation Bot...');
        this.isRunning = true;
        while (this.isRunning) {
            try {
                await this.checkAndLiquidatePositions();
            }
            catch (error) {
                console.error('❌ Liquidation check error:', error);
            }
            await new Promise(resolve => setTimeout(resolve, config_1.config.bot.liquidationCheckInterval));
        }
    }
    async checkAndLiquidatePositions() {
        const positions = await database_1.db.getActivePositions();
        if (positions.length === 0) {
            console.log('No active positions to check');
            return;
        }
        console.log(`🔍 Checking ${positions.length} positions for liquidation...`);
        const [currentPriceRaw] = await this.vamm.getCurrentPrice?.();
        const currentPrice = Number(ethers_1.ethers.formatEther(currentPriceRaw));
        let accumulatedFundingRate = 0;
        try {
            const fundingRate = await this.positionManager.fundingRateAccumulated?.();
            accumulatedFundingRate = Number(fundingRate);
        }
        catch (error) {
            console.error('Failed to fetch funding rate:', error);
        }
        for (const position of positions) {
            try {
                const isLiquidatable = await this.isPositionLiquidatable(position, currentPrice, accumulatedFundingRate);
                if (isLiquidatable) {
                    await this.liquidatePosition(position);
                }
                await database_1.db.updatePositionLastChecked(position.tokenId);
            }
            catch (error) {
                console.error(`Error checking position ${position.tokenId}:`, error);
            }
        }
    }
    async isPositionLiquidatable(position, currentPrice, accumulatedFundingRate) {
        const collateral = Number(ethers_1.ethers.formatEther(position.collateral));
        const entryPrice = Number(ethers_1.ethers.formatEther(position.entryPrice));
        const leverage = position.leverage;
        let priceChangePercentage;
        if (position.isLong) {
            priceChangePercentage = (currentPrice / entryPrice) - 1;
        }
        else {
            priceChangePercentage = 1 - (currentPrice / entryPrice);
        }
        const pnl = collateral * leverage * priceChangePercentage;
        const fundingDelta = accumulatedFundingRate - (position.entryFundingRate || 0);
        let fundingPayment = (collateral * fundingDelta) / 10000;
        if (position.isLong) {
            fundingPayment = -fundingPayment;
        }
        const remainingValue = collateral + pnl + fundingPayment;
        const maintenanceMargin = collateral * 0.05;
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
    async liquidatePosition(position) {
        console.log(`⚡ Attempting to liquidate position ${position.tokenId}...`);
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits(config_1.config.bot.maxGasPrice, 'gwei');
            if (gasPrice > ethers_1.ethers.parseUnits(config_1.config.bot.maxGasPrice, 'gwei')) {
                console.log(`⛽ Gas price too high: ${ethers_1.ethers.formatUnits(gasPrice, 'gwei')} gwei`);
                return;
            }
            const gasEstimate = await this.positionManager.liquidatePosition?.estimateGas?.(position.tokenId);
            const tx = await this.positionManager.liquidatePosition?.(position.tokenId, {
                gasLimit: gasEstimate ? gasEstimate * 120n / 100n : undefined,
                gasPrice: gasPrice,
            });
            console.log(`📤 Liquidation tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                console.log(`✅ Successfully liquidated position ${position.tokenId}`);
                await database_1.db.recordLiquidation({
                    tokenId: position.tokenId,
                    timestamp: Date.now(),
                    success: true,
                    txHash: receipt.hash,
                });
                await database_1.db.markPositionInactive(position.tokenId);
            }
            else {
                throw new Error('Transaction failed');
            }
        }
        catch (error) {
            console.error(`❌ Failed to liquidate position ${position.tokenId}:`, error.message);
            await database_1.db.recordLiquidation({
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
exports.Liquidator = Liquidator;
//# sourceMappingURL=liquidator.js.map