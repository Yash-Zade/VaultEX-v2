"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config/config");
const database_1 = require("./services/database");
const indexer_1 = require("./services/indexer");
const liquidator_1 = require("./services/liquidator");
const fundingUpdator_1 = require("./services/fundingUpdator");
async function main() {
    console.log('='.repeat(60));
    console.log('🚀 PERPETUAL KEEPER BOT SYSTEM');
    console.log('='.repeat(60));
    console.log('');
    try {
        console.log('📋 Step 1: Validating configuration...');
        (0, config_1.validateConfig)();
        console.log('✅ Configuration validated\n');
        console.log('📋 Step 2: Connecting to MongoDB...');
        await database_1.db.connect();
        console.log('');
        console.log('📋 Step 3: Initializing services...');
        const indexer = new indexer_1.Indexer();
        const liquidator = new liquidator_1.Liquidator();
        const fundingUpdater = new fundingUpdator_1.FundingUpdater();
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
            await database_1.db.disconnect();
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
        indexer.start().catch((err) => console.error('❌ Indexer failed:', err));
        liquidator.start().catch((err) => console.error('❌ Liquidator failed:', err));
        fundingUpdater.start().catch((err) => console.error('❌ Funding Updater failed:', err));
        await new Promise(() => { });
    }
    catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ FATAL ERROR');
        console.error('='.repeat(60));
        console.error(error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map