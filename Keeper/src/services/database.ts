import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '../config/config';
export interface Position {
  tokenId: string;
  owner: string;
  collateral: string;
  leverage: number;
  entryPrice: string;
  entryFundingRate: number;
  isLong: boolean;
  size: string;
  isActive: boolean;
  blockNumber: number;
  timestamp: number;
  lastChecked?: number;
}

export interface IndexerState {
  lastProcessedBlock: number;
  lastUpdateTime: number;
}

export interface FundingUpdate {
  blockNumber: number;
  timestamp: number;
  fundingRate: number;
  txHash: string;
}

export interface LiquidationAttempt {
  tokenId: string;
  timestamp: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

class Database {
  private client: MongoClient;
  private db!: Db;
  public positions!: Collection<Position>;
  public indexerState!: Collection<IndexerState>;
  public fundingUpdates!: Collection<FundingUpdate>;
  public liquidations!: Collection<LiquidationAttempt>;

  constructor() {
    this.client = new MongoClient(config.mongodb.uri);
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db();
      
      this.positions = this.db.collection<Position>('positions');
      this.indexerState = this.db.collection<IndexerState>('indexer_state');
      this.fundingUpdates = this.db.collection<FundingUpdate>('funding_updates');
      this.liquidations = this.db.collection<LiquidationAttempt>('liquidations');

      // Create indexes
      await this.positions.createIndex({ tokenId: 1 }, { unique: true });
      await this.positions.createIndex({ owner: 1 });
      await this.positions.createIndex({ isActive: 1 });
      await this.positions.createIndex({ lastChecked: 1 });
      
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  async getLastProcessedBlock(): Promise<number> {
    const state = await this.indexerState.findOne({});
    return state?.lastProcessedBlock || 0;
  }

  async updateLastProcessedBlock(blockNumber: number) {
    await this.indexerState.updateOne(
      {},
      { 
        $set: { 
          lastProcessedBlock: blockNumber,
          lastUpdateTime: Date.now()
        } 
      },
      { upsert: true }
    );
  }

  async upsertPosition(position: Position) {
    await this.positions.updateOne(
      { tokenId: position.tokenId },
      { $set: position },
      { upsert: true }
    );
  }

  async getActivePositions(): Promise<Position[]> {
    return await this.positions.find({ isActive: true }).toArray();
  }

  async markPositionInactive(tokenId: string) {
    await this.positions.updateOne(
      { tokenId },
      { $set: { isActive: false } }
    );
  }

  async updatePositionLastChecked(tokenId: string) {
    await this.positions.updateOne(
      { tokenId },
      { $set: { lastChecked: Date.now() } }
    );
  }

  async recordLiquidation(attempt: LiquidationAttempt) {
    await this.liquidations.insertOne(attempt);
  }

  async recordFundingUpdate(update: FundingUpdate) {
    await this.fundingUpdates.insertOne(update);
  }
}

export const db = new Database();