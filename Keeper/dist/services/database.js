"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const mongodb_1 = require("mongodb");
const config_1 = require("../config/config");
class Database {
    constructor() {
        this.client = new mongodb_1.MongoClient(config_1.config.mongodb.uri);
    }
    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db();
            this.positions = this.db.collection('positions');
            this.indexerState = this.db.collection('indexer_state');
            this.fundingUpdates = this.db.collection('funding_updates');
            this.liquidations = this.db.collection('liquidations');
            await this.positions.createIndex({ tokenId: 1 }, { unique: true });
            await this.positions.createIndex({ owner: 1 });
            await this.positions.createIndex({ isActive: 1 });
            await this.positions.createIndex({ lastChecked: 1 });
            console.log('✅ Connected to MongoDB');
        }
        catch (error) {
            console.error('❌ MongoDB connection error:', error);
            throw error;
        }
    }
    async disconnect() {
        await this.client.close();
        console.log('Disconnected from MongoDB');
    }
    async getLastProcessedBlock() {
        const state = await this.indexerState.findOne({});
        return state?.lastProcessedBlock || 0;
    }
    async updateLastProcessedBlock(blockNumber) {
        await this.indexerState.updateOne({}, {
            $set: {
                lastProcessedBlock: blockNumber,
                lastUpdateTime: Date.now()
            }
        }, { upsert: true });
    }
    async upsertPosition(position) {
        await this.positions.updateOne({ tokenId: position.tokenId }, { $set: position }, { upsert: true });
    }
    async getActivePositions() {
        return await this.positions.find({ isActive: true }).toArray();
    }
    async markPositionInactive(tokenId) {
        await this.positions.updateOne({ tokenId }, { $set: { isActive: false } });
    }
    async updatePositionLastChecked(tokenId) {
        await this.positions.updateOne({ tokenId }, { $set: { lastChecked: Date.now() } });
    }
    async recordLiquidation(attempt) {
        await this.liquidations.insertOne(attempt);
    }
    async recordFundingUpdate(update) {
        await this.fundingUpdates.insertOne(update);
    }
}
exports.db = new Database();
//# sourceMappingURL=database.js.map