// -----------------------------------------------------------------------------
// js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------
console.log("worldManager.js loaded");

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as GridRenderer from './utils/grid.js';
import * as WorldData from './utils/worldData.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';

// --- Module State ---
let gridCanvas = null; // Still need reference for drawing
let showGrid = true;   // State for toggling grid visibility

// --- PUBLIC EXPORTED FUNCTIONS ---

/**
 * Initializes the world manager: initializes grid data, generates world, prepares drawing layers.
 */
export function init() {
    console.time("WorldManagerInit");

    // Step 1: Initialize the grid data structure
    WorldData.initializeGrid();

    // Step 2: Generate the initial world content
    generateInitialWorld(); // Call the imported generation function

    // Step 3: Setup rendering specifics (grid canvas)
    gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        const gridWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
        const gridHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;
        Renderer.createGridCanvas(gridWidth, gridHeight);
        gridCanvas = Renderer.getGridCanvas();
    } else {
        // Optional: Resize if necessary
        const expectedWidth = Config.GRID_COLS * Config.BLOCK_WIDTH;
        const expectedHeight = Config.GRID_ROWS * Config.BLOCK_HEIGHT;
        if (gridCanvas.width !== expectedWidth || gridCanvas.height !== expectedHeight) {
             console.warn("WorldManager Init: Resizing existing grid canvas.");
             gridCanvas.width = expectedWidth;
             gridCanvas.height = expectedHeight;
        }
    }

    // Step 4: Draw the static grid onto the off-screen canvas
    if (gridCanvas && Renderer.getGridContext()) {
        GridRenderer.drawStaticGrid();
    } else { console.error("WorldManager Init: Failed to get grid canvas/context!"); }

    console.timeEnd("WorldManagerInit");
    console.log("World Manager initialized.");
}

/**
 * Toggles the visibility of the static grid overlay.
 * @param {boolean} [visible] - Optional. Sets visibility directly if provided.
 */
export function toggleGrid(visible) {
    showGrid = (visible === undefined) ? !showGrid : visible;
    console.log(`Grid visibility set to: ${showGrid}`);
}

// --- Getters and Setters (Public API - Delegate to WorldData) ---

/** Gets the block object or BLOCK_AIR at specific grid coordinates. */
export function getBlock(col, row) {
    return WorldData.getBlock(col, row); // Delegate
}

/** Gets the block type ID at specific grid coordinates. */
export function getBlockType(col, row) {
    return WorldData.getBlockType(col, row); // Delegate
}

/** Sets a block in the grid using type and orientation. */
export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    const success = WorldData.setBlock(col, row, blockType, orientation); // Delegate
    if (success) {
        // TODO: Add logic here to mark this block/chunk as "dirty" for optimized drawing/rendering
        // Example: maybe call a function like RenderingCache.markDirty(col, row);
    }
    // else { console.warn(`WorldManager: Failed to set block at ${col}, ${row}`); }
    return success; // Return success status
}

// --- Drawing ---
/** Draws the visible portion of the world onto the main canvas context. */
export function draw(ctx) {
    if (!ctx) { console.error("WorldManager.draw: No context!"); return; }

    // 1. Draw Static Grid Layer (if enabled)
    if (showGrid && gridCanvas) {
        // TODO: Consider camera/viewport position when drawing grid
        ctx.drawImage(gridCanvas, 0, 0);
    }

    // 2. Draw Dynamic Blocks (Using data from WorldData)
    // TODO: Implement viewport culling - calculate startRow/endRow, startCol/endCol based on camera
    const startRow = 0; const endRow = Config.GRID_ROWS;
    const startCol = 0; const endCol = Config.GRID_COLS;

    for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
            // Get block data using the public API from WorldData
            const block = WorldData.getBlock(c, r);

            if (!block || block === Config.BLOCK_AIR) continue; // Skip air/null

            // Block is guaranteed to be an object here (unless it's BLOCK_AIR(0))
            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) continue; // Skip if no color defined

            // TODO: Adjust drawing position based on camera/viewport
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation;

            if (orientation === Config.ORIENTATION_FULL) {
                ctx.fillStyle = blockColor;
                // Using floor/ceil for potential pixel snapping if camera aligns perfectly
                ctx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
            } else {
                 // Placeholder for drawing slopes/other orientations
                 ctx.fillStyle = blockColor; // Base color
                 ctx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
                 ctx.fillStyle = "rgba(0,0,0,0.2)"; // Indicate non-full block
                 ctx.font = '8px sans-serif';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(orientation, blockX + Config.BLOCK_WIDTH / 2, blockY + Config.BLOCK_HEIGHT / 2); // Draw orientation ID
            }
        }
    }
}

// --- Update function (for world effects like grass spread, water flow - future) ---
/**
 * Updates the world state over time (e.g., simulations). Placeholder for now.
 * @param {number} dt - Delta time in seconds.
 */
export function update(dt) {
    // Placeholder for future world simulation logic
    // - Grass spreading to adjacent dirt
    // - Water flowing (simple cellular automata?)
    // - Sand falling?
    // - Block updates (e.g., damage ticks, state changes)
    // This function would likely iterate relevant parts of the grid
    // using WorldData.getBlock/setBlock and apply rules based on dt.
}