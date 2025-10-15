# Journey System Requirements

## Overview
This document defines the core interfaces and data structures for the Journey system, which manages patient care journeys with message actions, delays, and conditional branching.

## Core Interfaces

### ActionNode
An action to be performed, like sending an SMS or making a call.

```typescript
interface ActionNode {
  id: string;
  type: 'MESSAGE';
  message: string;
  next_node_id: string | null;
}
```

**Fields:**
- `id`: Unique identifier for the node
- `type`: Always `'MESSAGE'` for action nodes
- `message`: The message content to be sent to the patient
- `next_node_id`: ID of the next node to execute, or `null` if this is the final node

### DelayNode
A simple time delay in the journey.

```typescript
interface DelayNode {
  id: string;
  type: 'DELAY';
  duration_seconds: number;
  next_node_id: string | null;
}
```

**Fields:**
- `id`: Unique identifier for the node
- `type`: Always `'DELAY'` for delay nodes
- `duration_seconds`: Number of seconds to wait before proceeding
- `next_node_id`: ID of the next node to execute after the delay, or `null` if this is the final node

### ConditionalNode
A conditional branch based on patient data.

```typescript
interface ConditionalNode {
  id: string;
  type: 'CONDITIONAL';
  condition: {
    // e.g., 'patient.age', 'patient.condition'
    field: string;
    // e.g., '>', '=', '!='
    operator: string;
    // value to compare against
    value: any;
  };
  // Which node to go to if the condition is true or false
  on_true_next_node_id: string | null;
  on_false_next_node_id: string | null;
}
```

**Fields:**
- `id`: Unique identifier for the node
- `type`: Always `'CONDITIONAL'` for conditional nodes
- `condition`: The condition to evaluate
  - `field`: The patient field to check (e.g., 'patient.age', 'patient.condition')
  - `operator`: Comparison operator (e.g., '>', '=', '!=', '<', '>=', '<=')
  - `value`: The value to compare against
- `on_true_next_node_id`: ID of the node to execute if the condition evaluates to true, or `null` to end
- `on_false_next_node_id`: ID of the node to execute if the condition evaluates to false, or `null` to end

### JourneyNode (Union Type)
```typescript
type JourneyNode = ActionNode | DelayNode | ConditionalNode;
```

A union type representing any valid node type in the journey system.

### Journey
The complete journey definition.

```typescript
interface Journey {
  id: string;
  name: string;
  start_node_id: string;
  nodes: JourneyNode[];
}
```

**Fields:**
- `id`: Unique identifier for the journey
- `name`: Human-readable name for the journey
- `start_node_id`: ID of the first node to execute when the journey starts
- `nodes`: Array of all nodes in the journey

### PatientContext
Patient data to evaluate conditionals against.

```typescript
interface PatientContext {
  id: string;
  age: number;
  language: 'en' | 'es';
  condition: 'hip_replacement' | 'knee_replacement';
}
```

**Fields:**
- `id`: Unique identifier for the patient
- `age`: Patient's age in years
- `language`: Patient's preferred language (English or Spanish)
- `condition`: Patient's medical condition

## Implementation Notes

### Node Processing
1. **MESSAGE nodes**: Log the message action (stubbed with console.log) and immediately proceed to the next node
2. **DELAY nodes**: Use `setTimeout` to schedule the next node execution after `duration_seconds`
3. **CONDITIONAL nodes**: Evaluate the condition against the patient context and branch to the appropriate next node

### Journey Execution Flow
1. Start with the node specified by `journey.start_node_id`
2. Process the current node according to its type
3. Navigate to the next node based on:
   - `next_node_id` for MESSAGE and DELAY nodes
   - `on_true_next_node_id` or `on_false_next_node_id` for CONDITIONAL nodes
4. Continue until reaching a node with no next node (`null`), indicating journey completion

### Validation Requirements
- All node IDs referenced in `start_node_id`, `next_node_id`, `on_true_next_node_id`, and `on_false_next_node_id` must exist in the `nodes` array
- Each journey must have at least one node
- The `start_node_id` must reference a valid node in the journey
- Circular references are allowed (e.g., for recurring messages)

### Error Handling
- Invalid node references should throw descriptive errors
- Unsupported condition operators should throw errors
- Missing patient context fields should be handled gracefully
