import { validateConfig } from './config/config';
import { db } from './services/database';
import { Indexer } from './services/indexer';
import { Liquidator } from './services/liquidator';
import { FundingUpdater } from './services/fundingUpdator';

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 PERPETUAL KEEPER BOT SYSTEM');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('📋 Step 1: Validating configuration...');
    validateConfig();
    console.log('✅ Configuration validated\n');

    console.log('📋 Step 2: Connecting to MongoDB...');
    await db.connect();
    console.log('');

    console.log('📋 Step 3: Initializing services...');
    const indexer = new Indexer();
    const liquidator = new Liquidator();
    const fundingUpdater = new FundingUpdater();
    console.log('✅ All services initialized\n');

    const shutdown = async () => {
      console.log('\n' + '='.repeat(60));
      console.log('🛑 SHUTTING DOWN GRACEFULLY...');
      console.log('='.repeat(60));
      console.log('⏹️  Stopping Indexer...');
      indexer.stop();
      console.log('⏹️  Stopping Liquidator...');
      liquidator.stop();
      console.log('⏹️  Stopping Funding Updater...');
      fundingUpdater.stop();
      console.log('🔌 Disconnecting from MongoDB...');
      await db.disconnect();
      console.log('\n✅ Clean shutdown complete\n👋 Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    console.log('='.repeat(60));
    console.log('🎯 STARTING ALL SERVICES');
    console.log('='.repeat(60));
    console.log('\nPress Ctrl+C to stop all services\n');

    // Live-only indexer (no backfill)
    indexer.start().catch((err) => console.error('❌ Indexer failed:', err));
    liquidator.start().catch((err) => console.error('❌ Liquidator failed:', err));
    fundingUpdater.start().catch((err) => console.error('❌ Funding Updater failed:', err));

    await new Promise(() => {}); // keep process alive
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

main();
