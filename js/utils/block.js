// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

// --- Creates a standard block data object used within the world grid, including properties like type and health --- 
export function createBlock(type, isPlayerPlaced = false) {
    if (type === Config.BLOCK_AIR) {// Handle Air blocks, represented directly by the constant value
        return Config.BLOCK_AIR;
    }
    // Look up HP for block type, default to 0 if type isn't found
    const baseHp = Config.BLOCK_HP[type] ?? 0;
    // Set HP. Water is indestructible
    const currentHp = (type === Config.BLOCK_WATER) ? Infinity : baseHp;
    // Construct and return block object
    return {
        type: type,
        hp: currentHp,
        maxHp: baseHp,
        isPlayerPlaced: isPlayerPlaced
        // Add other shared block properties here if needed later, e.g.:
        // lightEmitted: 0,
        // lightPassThrough: 0.8,
        // customData: null,
    };
}