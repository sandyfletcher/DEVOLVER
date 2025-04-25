// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as GridRenderer from './utils/grid.js';
import * as WorldData from './utils/worldData.js'; // Keep this import for access to *all* WorldData functions
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
// REMOVED: import { getBlockType, getBlock, setBlock as worldDataSetBlock } from './utils/worldData.js';
// Now using WorldData.getBlock, WorldData.getBlockType, WorldData.setBlock directly

// --- Water Simulation State ---
// Use a Map to store coordinates that need checking, preventing duplicates
let waterUpdateQueue = new Map(); // Map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // Timer to control spread speed

// --- Helper function to add coordinates to the water update queue ---
function addWaterUpdateCandidate(col, row) {
    // Add only if within bounds and below the water line threshold
     if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
         const key = `${col},${row}`;
         // Only add if not already in the queue
         if (!waterUpdateQueue.has(key)) {
             waterUpdateQueue.set(key, {c: col, r: row});
         }
     }
}


// --- Draw the entire static world to the off-screen canvas ---
function renderStaticWorldToGridCanvas() {
    console.log("Rendering initial static world blocks to off-screen canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }
// clear the entire off-screen canvas first
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
// iterate through grid data
    const worldGrid = WorldData.getGrid(); // Use WorldData's function directly
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r][c];
            if (!block || block === Config.BLOCK_AIR) continue; // skip air blocks

            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                // console.warn(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue; // skip if no color defined
            }

            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation;
            const isPlayerPlaced = block.isPlayerPlaced ?? false; // Default to false if property is missing

// draw block body onto GRID CANVAS using gridCtx
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));

// --- Draw Outline if Player Placed ---
            if (isPlayerPlaced) {
                 gridCtx.save(); // Save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 // Adjust coordinates for stroke to be inside the block boundaries
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                 gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     Math.ceil(Config.BLOCK_WIDTH) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     Math.ceil(Config.BLOCK_HEIGHT) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // Restore context state
            }

            // Placeholder for orientation visuals if needed later
            // if (orientation !== Config.ORIENTATION_FULL) {
            //      gridCtx.fillStyle = "rgba(0,0,0,0.2)";
            //      gridCtx.font = '8px sans-serif';
            //      gridCtx.textAlign = 'center';
            //      gridCtx.textBaseline = 'middle';
            //      gridCtx.fillText(orientation, blockX + Config.BLOCK_WIDTH / 2, blockY + Config.BLOCK_HEIGHT / 2);
            // }
        }
    }
    // Optional: Draw grid lines over the world
    // GridRenderer.drawStaticGrid();
}

// --- Helper function to update a single block on the off-screen canvas ---
function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    const block = WorldData.getBlock(col, row); // Use WorldData's function directly
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    // Use Math.ceil for width/height to avoid 1-pixel gaps when clearing/redrawing
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);
    const isPlayerPlaced = block?.isPlayerPlaced ?? false; // Check new property, default false

// 1. Clear the area of the changed block on the grid canvas, Math.floor for x/y positioning
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

// 2. If the new block is not air, redraw it in the cleared area
    if (block && block !== Config.BLOCK_AIR) {
        const blockType = block.type;
        const blockColor = Config.BLOCK_COLORS[blockType];
        if (blockColor) {
            const orientation = block.orientation;

// Draw block body
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

// --- Draw Outline if Player Placed ---
            if (isPlayerPlaced) {
                 gridCtx.save(); // Save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                  gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // Restore context state
            }
        } else {
             console.warn(`WorldManager: No color defined for block type ${blockType} at [${col}, ${row}] during update.`);
        }
    }
}

// --- Initialize World Manager ---
export function init() {
    console.time("WorldManager initialized");
    // Step 1: Initialize the grid data structure in WorldData
    WorldData.initializeGrid(); // This now sets isPlayerPlaced: false by default
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
    // Step 5: Seed the water update queue from initially generated water/air pockets
    seedWaterUpdateQueue();

    console.timeEnd("WorldManager initialized");
}

