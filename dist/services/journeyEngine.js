"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeJourney = executeJourney;
const nodeProcessor_1 = require("./nodeProcessor");
function buildNodeMap(journey) {
    const map = {};
    for (const node of journey.nodes) {
        map[node.id] = node;
    }
    return map;
}
function validateJourney(journey, map) {
    if (!journey.nodes || journey.nodes.length === 0) {
        throw new Error('Journey must have at least one node');
    }
    if (!map[journey.start_node_id]) {
        throw new Error('start_node_id must reference an existing node');
    }
    const ids = new Set(Object.keys(map));
    for (const n of journey.nodes) {
        if (n.type === 'MESSAGE' || n.type === 'DELAY') {
            const next = n.next_node_id;
            if (next != null && !ids.has(next)) {
                throw new Error(`Node ${n.id} references missing next_node_id ${next}`);
            }
        }
        else if (n.type === 'CONDITIONAL') {
            const t = n.on_true_next_node_id;
            const f = n.on_false_next_node_id;
            if (t != null && !ids.has(t))
                throw new Error(`Node ${n.id} references missing on_true_next_node_id ${t}`);
            if (f != null && !ids.has(f))
                throw new Error(`Node ${n.id} references missing on_false_next_node_id ${f}`);
        }
    }
}
function executeJourney(journey, patient, options) {
    const scheduler = (options === null || options === void 0 ? void 0 : options.scheduler) || ((cb, ms) => setTimeout(cb, ms));
    const map = buildNodeMap(journey);
    validateJourney(journey, map);
    console.log(`[ENGINE] Starting journey ${journey.id} for patient ${patient.id} at node ${journey.start_node_id}`);
    const run = (nodeId) => {
        if (nodeId == null) {
            console.log(`[ENGINE] Journey ${journey.id} completed for patient ${patient.id}`);
            return;
        }
        const node = map[nodeId];
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }
        console.log(`[ENGINE] Processing node ${node.id} (${node.type}) for patient ${patient.id}`);
        (0, nodeProcessor_1.processNode)(node, patient, scheduler, (next) => {
            run(next);
        });
    };
    run(journey.start_node_id);
}
