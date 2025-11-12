export declare const config: {
    rpc: {
        url: string;
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
        indexerStartBlock: string;
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