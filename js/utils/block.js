// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from './config.js';

export function createBlock(type, isPlayerPlaced = false) { // create standard block data object used within world grid, including properties like type and health
    if (type === Config.BLOCK_AIR) { // handle AIR blocks, represented directly by the constant value
        return Config.BLOCK_AIR;
    }
    const baseHp = Config.BLOCK_HP[type] ?? 0; // look up HP for block type, default to 0 if not found
    let currentHp = baseHp; 
    if (type === Config.BLOCK_WATER) { // water and Ropes have special HP considerations
        currentHp = Infinity;
    }
    return { // construct and return block object
        type: type,
        hp: currentHp,
        maxHp: baseHp,
        isPlayerPlaced: isPlayerPlaced,
        isLit: false
        // add other shared properties here if needed, e.g.: lightPassThrough: 0.8, customData: null,
    };
}