export declare const config: {
    rpc: {
        httpUrl: string;
        wsUrl: string;
        chainId: number;
    };
    contracts: {
        positionManager: string;
        vamm: string;
        positionNft: string;
    };
    wallet: {
        privateKey: string;
    };
    mongodb: {
        uri: string;
    };
    bot: {
        liquidationCheckInterval: number;
        fundingUpdateInterval: number;
        maxGasPrice: string;
    };
    logging: {
        level: string;
    };
};
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map