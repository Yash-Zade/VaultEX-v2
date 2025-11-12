export declare class Liquidator {
    private provider;
    private wallet;
    private positionManager;
    private vamm;
    private isRunning;
    constructor();
    start(): Promise<void>;
    private checkAndLiquidatePositions;
    private isPositionLiquidatable;
    private liquidatePosition;
    stop(): void;
}
//# sourceMappingURL=Liquidator.d.ts.map