// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from '../config.js';

export function createBlock(type, isPlayerPlaced = false) { // creates standard block data object used within the world grid, including properties like type and health
    if (type === Config.BLOCK_AIR) { // handle Air blocks, represented directly by the constant value
        return Config.BLOCK_AIR;
    }
    const baseHp = Config.BLOCK_HP[type] ?? 0; // look up HP for block type, default to 0 if not found
    const currentHp = (type === Config.BLOCK_WATER) ? Infinity : baseHp; // set HP - water is indestructible
    return { // construct and return block object
        type: type,
        hp: currentHp,
        maxHp: baseHp,
        isPlayerPlaced: isPlayerPlaced
        // add other shared block properties here if needed, e.g.: lightEmitted: 0, lightPassThrough: 0.8, customData: null,
    };
}