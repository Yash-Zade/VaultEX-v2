"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indexer = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config/config");
const database_1 = require("./database");
const PositionManager_json_1 = __importDefault(require("../abis/PositionManager.json"));
class Indexer {
    constructor() {
        this.isRunning = false;
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc.url);
        this.positionManager = new ethers_1.ethers.Contract(config_1.config.contracts.positionManager, PositionManager_json_1.default, this.provider);
    }
    async start() {
        console.log('🚀 Starting Indexer...');
        this.isRunning = true;
        try {
            let lastBlock = await database_1.db.getLastProcessedBlock();
            if (lastBlock === 0 || config_1.config.bot.indexerStartBlock === 'latest') {
                lastBlock = await this.provider.getBlockNumber();
                console.log(`Starting from current block: ${lastBlock}`);
            }
            await this.indexHistoricalEvents(lastBlock);
            await this.subscribeToNewEvents();
        }
        catch (error) {
            console.error('❌ Indexer error:', error);
            this.isRunning = false;
        }
    }
    async indexHistoricalEvents(fromBlock) {
        console.log(`📚 Indexing events from block ${fromBlock}...`);
        const currentBlock = await this.provider.getBlockNumber();
        const BATCH_SIZE = 1000;
        for (let start = fromBlock; start <= currentBlock; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
            try {
                await this.processBlockRange(start, end);
                await database_1.db.updateLastProcessedBlock(end);
                console.log(`✅ Processed blocks ${start} to ${end}`);
            }
            catch (error) {
                console.error(`❌ Error processing blocks ${start}-${end}:`, error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async processBlockRange(fromBlock, toBlock) {
        const openFilter = this.positionManager.filters.PositionOpened();
        const openEvents = await this.positionManager.queryFilter(openFilter, fromBlock, toBlock);
        for (const event of openEvents) {
            await this.handlePositionOpened(event);
        }
        const closeFilter = this.positionManager.filters.PositionClosed();
        const closeEvents = await this.positionManager.queryFilter(closeFilter, fromBlock, toBlock);
        for (const event of closeEvents) {
            await this.handlePositionClosed(event);
        }
        const liqFilter = this.positionManager.filters.PositionLiquidated();
        const liqEvents = await this.positionManager.queryFilter(liqFilter, fromBlock, toBlock);
        for (const event of liqEvents) {
            await this.handlePositionLiquidated(event);
        }
    }
    async handlePositionOpened(event) {
        const block = await event.getBlock();
        const args = event.args;
        const position = {
            tokenId: args.tokenId.toString(),
            owner: args.user,
            collateral: args.collateral.toString(),
            leverage: Number(args.leverage),
            entryPrice: '0',
            entryFundingRate: 0,
            isLong: args.isLong,
            size: (BigInt(args.collateral.toString()) * BigInt(args.leverage)).toString(),
            isActive: true,
            blockNumber: event.blockNumber,
            timestamp: block.timestamp,
        };
        try {
            const posData = await this.positionManager._getPositionData?.(args.tokenId);
            position.entryPrice = posData[2].toString();
            position.entryFundingRate = Number(posData[3]);
        }
        catch (error) {
            console.error(`Failed to fetch data for position ${args.tokenId}:`, error);
        }
        await database_1.db.upsertPosition(position);
        console.log(`📝 Indexed new position: ${position.tokenId}`);
    }
    async handlePositionClosed(event) {
        const args = event.args;
        await database_1.db.markPositionInactive(args.tokenId.toString());
        console.log(`🔒 Position closed: ${args.tokenId.toString()}`);
    }
    async handlePositionLiquidated(event) {
        const args = event.args;
        await database_1.db.markPositionInactive(args.tokenId.toString());
        console.log(`⚡ Position liquidated: ${args.tokenId.toString()}`);
    }
    async subscribeToNewEvents() {
        console.log('👂 Listening for new events...');
        this.positionManager.on('PositionOpened', async (user, tokenId, collateral, leverage, isLong, event) => {
            console.log(`🆕 New position opened: ${tokenId}`);
            await this.handlePositionOpened(event);
            await database_1.db.updateLastProcessedBlock(event.blockNumber);
        });
        this.positionManager.on('PositionClosed', async (tokenId, pnl, event) => {
            console.log(`🔒 Position closed: ${tokenId}`);
            await this.handlePositionClosed(event);
            await database_1.db.updateLastProcessedBlock(event.blockNumber);
        });
        this.positionManager.on('PositionLiquidated', async (tokenId, liquidator, event) => {
            console.log(`⚡ Position liquidated: ${tokenId}`);
            await this.handlePositionLiquidated(event);
            await database_1.db.updateLastProcessedBlock(event.blockNumber);
        });
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    stop() {
        this.isRunning = false;
        this.positionManager.removeAllListeners();
        console.log('Indexer stopped');
    }
}
exports.Indexer = Indexer;
//# sourceMappingURL=Indexer.js.map