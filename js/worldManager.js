// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

// console.log("worldManager loaded");

import * as Config from './config.js';
import * as Renderer from './renderer.js'; // Needs access to the grid canvas/context
import * as GridRenderer from './utils/grid.js'; // For drawing grid lines on static canvas
import * as WorldData from './utils/worldData.js';
import { generateInitialWorld } from './utils/worldGenerator.js';

// --- Draw the entire static world to the off-screen canvas ---
function renderStaticWorldToGridCanvas() {
    console.log("Rendering initial static world blocks to off-screen canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }
    // Clear the entire off-screen canvas first
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    // Iterate through the grid data
    const worldGrid = WorldData.getGrid(); // Get the raw grid data for efficiency
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r][c]; // Access data directly
            if (!block || block === Config.BLOCK_AIR) continue; // Skip air blocks
            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) continue; // Skip if no color defined
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation;
            // --- Draw the block onto the GRID CANVAS (using gridCtx) ---
            if (orientation === Config.ORIENTATION_FULL) {
                gridCtx.fillStyle = blockColor;
                // Use floor/ceil for potential pixel snapping
                gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
            } else {
                 // Placeholder for drawing slopes/other orientations onto the static canvas
                 gridCtx.fillStyle = blockColor; // Base color
                 gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
                 gridCtx.fillStyle = "rgba(0,0,0,0.2)"; // Indicate non-full block visually
                 gridCtx.font = '8px sans-serif';
                 gridCtx.textAlign = 'center';
                 gridCtx.textBaseline = 'middle';
                 // Draw orientation ID for debugging/visualization
                 gridCtx.fillText(orientation, blockX + Config.BLOCK_WIDTH / 2, blockY + Config.BLOCK_HEIGHT / 2);
            }
        }
    }

    // --- Optional: Draw grid lines on top of the blocks ---
    // TODO: make this toggleable and add the option to the sidebar UI
    // GridRenderer.drawStaticGrid();

    console.log("Static world blocks rendered to off-screen canvas.");
}

// --- Helper function to update a single block on the off-screen canvas ---
function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    const block = WorldData.getBlock(col, row); // Get the *new* block data from the source
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    // Use Math.ceil for width/height to avoid 1-pixel gaps when clearing/redrawing
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);
    // 1. Clear the area of the changed block on the grid canvas, Math.floor for x/y positioning
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
    // 2. If the new block is not air, redraw it in the cleared area
    if (block && block !== Config.BLOCK_AIR) {
        const blockType = block.type;
        const blockColor = Config.BLOCK_COLORS[blockType];
        if (blockColor) {
            const orientation = block.orientation;
            // Replicate the drawing logic from renderStaticWorldToGridCanvas
            if (orientation === Config.ORIENTATION_FULL) {
                gridCtx.fillStyle = blockColor;
                gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            } else {
                 // Placeholder drawing for non-full blocks
                 gridCtx.fillStyle = blockColor;
                 gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
                 gridCtx.fillStyle = "rgba(0,0,0,0.2)";
                 gridCtx.font = '8px sans-serif';
                 gridCtx.textAlign = 'center';
                 gridCtx.textBaseline = 'middle';
                 gridCtx.fillText(orientation, blockX + Config.BLOCK_WIDTH / 2, blockY + Config.BLOCK_HEIGHT / 2);
            }
        } else {
             console.warn(`WorldManager: No color defined for block type ${blockType} at [${col}, ${row}] during update.`);
        }
    }
}

// --- Initialize world manager: grid data, generate world, pre-render static blocks ---
export function init() {
    console.time("WorldManager initialized");
    // Step 1: Initialize the grid data structure in WorldData
    WorldData.initializeGrid();
    // Step 2: Generate the initial world content into WorldData
    generateInitialWorld();
    // Step 3: Ensure the grid canvas exists (must be created by Renderer *before* this init runs)
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: WorldManager Init - Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before World.init().");
        console.warn("WorldManager Init: Attempting fallback grid canvas creation.");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("WorldManager Init: Fallback grid canvas creation failed.");
        }
    }
    // Step 4: Render the static world data onto the off-screen canvas
    renderStaticWorldToGridCanvas();

    console.timeEnd("WorldManager initialized");
}

// --- Getters and Setters ---

/** Gets the block object or BLOCK_AIR at specific grid coordinates. */
export function getBlock(col, row) {
    return WorldData.getBlock(col, row); // Delegate
}
/** Gets the block type ID at specific grid coordinates. */
export function getBlockType(col, row) {
    return WorldData.getBlockType(col, row); // Delegate
}
/**
 * Sets a block in the grid using type and orientation.
 * Updates the underlying world data AND the static visual cache.
 * @returns {boolean} True if the block was set successfully, false otherwise.
 */
export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    // Step 1: Update the actual world data
    const success = WorldData.setBlock(col, row, blockType, orientation); // Delegate
    // Step 2: If data update was successful, update the visual cache
    if (success) {
        updateStaticWorldAt(col, row); // Update the corresponding part of the static off-screen canvas
    }
    // else { console.warn(`WorldManager: Failed to set block data at ${col}, ${row}`); } // Optional warning
    return success;
}

// --- Draw the pre-rendered static world onto  main canvas  ---
export function draw(ctx) {
    if (!ctx) { console.error("WorldManager.draw: No drawing context provided!"); return; }

    const gridCanvas = Renderer.getGridCanvas();

    if (gridCanvas) {
        // Draw the entire off-screen canvas containing the pre-rendered static world
        // TODO: Add camera/viewport adjustments here for scrolling
        // Example: ctx.drawImage(gridCanvas, startCol * Config.BLOCK_WIDTH, startRow * Config.BLOCK_HEIGHT, viewWidth, viewHeight, -camera.x, -camera.y, viewWidth, viewHeight);
        ctx.drawImage(gridCanvas, 0, 0); // Simple draw at origin for now
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }
}

// --- Update function (for world effects like grass spread, water flow - future) ---
/**
 * Placeholder to updates world state over time (e.g., water flow, grass spread, block decay). 
 * IMPORTANT: Any block changes made here MUST call updateStaticWorldAt(c, r).
 * @param {number} dt - Delta time in seconds.
 */
export function update(dt) {
    // Example (Conceptual):
    // if (shouldGrassSpread) {
    //    for (/* each dirt block next to grass */) {
    //       if (Math.random() < GRASS_SPREAD_CHANCE * dt) {
    //          const { c, r } = /* coordinates of dirt block */;
    //          // Update the data AND the visual cache
    //          setBlock(c, r, Config.BLOCK_GRASS); // setBlock handles calling updateStaticWorldAt
    //       }
    //    }
    // }
}