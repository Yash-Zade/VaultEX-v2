export declare class Indexer {
    private provider;
    private positionManager;
    private isRunning;
    constructor();
    start(): Promise<void>;
    private indexHistoricalEvents;
    private processBlockRange;
    private handlePositionOpened;
    private handlePositionClosed;
    private handlePositionLiquidated;
    private subscribeToNewEvents;
    stop(): void;
}
//# sourceMappingURL=Indexer.d.ts.map