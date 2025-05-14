// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from './config.js';

export function createBlock(type, isPlayerPlaced = false) { // creates standard block data object used within the world grid, including properties like type and health
    if (type === Config.BLOCK_AIR) { // handle Air blocks, represented directly by the constant value
        return Config.BLOCK_AIR;
    }
    const baseHp = Config.BLOCK_HP[type] ?? 0; // look up HP for block type, default to 0 if not found
    // Water and Ropes have special HP considerations
    let currentHp = baseHp;
    if (type === Config.BLOCK_WATER) {
        currentHp = Infinity;
    }
    // For BLOCK_VEGETATION (the item), its HP might be different if it were a placeable solid block.
    // For BLOCK_ROPE, its HP is defined in BLOCK_HP.

    return { // construct and return block object
        type: type,
        hp: currentHp,
        maxHp: baseHp,
        isPlayerPlaced: isPlayerPlaced,
        isLit: false
        // add other shared block properties here if needed, e.g.: lightEmitted: 0, lightPassThrough: 0.8, customData: null,
    };
}