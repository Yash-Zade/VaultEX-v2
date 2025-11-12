export declare class FundingUpdater {
    private provider;
    private wallet;
    private positionManager;
    private isRunning;
    private lastUpdateTime;
    constructor();
    start(): Promise<void>;
    private updateFundingRate;
    stop(): void;
}
//# sourceMappingURL=fundingUpdator.d.ts.map