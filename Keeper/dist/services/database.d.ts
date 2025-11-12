import { Collection } from 'mongodb';
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
declare class Database {
    private client;
    private db;
    positions: Collection<Position>;
    indexerState: Collection<IndexerState>;
    fundingUpdates: Collection<FundingUpdate>;
    liquidations: Collection<LiquidationAttempt>;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getLastProcessedBlock(): Promise<number>;
    updateLastProcessedBlock(blockNumber: number): Promise<void>;
    upsertPosition(position: Position): Promise<void>;
    getActivePositions(): Promise<Position[]>;
    markPositionInactive(tokenId: string): Promise<void>;
    updatePositionLastChecked(tokenId: string): Promise<void>;
    recordLiquidation(attempt: LiquidationAttempt): Promise<void>;
    recordFundingUpdate(update: FundingUpdate): Promise<void>;
}
export declare const db: Database;
export {};
//# sourceMappingURL=database.d.ts.map