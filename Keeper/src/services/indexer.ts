import { ethers } from 'ethers';
import { config } from '../config/config';
import { db, type Position } from './database';
import positionManagerAbi from "../abis/positionManager.json";

/**
 * Live-only Indexer:
 * - Starts from current block + 1
 * - Subscribes via WebSocket to PositionOpened/Closed/Liquidated
 * - Uses HTTP provider for reads (getBlock, getBlockNumber)
 */
export class Indexer {
  private http: ethers.JsonRpcProvider;
  private ws?: ethers.WebSocketProvider;
  private positionManagerHttp: ethers.Contract;
  private positionManagerWs?: ethers.Contract;
  private isRunning = false;

  constructor() {
    // HTTP for reads
    this.http = new ethers.JsonRpcProvider(config.rpc.httpUrl, config.rpc.chainId);


    // WS for live events
    try {
      if (config.rpc.wsUrl) {
        this.ws = new ethers.WebSocketProvider(config.rpc.wsUrl, config.rpc.chainId);

        (this.ws as any)._websocket.on("close", (code: any) => {
          console.error(`❌ WebSocket closed (code ${code}). Restarting indexer...`);
          process.exit(1);
        });

        (this.ws as any)._websocket.on("error", (err: any) => {
          console.error("⚠️ WebSocket error:", err);
          process.exit(1);
        });
      }
    } catch (e) {
      console.warn("⚠️ Failed to create WebSocketProvider. Falling back to polling only.\nError:", e);
      this.ws = undefined;
    }


    this.positionManagerHttp = new ethers.Contract(
      config.contracts.positionManager,
      positionManagerAbi,
      this.http
    );

    if (this.ws) {
      this.positionManagerWs = new ethers.Contract(
        config.contracts.positionManager,
        positionManagerAbi,
        this.ws
      );

      (this.ws as any)._websocket.on("open", () => {
        console.log("🔗 WebSocket connected & subscriptions active.");
      });
    }

  }

  async start() {
    console.log('🚀 Starting Live Indexer (No Backfill)...');

    this.isRunning = true;

    // Determine current block and start listening from the next one.
    const current = await this.http.getBlockNumber();
    const startFrom = current + 1;
    console.log(`📌 Starting indexing from block ${startFrom}`);

    if (!this.positionManagerWs) {
      console.warn('⚠️ No WS provider available — event listeners disabled. (Provide RPC_WS_URL).');
      return; // or implement polling loop if you want
    }

    console.log('👂 Listening for new live events...');

    // --- Event: PositionOpened(address user, uint256 collateraal, uint256 entryPrice, uint8 leverage, int256 entryFundingRate, bool isLong)
    this.positionManagerWs.on(
      'PositionOpened',
      async (user, collateraal, entryPrice, leverage, entryFundingRate, isLong, ev) => {
        try {
          const block = await this.http.getBlock(ev.blockNumber);
          // NOTE: No tokenId in this event signature; store without tokenId or try to infer externally.
          // We’ll use a synthetic key `${user}-${ev.blockNumber}-${ev.logIndex}` if tokenId unavailable.
          const tokenIdMaybe = undefined;

          const position: Position = {
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

          await db.upsertPosition(position);
          console.log(`📝 Indexed new position (opened) for ${user} at block ${ev.blockNumber}`);
        } catch (err) {
          console.error('❌ handlePositionOpened error:', err);
        }
      }
    );

    // --- Event: PositionClosed(uint256 indexed tokenId, address indexed user, int256 pnl, int256 fundingPayment, uint256 fees)
    this.positionManagerWs.on(
      'PositionClosed',
      async (tokenId, user, pnl, fundingPayment, fees, ev) => {
        try {
          await db.markPositionInactive(tokenId.toString());
          console.log(`🔒 Position closed: ${tokenId.toString()} (user ${user}) at block ${ev.blockNumber}`);
        } catch (err) {
          console.error('❌ handlePositionClosed error:', err);
        }
      }
    );

    // --- Event: PositionLiquidated(uint256 indexed tokenId, address indexed user)
    this.positionManagerWs.on(
      'PositionLiquidated',
      async (tokenId, user, ev) => {
        try {
          await db.markPositionInactive(tokenId.toString());
          console.log(`⚡ Position liquidated: ${tokenId.toString()} (user ${user}) at block ${ev.blockNumber}`);
        } catch (err) {
          console.error('❌ handlePositionLiquidated error:', err);
        }
      }
    );

    // Keep alive loop
    while (this.isRunning) {
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }

  stop() {
    this.isRunning = false;
    try {
      this.positionManagerWs?.removeAllListeners();
    } catch { }
    try {
      this.ws?.destroy();
    } catch { }
    console.log('Indexer stopped');
  }
}
