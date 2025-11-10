import { ethers } from 'ethers';
import { config } from '../config/config';
import { db } from './database';
import positionManagerAbi from '../abis/PositionManager.json';

export class FundingUpdater {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private positionManager: ethers.Contract;
    private isRunning: boolean = false;
    private lastUpdateTime: number = 0;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.rpc.httpUrl, config.rpc.chainId);
        this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);


        this.positionManager = new ethers.Contract(
            config.contracts.positionManager,
            positionManagerAbi,
            this.wallet
        );

        console.log(`💰 Funding Updater wallet: ${this.wallet.address}`);
    }

    async start() {
        console.log('⏰ Starting Funding Rate Updater...');
        console.log(`Update interval: ${config.bot.fundingUpdateInterval / 1000 / 60} minutes`);

        this.isRunning = true;

        // Update immediately on start
        await this.updateFundingRate();

        // Then update every 8 hours
        while (this.isRunning) {
            await new Promise(resolve =>
                setTimeout(resolve, config.bot.fundingUpdateInterval)
            );

            if (this.isRunning) {
                await this.updateFundingRate();
            }
        }
    }

    private async updateFundingRate() {
        const now = Date.now();

        // Prevent duplicate updates within 1 minute
        if (now - this.lastUpdateTime < 60000) {
            console.log('⏭️  Skipping update - too soon since last update');
            return;
        }

        console.log('📊 Updating funding rate...');

        try {
            // Check gas price
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits(config.bot.maxGasPrice, 'gwei');

            if (gasPrice > ethers.parseUnits(config.bot.maxGasPrice, 'gwei')) {
                console.log(`⛽ Gas price too high: ${ethers.formatUnits(gasPrice, 'gwei')} gwei. Retrying in 5 minutes...`);
                setTimeout(() => this.updateFundingRate(), 300000);
                return;
            }

            // Estimate gas
            const gasEstimate = await this.positionManager?.updateFundingRate?.estimateGas();

            // Send transaction
            const tx = await this.positionManager?.updateFundingRate?.({
                gasLimit: gasEstimate ? gasEstimate * 120n / 100n : undefined, // 20% buffer
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

                // Get current block to fetch funding rate
                const block = await this.provider.getBlock(receipt.blockNumber);

                // Try to get the new funding rate
                try {
                    const fundingRate = await this.positionManager?.getCurrentFundingRate?.();
                    console.log(`   New funding rate: ${Number(fundingRate) / 10000}%`);

                    await db.recordFundingUpdate({
                        blockNumber: receipt.blockNumber,
                        timestamp: block?.timestamp || Math.floor(now / 1000),
                        fundingRate: Number(fundingRate) / 10000,
                        txHash: receipt.hash,
                    });
                } catch (error) {
                    console.error('Failed to fetch new funding rate:', error);
                }

                // Log next update time
                const nextUpdate = new Date(now + config.bot.fundingUpdateInterval);
                console.log(`⏰ Next update scheduled for: ${nextUpdate.toLocaleString()}`);
            } else {
                throw new Error('Transaction failed');
            }
        } catch (error: any) {
            console.error(`❌ Failed to update funding rate:`, error.message);

            // Retry in 5 minutes on failure
            console.log('Retrying in 5 minutes...');
            setTimeout(() => this.updateFundingRate(), 300000);
        }
    }

    stop() {
        this.isRunning = false;
        console.log('Funding rate updater stopped');
    }
}