// Seed the water update queue with initial water blocks and adjacent air candidates below the waterline
function seedWaterUpdateQueue() {
    waterUpdateQueue.clear(); // Start fresh
     console.log("Seeding initial water update queue...");
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = WorldData.getBlockType(c, r); // Use WorldData's function directly
            if (blockType === Config.BLOCK_WATER) {
                // Add the water block itself (it might need to flow)
                addWaterUpdateCandidate(c, r);
                // Add adjacent air blocks below the waterline (potential places to flow into)
                const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
                neighbors.forEach(neighbor => {
                    const nc = c + neighbor.dc;
                    const nr = r + neighbor.dr;
                    if (WorldData.getBlockType(nc, nr) === Config.BLOCK_AIR && nr >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // Use WorldData's function directly
                         addWaterUpdateCandidate(nc, nr);
                    }
                });
            } else if (blockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                // Add any air block below the water line as a potential candidate to be filled
                addWaterUpdateCandidate(c, r);
            }
        }
    }
     console.log(`Initial water update queue size: ${waterUpdateQueue.size}`);
}


// --- Getters and Setters ---

// REMOVED duplicate export functions: getBlock and getBlockType


// Sets a block in the grid using type and orientation. Updates the underlying world data AND the static visual cache.
// This is primarily for *natural* or *system-placed* blocks (like water filling in). Player placement uses placePlayerBlock.
// Renamed to internalSetBlock to make its internal use explicit within WorldManager.
function internalSetBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL, isPlayerPlaced = false) {
    // Use the delegated setBlock from WorldData
    const success = WorldData.setBlock(col, row, blockType, orientation, isPlayerPlaced); // Use WorldData's setBlock
    // Step 2: If data update was successful, update the visual cache
    if (success) {
        updateStaticWorldAt(col, row);
         // If an air block appeared below water line, add it to water update queue
         if (blockType === Config.BLOCK_AIR && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
             addWaterUpdateCandidate(col, row);
         }
    }
    // else { console.error(`WorldManager: Failed to set block data at ${col}, ${row}`); } // Commented out for less console noise
    return success;
}

/**
 * Places a block specifically by the player.
 * Assumes validity checks (range, clear, neighbor) are done by the caller (Player class).
 * This is the public method other modules should use for player placement.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @param {number} blockType - The type ID of the block to place.
 * @param {number} [orientation=Config.ORIENTATION_FULL] - The orientation.
 * @returns {boolean} True if placement was successful, false otherwise.
 */
export function placePlayerBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    // Use the internalSetBlock function, marking it as player placed
    const success = internalSetBlock(col, row, blockType, orientation, true); // Set isPlayerPlaced = true
    if (success) {
        // Optional: Remove from water queue if it was a candidate? Unlikely needed.
        // Water simulation handles flowing around the new block naturally on subsequent updates.
    }
    return success;
}


// --- Block Interaction ---

// Applies damage to a block at the given coordinates. If block HP drops to 0, it's replaced with air and drops an item.
export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage dealt
    const block = WorldData.getBlock(col, row); // Use WorldData's function directly
    // Check if block is valid, breakable, and not already air/water/out of bounds
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.hp === Infinity) {
        // console.log(`Block at [${col}, ${row}] is unbreakable or invalid.`); // Commented out for less noise
        return false; // Cannot damage air, water, out-of-bounds, or blocks without finite HP
    }

    const rowBeforeDamage = row; // Store row before potential destruction
    const blockTypeBeforeDamage = block.type; // Store type before potential destruction

    // Apply damage
    block.hp -= damageAmount;

    // Check for destruction
    if (block.hp <= 0) {
        // console.log(`Block [${col}, ${row}] destroyed!`);
        // --- Determine Drop Type ---
        let dropType = null;
        switch (blockTypeBeforeDamage) { // Use the type BEFORE it was set to air
            case Config.BLOCK_GRASS: dropType = 'dirt'; break; // Grass drops dirt
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            // Add cases for other breakable blocks that should drop items
        }
        // --- Spawn Drop Item (if any) ---
        if (dropType) {
            // Position slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // Random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            ItemManager.spawnItem(dropX + offsetX, dropY + offsetY, dropType);
            // console.log(` > Spawning ${dropType} at ~${(dropX + offsetX).toFixed(1)}, ${(dropY + offsetY).toFixed(1)}`); // Commented out
        }
        // --- Replace Block with Air ---
        // Use the internalSetBlock to ensure the visual cache is updated and water queue is handled
        internalSetBlock(col, row, Config.BLOCK_AIR, Config.ORIENTATION_FULL, false); // Destroyed blocks are not player-placed
    } else {
        // Block was damaged but not destroyed, update its state in the grid data.
        // (JavaScript objects are passed by reference, so the changes to block.hp are already in the grid).
        // No need to update the static visual cache here, as HP damage doesn't change its appearance yet.
    }
    return true; // Damage was applied or block was destroyed
}

