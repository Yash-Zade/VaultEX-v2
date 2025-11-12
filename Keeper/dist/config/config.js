"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    rpc: {
        httpUrl: process.env.RPC_HTTP_URL || '',
        wsUrl: process.env.RPC_WS_URL || '',
        chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
    },
    contracts: {
        positionManager: process.env.POSITION_MANAGER_ADDRESS || '',
        vamm: process.env.VAMM_ADDRESS || '',
        positionNft: process.env.POSITION_NFT_ADDRESS || '',
    },
    wallet: {
        privateKey: process.env.PRIVATE_KEY || '',
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/perpetual-keeper',
    },
    bot: {
        liquidationCheckInterval: parseInt(process.env.LIQUIDATION_CHECK_INTERVAL || '60000', 10),
        fundingUpdateInterval: parseInt(process.env.FUNDING_UPDATE_INTERVAL || '28800000', 10),
        maxGasPrice: process.env.MAX_GAS_PRICE || '50',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};
function validateConfig() {
    const required = [
        'RPC_HTTP_URL',
        'RPC_WS_URL',
        'POSITION_MANAGER_ADDRESS',
        'VAMM_ADDRESS',
        'POSITION_NFT_ADDRESS',
        'PRIVATE_KEY',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
//# sourceMappingURL=config.js.map