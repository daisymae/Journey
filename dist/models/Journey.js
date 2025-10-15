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
exports.Journey = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Node_1 = require("./Node");
const JourneySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    start_node_id: { type: String, required: true },
    nodes: { type: [Node_1.NodeSchema], required: true, default: [] },
}, { timestamps: true, toJSON: { virtuals: true, versionKey: false, transform: (_, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            return ret;
        } } });
// Validation of node references and start node
JourneySchema.pre('validate', function (next) {
    const doc = this;
    if (!doc.nodes || doc.nodes.length === 0) {
        return next(new Error('Journey must have at least one node'));
    }
    const ids = new Set(doc.nodes.map((n) => n.id));
    if (!ids.has(doc.start_node_id)) {
        return next(new Error('start_node_id must reference an existing node'));
    }
    for (const n of doc.nodes) {
        if (n.type === 'MESSAGE' || n.type === 'DELAY') {
            if (n.next_node_id != null && !ids.has(n.next_node_id)) {
                return next(new Error(`Node ${n.id} references missing next_node_id ${n.next_node_id}`));
            }
        }
        else if (n.type === 'CONDITIONAL') {
            if (n.on_true_next_node_id != null && !ids.has(n.on_true_next_node_id)) {
                return next(new Error(`Node ${n.id} references missing on_true_next_node_id ${n.on_true_next_node_id}`));
            }
            if (n.on_false_next_node_id != null && !ids.has(n.on_false_next_node_id)) {
                return next(new Error(`Node ${n.id} references missing on_false_next_node_id ${n.on_false_next_node_id}`));
            }
        }
    }
    next();
});
exports.Journey = mongoose_1.default.models.Journey || mongoose_1.default.model('Journey', JourneySchema);
