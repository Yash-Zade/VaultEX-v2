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
    this.http = new ethers.JsonRpcProvider(config.rpc.httpUrl, config.rpc.chainId);

    try {
      if (config.rpc.wsUrl) {
        this.ws = new ethers.WebSocketProvider(config.rpc.wsUrl, config.rpc.chainId);
      }
    } catch (e) {
      console.warn('⚠️ Failed to create WebSocketProvider. Falling back to polling only. Error:', e);
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
    }
  }

  async start() {
    console.log('🚀 Starting Live Indexer (No Backfill)...');

    this.isRunning = true;

    const current = await this.http.getBlockNumber();
    const startFrom = current + 1;
    console.log(`📌 Starting indexing from block ${startFrom}`);

    if (!this.positionManagerWs) {
      console.warn('⚠️ No WS provider available — event listeners disabled.');
      return;
    }

    console.log('👂 Listening for new live events...');

    this.positionManagerWs.on(
      'PositionOpened',
      async (tokenId, user, collateral, entryPrice, leverage, entryFundingRate, isLong, ev) => {
        try {
          const block = await this.http.getBlock(ev.blockNumber);

          const position: Position = {
            tokenId: tokenId.toString(),
            owner: user,
            collateral: collateral.toString(),
            leverage: Number(leverage),
            entryPrice: entryPrice.toString(),
            entryFundingRate: Number(entryFundingRate),
            isLong: Boolean(isLong),
            size: (BigInt(collateral) * BigInt(Number(leverage))).toString(),
            isActive: true,
            blockNumber: ev.blockNumber,
            timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
          };

          await db.upsertPosition(position);

          console.log(
            `📝 Indexed new position: tokenId=${tokenId.toString()} owner=${user}`
          );
        } catch (err) {
          console.error('❌ handlePositionOpened error:', err);
        }
      }
    );

    this.positionManagerWs.on(
      'PositionClosed',
      async (tokenId, user, pnl, fundingPayment, fees, ev) => {
        try {
          await db.markPositionInactive(tokenId.toString());
          console.log(`🔒 PositionClosed token=${tokenId.toString()} user=${user}`);
        } catch (err) {
          console.error('❌ handlePositionClosed error:', err);
        }
      }
    );

    this.positionManagerWs.on(
      'PositionLiquidated',
      async (tokenId, user, ev) => {
        try {
          await db.markPositionInactive(tokenId.toString());
          console.log(`⚡ PositionLiquidated token=${tokenId.toString()} user=${user}`);
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