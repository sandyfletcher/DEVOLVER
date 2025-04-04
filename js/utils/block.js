// -----------------------------------------------------------------------------
// js/utils/block.js - Block Object Creation and Definition
// -----------------------------------------------------------------------------
console.log("utils/block.js loaded");

import * as Config from '../config.js';

/**
 * Creates a standard block data object used within the world grid.
 * Includes essential properties like type, orientation, and health.
 *
 * @param {number} type - The block type ID (e.g., Config.BLOCK_DIRT, Config.BLOCK_WATER).
 *                       Must be one of the constants defined in Config.
 * @param {number} [orientation=Config.ORIENTATION_FULL] - The block's orientation ID.
 *                       Defaults to a full, non-sloped block.
 * @returns {object | number} Returns a block object { type, orientation, hp, maxHp }
 *                            or returns Config.BLOCK_AIR (which is typically 0) directly
 *                            if type is Config.BLOCK_AIR.
 */
export function createBlock(type, orientation = Config.ORIENTATION_FULL) {
    // Handle the special case for Air blocks - they are represented directly by the constant value.
    if (type === Config.BLOCK_AIR) {
        return Config.BLOCK_AIR;
    }

    // Look up the base HP for this block type from the configuration.
    // Use nullish coalescing operator (??) to default to 0 if the type isn't found in BLOCK_HP.
    const baseHp = Config.BLOCK_HP[type] ?? 0;

    // Set current HP. Water is treated as indestructible for gameplay purposes.
    // Other blocks start at their maximum HP.
    const currentHp = (type === Config.BLOCK_WATER) ? Infinity : baseHp;

    // Construct and return the block object.
    return {
        type: type,
        orientation: orientation,
        hp: currentHp,
        maxHp: baseHp
        // --- Future extension point ---
        // Add other shared block properties here if needed later, e.g.:
        // lightEmitted: 0,
        // lightPassThrough: 0.8,
        // customData: null,
    };
}

// --- Potential Future Additions in this Module ---
// You could add more block-related utility functions here, for example:
//
// export function getBlockHardness(type) {
//   return Config.BLOCK_HARDNESS[type] ?? 1;
// }
//
// export function isBlockSolidForPhysics(type) {
//    return type !== Config.BLOCK_AIR && type !== Config.BLOCK_WATER; // Example logic
// }
//
// export function doesBlockEmitLight(type) {
//    return Config.BLOCK_LIGHT_EMISSION[type] > 0;
// }