// --- Draw the pre-rendered static world onto main canvas ---
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

// --- Update World Effects ---
// Handles dynamic world state like water flow.
export function update(dt) {
    // Update water simulation timer
    waterPropagationTimer -= dt;

    // Only process water flow if the timer is ready and there are candidates
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

        // Get and process a limited number of candidates from the queue
        // Convert Map values to an array to slice
        const candidatesToProcess = Array.from(waterUpdateQueue.values()).slice(0, Config.WATER_UPDATES_PER_FRAME);

        candidatesToProcess.forEach(({c, r}) => {
            // Remove from the queue AFTER getting its coordinates
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key);

            // Re-check bounds and type, as things might have changed since it was queued
            if (c < 0 || r < 0 || c >= Config.GRID_COLS || r >= Config.GRID_ROWS) return;

            const currentBlock = WorldData.getBlock(c, r); // Use WorldData's function directly
            const currentBlockType = currentBlock?.type ?? Config.BLOCK_AIR; // Handle case where getBlock returns 0

            // --- Logic to fill AIR with WATER ---
            // An air block becomes water if it's below the water line AND adjacent to water.
            // (Deferred: Exception for areas enclosed by player-placed blocks)
            if (currentBlockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                 // Check neighbors for water source
                 const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
                 let adjacentToWater = false;
                 for (const neighbor of neighbors) {
                     const nc = c + neighbor.dc;
                     const nr = r + neighbor.dr;
                     // Check if neighbor is within bounds AND is water
                     if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) { // Use WorldData's function directly
                         adjacentToWater = true;
                         break; // Found water neighbor
                     }
                 }

                 if (adjacentToWater) {
                     // Convert this AIR block to WATER. Use internalSetBlock to update WorldData and static canvas.
                     // internalSetBlock will also re-queue this cell's neighbors if they become air (unlikely here).
                     internalSetBlock(c, r, Config.BLOCK_WATER, Config.ORIENTATION_FULL, false); // Water is not player-placed
                     // Add neighbors (including the newly filled water block) to the queue for next updates
                     // This propagates the fill effect.
                     const neighborsAndSelf = [{dc: 0, dr: 0}, ...neighbors]; // Add self to queue for horizontal check next
                     neighborsAndSelf.forEach(neighbor => addWaterUpdateCandidate(c + neighbor.dc, r + neighbor.dr));

                 }
            }
            // --- Logic for WATER to propagate (from water blocks) ---
             if (currentBlockType === Config.BLOCK_WATER) {
                 // Check for air directly below (prioritize vertical flow)
                 if (WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR) { // Use WorldData's function directly
                     addWaterUpdateCandidate(c, r + 1); // Queue the air block below
                 }
                 // Check for sideways flow over solid ground: if block below is solid AND side block is air
                 // The condition "side block below is air" is not strictly needed for basic flow,
                 // as long as block below the *water* block is solid (or water).
                 // Let's simplify: Water tries to flow sideways IF the block below it is solid or water.
                 const blockBelow = WorldData.getBlock(c, r + 1); // Use WorldData's function directly
                 const blockBelowType = blockBelow?.type ?? Config.BLOCK_AIR; // Handle case where getBlock returns 0

                 if (blockBelow !== null && (blockBelowType !== Config.BLOCK_AIR)) { // Block below exists and is solid or water
                     // Check left
                     if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) { // Use WorldData's function directly
                         addWaterUpdateCandidate(c - 1, r); // Queue the air block to the left
                     }
                     // Check right
                      if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) { // Use WorldData's function directly
                         addWaterUpdateCandidate(c + 1, r); // Queue the air block to the right
                     }
                 }
             }
        });
    }
     // If the queue is large, maybe log it occasionally for debugging performance
     // if (waterUpdateQueue.size > 1000 && Math.random() < 0.01) {aaaaaaaaaaaaaa
     //      console.log(`Water queue size: ${waterUpdateQueue.size}`);
     // }
}