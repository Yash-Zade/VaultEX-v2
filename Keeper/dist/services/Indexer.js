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
        this.http = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc.httpUrl, config_1.config.rpc.chainId);
        try {
            if (config_1.config.rpc.wsUrl) {
                this.ws = new ethers_1.ethers.WebSocketProvider(config_1.config.rpc.wsUrl, config_1.config.rpc.chainId);
                this.ws._websocket.on("close", (code) => {
                    console.error(`❌ WebSocket closed (code ${code}). Restarting indexer...`);
                    process.exit(1);
                });
                this.ws._websocket.on("error", (err) => {
                    console.error("⚠️ WebSocket error:", err);
                    process.exit(1);
                });
            }
        }
        catch (e) {
            console.warn("⚠️ Failed to create WebSocketProvider. Falling back to polling only.\nError:", e);
            this.ws = undefined;
        }
        this.positionManagerHttp = new ethers_1.ethers.Contract(config_1.config.contracts.positionManager, PositionManager_json_1.default, this.http);
        if (this.ws) {
            this.positionManagerWs = new ethers_1.ethers.Contract(config_1.config.contracts.positionManager, PositionManager_json_1.default, this.ws);
            this.ws._websocket.on("open", () => {
                console.log("🔗 WebSocket connected & subscriptions active.");
            });
        }
    }
    async start() {
        console.log('🚀 Starting Live Indexer (No Backfill)...');
        this.isRunning = true;
        const current = await this.http.getBlockNumber();
        const startFrom = current + 1;
        console.log(`📌 Starting indexing from block ${startFrom}`);
        if (!this.positionManagerWs) {
            console.warn('⚠️ No WS provider available — event listeners disabled. (Provide RPC_WS_URL).');
            return;
        }
        console.log('👂 Listening for new live events...');
        this.positionManagerWs.on('PositionOpened', async (user, collateraal, entryPrice, leverage, entryFundingRate, isLong, ev) => {
            try {
                const block = await this.http.getBlock(ev.blockNumber);
                const tokenIdMaybe = undefined;
                const position = {
                    tokenId: tokenIdMaybe ?? `${user}-${ev.blockNumber}-${ev.logIndex}`,
                    owner: user,
                    collateral: collateraal.toString(),
                    leverage: Number(leverage),
                    entryPrice: entryPrice.toString(),
                    entryFundingRate: Number(entryFundingRate),
                    isLong: Boolean(isLong),
                    size: (BigInt(collateraal.toString()) * BigInt(leverage)).toString(),
                    isActive: true,
                    blockNumber: ev.blockNumber,
                    timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
                };
                await database_1.db.upsertPosition(position);
                console.log(`📝 Indexed new position (opened) for ${user} at block ${ev.blockNumber}`);
            }
            catch (err) {
                console.error('❌ handlePositionOpened error:', err);
            }
        });
        this.positionManagerWs.on('PositionClosed', async (tokenId, user, pnl, fundingPayment, fees, ev) => {
            try {
                await database_1.db.markPositionInactive(tokenId.toString());
                console.log(`🔒 Position closed: ${tokenId.toString()} (user ${user}) at block ${ev.blockNumber}`);
            }
            catch (err) {
                console.error('❌ handlePositionClosed error:', err);
            }
        });
        this.positionManagerWs.on('PositionLiquidated', async (tokenId, user, ev) => {
            try {
                await database_1.db.markPositionInactive(tokenId.toString());
                console.log(`⚡ Position liquidated: ${tokenId.toString()} (user ${user}) at block ${ev.blockNumber}`);
            }
            catch (err) {
                console.error('❌ handlePositionLiquidated error:', err);
            }
        });
        while (this.isRunning) {
            await new Promise((r) => setTimeout(r, 10000));
        }
    }
    stop() {
        this.isRunning = false;
        try {
            this.positionManagerWs?.removeAllListeners();
        }
        catch { }
        try {
            this.ws?.destroy();
        }
        catch { }
        console.log('Indexer stopped');
    }
}
exports.Indexer = Indexer;
//# sourceMappingURL=indexer.js.map