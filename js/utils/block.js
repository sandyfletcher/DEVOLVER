// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------

import * as Config from './config.js';

export function createBlock(type, isPlayerPlaced = false) {
    if (type === Config.BLOCK_AIR) {
        return Config.BLOCK_AIR;
    }

    const properties = Config.BLOCK_PROPERTIES[type];
    if (!properties) {
        console.error(`createBlock: Unknown block type ${type}. Defaulting to AIR.`);
        return Config.BLOCK_AIR;
    }

    let currentHp = properties.hp;
    // Water has Infinity HP, no special handling needed here if Infinity is set in BLOCK_PROPERTIES

    return {
        type: type,
        hp: currentHp,
        maxHp: properties.hp, // maxHp is the same as initial hp from properties
        translucency: properties.translucency,
        isPlayerPlaced: isPlayerPlaced,
        isLit: false,
        lightLevel: 0.0, // transitioning to having light be a range instead of binary
        isBurnt: false // future use
    };
}