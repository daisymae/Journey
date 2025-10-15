"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JourneyRun = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ExecutionLogEntrySchema = new mongoose_1.Schema({
    timestamp: { type: Date, required: true },
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true, enum: ['MESSAGE', 'DELAY', 'CONDITIONAL'] },
    action: { type: String, required: true },
    details: { type: mongoose_1.Schema.Types.Mixed },
}, { _id: false });
const JourneyRunSchema = new mongoose_1.Schema({
    runId: { type: String, required: true, index: true, unique: true },
    journeyId: { type: String, required: true },
    patientId: { type: String, required: true, index: true },
    currentNodeId: { type: String, default: null },
    status: { type: String, required: true, enum: ['active', 'waiting', 'completed', 'failed'], index: true },
    wakeUpAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    executionLog: { type: [ExecutionLogEntrySchema], required: true, default: [] },
    errorMessage: { type: String },
}, {
    timestamps: true,
    toJSON: {
        versionKey: false,
        transform: (_doc, ret) => {
            // Remove mongoose internals
            delete ret._id;
            // Convert dates to ISO strings
            if (ret.wakeUpAt)
                ret.wakeUpAt = new Date(ret.wakeUpAt).toISOString();
            else
                ret.wakeUpAt = null;
            if (ret.startedAt)
                ret.startedAt = new Date(ret.startedAt).toISOString();
            if (ret.completedAt)
                ret.completedAt = new Date(ret.completedAt).toISOString();
            else
                ret.completedAt = null;
            if (Array.isArray(ret.executionLog)) {
                ret.executionLog = ret.executionLog.map((e) => (Object.assign(Object.assign({}, e), { timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : undefined })));
            }
            return ret;
        }
    }
});
// Indexes
JourneyRunSchema.index({ runId: 1 }, { unique: true });
JourneyRunSchema.index({ patientId: 1, status: 1, wakeUpAt: 1 });
JourneyRunSchema.index({ status: 1, wakeUpAt: 1 });
exports.JourneyRun = mongoose_1.default.models.JourneyRun || mongoose_1.default.model('JourneyRun', JourneyRunSchema);
