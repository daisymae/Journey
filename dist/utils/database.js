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
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config");
function log(msg) {
    console.log(`[DB] ${msg}`);
}
function connectDB() {
    return __awaiter(this, arguments, void 0, function* (uri = config_1.MONGODB_URI) {
        try {
            log(`Connecting to ${uri}`);
            const conn = yield mongoose_1.default.connect(uri);
            log('Connected');
            return conn;
        }
        catch (err) {
            console.error('[ERROR][DB] Failed to connect', err);
            throw err;
        }
    });
}
function disconnectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connection.close();
            log('Disconnected');
        }
        catch (err) {
            console.error('[ERROR][DB] Failed to disconnect', err);
        }
    });
}
// Attach event listeners once
mongoose_1.default.connection.on('error', (err) => {
    console.error('[ERROR][DB] Connection error', err);
});
mongoose_1.default.connection.on('disconnected', () => {
    log('Connection lost');
});
