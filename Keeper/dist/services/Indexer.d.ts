export declare class Indexer {
    private http;
    private ws?;
    private positionManagerHttp;
    private positionManagerWs?;
    private isRunning;
    constructor();
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=indexer.d.ts.map