// -----------------------------------------------------------------------------
// js/world-data.js - Manages the core world grid data structure
// -----------------------------------------------------------------------------
console.log("world-data.js loaded");

import * as Config from '../config.js';
// Import createBlock as it's needed when setting block data
import { createBlock } from './block.js';

// --- Module State ---
let worldGrid = []; // The single source of truth for world block data

// --- Internal Helper (Optional but good practice) ---
// Can be used by generator for direct access if needed, but public functions are preferred
/*
function _setRawBlock(c, r, blockData) {
    if (worldGrid[r]) {
        worldGrid[r][c] = blockData;
    }
}
*/

// --- Public API ---

/**
 * Initializes the world grid array structure with default values (e.g., Air).
 * Must be called before generating or setting blocks.
 */
export function initializeGrid() {
    console.log(`Initializing world grid (${Config.GRID_ROWS}x${Config.GRID_COLS})...`);
    worldGrid = new Array(Config.GRID_ROWS);
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        // Initialize each row with BLOCK_AIR
        worldGrid[r] = new Array(Config.GRID_COLS).fill(Config.BLOCK_AIR);
    }
    console.log("World grid initialized.");
}


/**
 * Gets the block object or BLOCK_AIR at specific grid coordinates.
 * Handles boundary checks.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {object | number | null} Block object, BLOCK_AIR (0), or null if out of bounds.
 */
export function getBlock(col, row) {
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        // Ensure row exists before accessing column (should exist after initializeGrid)
        return worldGrid[row]?.[col] ?? Config.BLOCK_AIR;
    }
    return null; // Out of bounds
}

/**
 * Gets the block type ID at specific grid coordinates.
 * Handles boundary checks.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {number | null} Block type ID or null if out of bounds.
 */
export function getBlockType(col, row) {
    const block = getBlock(col, row); // Use the existing getter which handles bounds
    if (block === null) return null; // Was out of bounds

    // Check if it's an air block (represented by the number 0) or a block object
    return (typeof block === 'number' && block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

/**
 * Sets a block in the grid using type and orientation. Creates the block object.
 * Handles boundary checks. This is the primary way to modify the grid.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @param {number} blockType - The type ID of the block to place (e.g., Config.BLOCK_STONE).
 * @param {number} [orientation=Config.ORIENTATION_FULL] - The orientation for the new block.
 * @returns {boolean} True if the block was set successfully, false otherwise (e.g., out of bounds).
 */
export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        // Ensure the row exists (should after init)
        if (!worldGrid[row]) {
             console.error(`Row ${row} does not exist in worldGrid! Initialization error?`);
             return false; // Cannot set block
        }
        // Use the imported createBlock function to generate the data structure
        worldGrid[row][col] = createBlock(blockType, orientation);
        return true;
    } else {
        // Optional: console.warn(`Set block out of bounds: ${row}, ${col}`);
        return false; // Out of bounds
    }
}

/**
 * Directly sets the block data at given coordinates. Less safe, assumes blockData is valid.
 * Primarily intended for use by the world generator for efficiency if needed,
 * but using setBlock is generally safer. Handles boundary checks.
 * @param {number} col Column index.
 * @param {number} row Row index.
 * @param {object|number} blockData The block object or BLOCK_AIR constant.
 * @returns {boolean} True if set, false if out of bounds.
 */
export function setBlockData(col, row, blockData) {
     if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
         if (!worldGrid[row]) {
              console.error(`Row ${row} does not exist in worldGrid! Initialization error?`);
              return false;
         }
         worldGrid[row][col] = blockData;
         return true;
     }
     return false;
}


/**
 * Retrieves the entire world grid array. Use with caution - modifying this
 * directly bypasses safety checks in setBlock/getBlock.
 * Primarily for read-only operations or bulk processing where performance is critical.
 * @returns {Array<Array<object|number>>} The world grid 2D array.
 */
export function getGrid() {
    return worldGrid;
}

// --- Optional: Add functions for bulk operations if needed later ---
// export function setRegion(startX, startY, width, height, blockType) { ... }
// export function loadGrid(newGridData) { ... }