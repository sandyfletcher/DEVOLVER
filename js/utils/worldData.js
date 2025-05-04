// -----------------------------------------------------------------------------
// root/js/utils/worldData.js - Manages core world grid data structure
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import { createBlock } from './block.js';

let worldGrid = [];

export function initializeGrid() { // initialize world grid array structure with default values (air)
    worldGrid = new Array(Config.GRID_ROWS);
    for (let r = 0; r < Config.GRID_ROWS; r++) { // initialize each row with BLOCK_AIR using createBlock
        worldGrid[r] = new Array(Config.GRID_COLS).fill(createBlock(Config.BLOCK_AIR, false)); // explicitly set isPlayerPlaced: false
    }
}
export function getBlock(col, row) { // gets the block object or BLOCK_AIR at specific grid coordinates
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const block = worldGrid[row]?.[col]; // ensure row exists before accessing column (should exist after initializeGrid)
        return (block === undefined || block === null) ? Config.BLOCK_AIR : block; // return BLOCK_AIR (0) if the cell is explicitly 0 or undefined/null for some reason
    }
    return null; // out of bounds
}
export function getBlockType(col, row) { // gets the block type ID at specific grid coordinates
    const block = getBlock(col, row); // use the existing getter which handles bounds
    if (block === null) return null; // was out of bounds
    return (typeof block === 'number' && block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type; // check if it's an air block (represented by the number 0) or a block object
}
export function setBlock(col, row, blockType, isPlayerPlaced = false) { // sets block in grid using type, create block object using createBlock
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        if (!worldGrid[row]) { // ensure row exists
             console.error(`Row ${row} does not exist in worldGrid! Initialization error?`);
             return false; // cannot set block
        }
        worldGrid[row][col] = createBlock(blockType, isPlayerPlaced); // use createBlock function to generate data structure
        return true;
    } else {
        console.warn(`Set block out of bounds: ${row}, ${col}`);
        return false; // out of bounds
    }
}
export function setBlockData(col, row, blockData) { // directly sets block data at given coordinates, primarily used by world generator for efficiency during initial creation
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        if (!worldGrid[row]) {
            console.error(`Row ${row} does not exist in worldGrid! Initialization error?`);
            return false;
        }
        if (blockData === Config.BLOCK_AIR || (typeof blockData === 'object' && blockData !== null && typeof blockData.type === 'number')) { // ensure blockData is valid object or AIR before setting
            worldGrid[row][col] = blockData;
            return true;
        } else {
            console.error(`Attempted to set invalid block data at [${col}, ${row}]`, blockData);
            return false;
        }
    }
    console.warn(`Set block data out of bounds: ${row}, ${col}`); // Commented out for less console noise
    return false;
}
export function getGrid() { // retrieves the entire world grid array, bypassing safety checks in setBlock/getBlock
    return worldGrid;
}