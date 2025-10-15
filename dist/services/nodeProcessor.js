"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCondition = evaluateCondition;
exports.processMessage = processMessage;
exports.processDelay = processDelay;
exports.processConditional = processConditional;
exports.processNode = processNode;
const messageService_1 = require("./messageService");
function evaluateCondition(condition, patient) {
    const { field, operator, value } = condition;
    // Resolve field path: support 'patient.age' or 'age'
    const key = field.startsWith('patient.') ? field.slice('patient.'.length) : field;
    const patientValue = patient[key];
    const warnMissing = () => {
        console.warn(`[CONDITIONAL] Missing patient field "${field}" for patient ${patient.id}`);
    };
    const validOps = ['=', '!=', '>', '<', '>=', '<='];
    if (!validOps.includes(operator)) {
        throw new Error(`Unsupported operator: ${operator}`);
    }
    if (patientValue === undefined) {
        warnMissing();
        switch (operator) {
            case '=':
                return value === undefined;
            case '!=':
                return value !== undefined;
            default:
                return false;
        }
    }
    switch (operator) {
        case '=':
            return patientValue === value;
        case '!=':
            return patientValue !== value;
        case '>':
            return Number(patientValue) > Number(value);
        case '<':
            return Number(patientValue) < Number(value);
        case '>=':
            return Number(patientValue) >= Number(value);
        case '<=':
            return Number(patientValue) <= Number(value);
        default:
            throw new Error(`Unsupported operator: ${operator}`);
    }
}
function processMessage(node, ctx) {
    (0, messageService_1.sendMessage)(ctx.id, node.message);
    return { nextNodeId: node.next_node_id };
}
function processDelay(node, ctx, scheduler, scheduleNext) {
    var _a;
    const delayMs = Math.max(0, (node.duration_seconds || 0) * 1000);
    console.log(`[DELAY] Waiting ${node.duration_seconds}s before next node ${(_a = node.next_node_id) !== null && _a !== void 0 ? _a : 'END'} (patient ${ctx.id})`);
    scheduler(() => scheduleNext(node.next_node_id), delayMs);
}
function processConditional(node, ctx) {
    const result = evaluateCondition(node.condition, ctx);
    const nextNodeId = result ? node.on_true_next_node_id : node.on_false_next_node_id;
    console.log(`[CONDITIONAL] Evaluated ${node.condition.field} ${node.condition.operator} ${JSON.stringify(node.condition.value)} => ${result} (patient ${ctx.id})`);
    return { nextNodeId, result };
}
function processNode(node, ctx, scheduler, scheduleNext) {
    switch (node.type) {
        case 'MESSAGE': {
            const { nextNodeId } = processMessage(node, ctx);
            scheduleNext(nextNodeId);
            return;
        }
        case 'DELAY': {
            processDelay(node, ctx, scheduler, scheduleNext);
            return;
        }
        case 'CONDITIONAL': {
            const { nextNodeId } = processConditional(node, ctx);
            scheduleNext(nextNodeId);
            return;
        }
        default:
            // Exhaustive check
            const neverNode = node;
            throw new Error(`Unsupported node type: ${neverNode.type}`);
    }
}
