"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const database_1 = require("./utils/database");
const patients_1 = __importDefault(require("./routes/patients"));
const journeys_1 = __importDefault(require("./routes/journeys"));
const runs_1 = __importDefault(require("./routes/runs"));
const errorHandler_1 = require("./middleware/errorHandler");
const journeyExecutor_1 = require("./services/journeyExecutor");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use('/patients', patients_1.default);
    app.use('/journeys', journeys_1.default);
    app.use('/journeys', runs_1.default);
    // Health check
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use(errorHandler_1.errorHandler);
    return app;
}
if (process.env.NODE_ENV !== 'test') {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        const app = createApp();
        yield (0, database_1.connectDB)().catch((err) => {
            console.error('[ERROR][DB] Could not connect to MongoDB on startup', err);
        });
        // Attempt to recover any overdue waiting runs on startup
        yield journeyExecutor_1.journeyExecutor.recoverDueRuns().catch((err) => {
            console.error('[ERROR][EXECUTOR] Recovery failed on startup', err);
        });
        const server = app.listen(config_1.PORT, () => {
            console.log(`[ENGINE] Server listening on port ${config_1.PORT}`);
        });
        const shutdown = (signal) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`[ENGINE] Received ${signal}. Shutting down...`);
            server.close(() => __awaiter(void 0, void 0, void 0, function* () {
                // Stop timers to avoid dangling timeouts
                journeyExecutor_1.journeyExecutor.stopAllTimers();
                yield (0, database_1.disconnectDB)();
                process.exit(0);
            }));
        });
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }))();
}
exports.default = createApp;
