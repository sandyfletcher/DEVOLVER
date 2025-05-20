// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from './config.js';

export function createBlock(type, isPlayerPlaced = false) {
    if (type === Config.BLOCK_AIR) { // "AIR" is effectively null (right??)
        return Config.BLOCK_AIR;
    }
    const baseHp = Config.BLOCK_HP[type] ?? 0; // look up HP for block type, default to 0 if not found
    let currentHp = baseHp;
    if (type === Config.BLOCK_WATER) {
        currentHp = Infinity;
    }
    const translucency = Config.BLOCK_TRANSLUCENCY[type] ?? 0.0; // get translucency (or default to opaque)
    return { // construct and return block object
        type: type,
        hp: currentHp,
        maxHp: baseHp,
        translucency: translucency,
        isPlayerPlaced: isPlayerPlaced,
        isLit: false,
        isBurnt: false
    };
}