// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';

// -----------------------------------------------------------------------------
// --- Water Simulation ---
// -----------------------------------------------------------------------------

// --- Use a Map to store coordinates that need checking, preventing duplicates ---
let waterUpdateQueue = new Map(); // Map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // Timer to control spread speed
// --- Add coordinates to the water update queue ---
function addWaterUpdateCandidate(col, row) {
// add only if within bounds and below the water line threshold
     if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
         const key = `${col},${row}`;
// only add if not already in the queue
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
    const worldGrid = WorldData.getGrid();
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r][c];
            if (!block || block === Config.BLOCK_AIR) continue;
            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue;
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation;
            const isPlayerPlaced = block.isPlayerPlaced ?? false; // default to false if property is missing
// draw block body onto GRID CANVAS using gridCtx
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
// draw Outline if Player Placed ---
            if (isPlayerPlaced) {
                 gridCtx.save(); // save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
// adjust coordinates for stroke to be inside the block boundaries
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                 gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     Math.ceil(Config.BLOCK_WIDTH) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     Math.ceil(Config.BLOCK_HEIGHT) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // restore context state
            }
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
    WorldData.initializeGrid();
    generateInitialWorld();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before World.init().");
        console.warn("Attempting fallback grid canvas creation.");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("Fallback grid canvas creation failed.");
        }
    }
    renderStaticWorldToGridCanvas();
    seedWaterUpdateQueue();
    console.timeEnd("WorldManager initialized");
}
// --- Seed water update queue with initial water blocks and adjacent air candidates below the waterline ---
function seedWaterUpdateQueue() {
    waterUpdateQueue.clear(); // start fresh
     console.log("Seeding initial water update queue...");
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = WorldData.getBlockType(c, r); // use WorldData function directly
            if (blockType === Config.BLOCK_WATER) {
                // add water block itself (it might need to flow)
                addWaterUpdateCandidate(c, r);
                // add adjacent air blocks below the waterline (potential places to flow into)
                const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
                neighbors.forEach(neighbor => {
                    const nc = c + neighbor.dc;
                    const nr = r + neighbor.dr;
                    if (WorldData.getBlockType(nc, nr) === Config.BLOCK_AIR && nr >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                         addWaterUpdateCandidate(nc, nr);
                    }
                });
            } else if (blockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                addWaterUpdateCandidate(c, r); // any air block below the water line is potential candidate to be filled
            }
        }
    }
     console.log(`Initial water update queue size: ${waterUpdateQueue.size}`);
}
// Sets a block in grid, then updates the underlying world data and static visual cache
function internalSetBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL, isPlayerPlaced = false) {
    const success = WorldData.setBlock(col, row, blockType, orientation, isPlayerPlaced); // use setBlock from WorldData
    if (success) {
        updateStaticWorldAt(col, row);
         // If an air block appeared below water line, add it to water update queue
         if (blockType === Config.BLOCK_AIR && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
             addWaterUpdateCandidate(col, row);
         }
    }
    // else { console.error(`WorldManager: Failed to set block data at ${col}, ${row}`); }
    return success;
}
// Sets a player-placed block - assumes validity checks (range, clear, neighbor) are done by the caller (Player class).
export function placePlayerBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    // Use the internalSetBlock function, marking it as player placed
    const success = internalSetBlock(col, row, blockType, orientation, true); // Set isPlayerPlaced = true
    return success;
}
// Applies damage to a block at the given coordinates. If block HP drops to 0, it's replaced with air and drops an item.
export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage dealt
    const block = WorldData.getBlock(col, row);
    // Check if block is valid, breakable, and not already air/water/out of bounds
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.hp === Infinity) {
        return false;
    }
    const rowBeforeDamage = row; // Store row before potential destruction
    const blockTypeBeforeDamage = block.type; // Store type before potential destruction
// Apply damage
    block.hp -= damageAmount;
// Check for destruction
    if (block.hp <= 0) {
// Determine Drop Type
        let dropType = null;
        switch (blockTypeBeforeDamage) { // Use the type BEFORE it was set to air
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
// TODO: more cases for breakable blocks that drop items here
        }
// --- Spawn Item Drop (if any) ---
        if (dropType) {
// position slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            ItemManager.spawnItem(dropX + offsetX, dropY + offsetY, dropType);
            // console.log(` > Spawning ${dropType} at ~${(dropX + offsetX).toFixed(1)}, ${(dropY + offsetY).toFixed(1)}`);
        }
// --- Replace Block with Air ---
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

    if (gridCanvas) { // Draw the entire off-screen canvas containing the pre-rendered static world
        ctx.drawImage(gridCanvas, 0, 0);
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }
}
// --- Update World Effects - handles dynamic world state like water flow ---
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
// Logic to fill AIR with WATER - An air block becomes water if it's below the water line AND adjacent to water.
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
// Logic for WATER to propagate (from water blocks)
            if (currentBlockType === Config.BLOCK_WATER) {
// Check for air directly below (prioritize vertical flow)
                if (WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR) {
                    addWaterUpdateCandidate(c, r + 1); // Queue the air block below
                }
// Check for sideways flow over solid ground: water tries to flow sideways IF the block below it is solid or water
                const blockBelow = WorldData.getBlock(c, r + 1);
                const blockBelowType = blockBelow?.type ?? Config.BLOCK_AIR; // Handle case where getBlock returns 0
                if (blockBelow !== null && (blockBelowType !== Config.BLOCK_AIR)) { // Block below exists and is solid or water
                    if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) { // Check left
                        addWaterUpdateCandidate(c - 1, r); // Queue the air block to the left
                    }
                    if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) { // Check right
                        addWaterUpdateCandidate(c + 1, r); // Queue the air block to the right
                    }
                }
            }
        });
    }
}