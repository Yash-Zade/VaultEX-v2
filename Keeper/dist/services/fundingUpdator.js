"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundingUpdater = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config/config");
const database_1 = require("./database");
const PositionManager_json_1 = __importDefault(require("../abis/PositionManager.json"));
class FundingUpdater {
    constructor() {
        this.isRunning = false;
        this.lastUpdateTime = 0;
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc.httpUrl, config_1.config.rpc.chainId);
        this.wallet = new ethers_1.ethers.Wallet(config_1.config.wallet.privateKey, this.provider);
        this.positionManager = new ethers_1.ethers.Contract(config_1.config.contracts.positionManager, PositionManager_json_1.default, this.wallet);
        console.log(`💰 Funding Updater wallet: ${this.wallet.address}`);
    }
    async start() {
        console.log('⏰ Starting Funding Rate Updater...');
        console.log(`Update interval: ${config_1.config.bot.fundingUpdateInterval / 1000 / 60} minutes`);
        this.isRunning = true;
        await this.updateFundingRate();
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, config_1.config.bot.fundingUpdateInterval));
            if (this.isRunning) {
                await this.updateFundingRate();
            }
        }
    }
    async updateFundingRate() {
        const now = Date.now();
        if (now - this.lastUpdateTime < 60000) {
            console.log('⏭️  Skipping update - too soon since last update');
            return;
        }
        console.log('📊 Updating funding rate...');
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits(config_1.config.bot.maxGasPrice, 'gwei');
            if (gasPrice > ethers_1.ethers.parseUnits(config_1.config.bot.maxGasPrice, 'gwei')) {
                console.log(`⛽ Gas price too high: ${ethers_1.ethers.formatUnits(gasPrice, 'gwei')} gwei. Retrying in 5 minutes...`);
                setTimeout(() => this.updateFundingRate(), 300000);
                return;
            }
            const gasEstimate = await this.positionManager?.updateFundingRate?.estimateGas();
            const tx = await this.positionManager?.updateFundingRate?.({
                gasLimit: gasEstimate ? gasEstimate * 120n / 100n : undefined,
                gasPrice: gasPrice,
            });
            console.log(`📤 Funding rate update tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                this.lastUpdateTime = now;
                console.log(`✅ Funding rate updated successfully`);
                console.log(`   Tx: ${receipt.hash}`);
                console.log(`   Block: ${receipt.blockNumber}`);
                console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
                const block = await this.provider.getBlock(receipt.blockNumber);
                try {
                    const fundingRate = await this.positionManager?.getCurrentFundingRate?.();
                    console.log(`   New funding rate: ${Number(fundingRate) / 10000}%`);
                    await database_1.db.recordFundingUpdate({
                        blockNumber: receipt.blockNumber,
                        timestamp: block?.timestamp || Math.floor(now / 1000),
                        fundingRate: Number(fundingRate) / 10000,
                        txHash: receipt.hash,
                    });
                }
                catch (error) {
                    console.error('Failed to fetch new funding rate:', error);
                }
                const nextUpdate = new Date(now + config_1.config.bot.fundingUpdateInterval);
                console.log(`⏰ Next update scheduled for: ${nextUpdate.toLocaleString()}`);
            }
            else {
                throw new Error('Transaction failed');
            }
        }
        catch (error) {
            console.error(`❌ Failed to update funding rate:`, error.message);
            console.log('Retrying in 5 minutes...');
            setTimeout(() => this.updateFundingRate(), 300000);
        }
    }
    stop() {
        this.isRunning = false;
        console.log('Funding rate updater stopped');
    }
}
exports.FundingUpdater = FundingUpdater;
//# sourceMappingURL=fundingUpdator.js.map