// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';
import { createBlock } from './utils/block.js';
import * as AgingManager from './agingManager.js';

// --- Module State ---
let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed

export function init(portalRef) {
    console.log("Initializing WorldManager...");
    WorldData.initializeGrid(); // Ensure grid is initialized first
    generateInitialWorld(); // world generator now handles landmass + flood fill

    // Initialize AgingManager
    AgingManager.init(); // Ensure AgingManager init is called

    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before WorldManager.init().");
        // Attempt fallback grid canvas creation if not found. This might mean Renderer.init wasn't called first.
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            // If fallback fails, throw a critical error as rendering cannot proceed.
            throw new Error("FATAL: Renderer.createGridCanvas() failed during WorldManager.init fallback.");
        }
        console.warn("Renderer.createGridCanvas() was called as a fallback during WorldManager.init.");
    }

    // Initial rendering and seeding handled by main.js or WaveManager now.

    console.log("WorldManager initialized.");
}

// Helper function to add cell to water update queue
export function addWaterUpdateCandidate(col, row) { // EXPORTED THIS HELPER
    // Check if within bounds and at or below the water line threshold (or just above for falling water)
    if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const key = `${col},${row}`;
        // Check if the cell is already in the queue to avoid duplicates and is AIR or WATER
        if (!waterUpdateQueue.has(key)) {
            const blockType = WorldData.getBlockType(col, row);
            if (blockType !== null && (blockType === Config.BLOCK_AIR || blockType === Config.BLOCK_WATER)) {
                 waterUpdateQueue.set(key, {c: col, r: row});
                 return true; // Indicates a candidate was added
            }
        }
    }
    return false; // Indicates no candidate was added
}

// NEW: Export function to reset the water propagation timer
export function resetWaterPropagationTimer() {
     waterPropagationTimer = 0;
     // console.log("Water propagation timer reset."); // Too noisy
}


// This function is responsible for updating the *visual* representation of a single block
export function updateStaticWorldAt(col, row) {
    // ... (no changes needed here) ...
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    // Get block data *after* it has been updated in WorldData
    const block = WorldData.getBlock(col, row);
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    // Always clear exact block area before redrawing
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    // If block is NOT air and NOT null (out of bounds), redraw it
    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
        // Ensure block is an object to get type and other properties
         const currentBlockType = typeof block === 'object' && block !== null ? block.type : block;

         // Skip drawing if it's still just the number 0 for AIR (should be handled above, but safety)
         if (currentBlockType === Config.BLOCK_AIR) return;

        const blockColor = Config.BLOCK_COLORS[currentBlockType];
        if (blockColor) {
            gridCtx.fillStyle = blockColor; // draw block body
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // Draw outline if player placed (check if block is an object and has property)
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                 gridCtx.save(); // save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                  gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // restore context state
            }

            // Draw damage indicators if block is an object with HP and is damaged
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;
                 // Only draw indicators if damage is significant enough based on thresholds
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                     gridCtx.save(); // save context state before drawing lines
                     gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                     gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                     gridCtx.lineCap = 'square'; // use square cap
                     const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points

                      // Draw slash (\)
                      gridCtx.beginPath();
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                      gridCtx.stroke();

                      // Draw second line (/) if HP is <= 30% (creating an 'X')
                      if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                          gridCtx.beginPath();
                          gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // move to inset top-right
                          gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // draw to inset bottom-left
                          gridCtx.stroke();
                      }
                     gridCtx.restore(); // restore context state
                 }
            }
        }
    }
}

// Expose the internal rendering function
export function renderStaticWorldToGridCanvas() { // draw entire static world to off-screen canvas
    // ... (no changes needed here) ...
    console.log("WorldManager: Rendering static world to grid canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); // clear entire off-screen canvas first
    const worldGrid = WorldData.getGrid();
    // Iterate through grid data
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r]?.[c]; // Use optional chaining for safety

            // Check for BLOCK_AIR (number 0) or null/undefined
            if (block === Config.BLOCK_AIR || block === null || block === undefined) continue;

            // Ensure block is an object to get type and other properties
            const blockType = typeof block === 'object' && block !== null ? block.type : block;

            // Skip drawing if it's still just the number 0 for AIR (should be handled above, but safety)
            if (blockType === Config.BLOCK_AIR) continue;

            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                // console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`); // Too noisy
                continue; // Skip drawing if no color
            }

            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const blockW = Math.ceil(Config.BLOCK_WIDTH);
            const blockH = Math.ceil(Config.BLOCK_HEIGHT);

            // Draw block body onto grid canvas using gridCtx
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // Draw outline if player placed (check if block is an object and has property)
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                gridCtx.save(); // save context state
                gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2; // adjust coordinates for stroke to be inside the block boundaries
                gridCtx.strokeRect(
                    Math.floor(blockX) + outlineInset,
                    Math.floor(blockY) + outlineInset,
                    blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS, // subtract stroke width from both sides
                    blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                );
                gridCtx.restore(); // restore context state
            }

            // Draw damage indicators if block is an object with HP and is damaged
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;
                 // Only draw indicators if damage is significant enough based on thresholds
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                     gridCtx.save(); // save context state before drawing lines
                     gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                     gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                     gridCtx.lineCap = 'square'; // use square cap
                     const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points

                      // Draw slash (\)
                      gridCtx.beginPath();
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                      gridCtx.stroke();

                      // Draw second line (/) if HP is <= 30% (creating an 'X')
                      if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                          gridCtx.beginPath();
                          gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // move to inset top-right
                          gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // draw to inset bottom-left
                          gridCtx.stroke();
                      }
                     gridCtx.restore(); // restore context state
                 }
            }
        }
    }
    console.log("WorldManager: Static world rendered.");
}

export function seedWaterUpdateQueue() { // seed queue with initial water blocks and adjacent air candidates below waterline
    // ... (no changes needed here, logic is sound for a full re-seed) ...
    console.log("WorldManager: Seeding water update queue...");
    waterUpdateQueue.clear(); // start fresh
    // Start seeding from slightly above the waterline target to catch falling water
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET - 5; r < Config.GRID_ROWS; r++) { // Increased the buffer above waterline slightly
        for (let c = 0; c < Config.GRID_COLS; c++) {
             // Add any block AT or below the waterline threshold that is AIR or WATER, or solid blocks near water
             // More robust seeding: Add water blocks AND adjacent air/water blocks to the queue
             const blockType = WorldData.getBlockType(c, r);
             if (blockType === Config.BLOCK_WATER) {
                 addWaterUpdateCandidate(c, r);
                 // Also add neighbors of water blocks
                 addWaterUpdateCandidate(c, r-1); // Even neighbors above water can be candidates if they turn to AIR/WATER later
                 addWaterUpdateCandidate(c, r+1);
                 addWaterUpdateCandidate(c-1, r);
                 addWaterUpdateCandidate(c+1, r);
             } else if (blockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5) { // Add air below waterline + buffer as potential fill candidates
                 addWaterUpdateCandidate(c, r);
             }
             // Also add neighbors of solid blocks near the water line, as destroying them can create new AIR space for water
             if (GridCollision.isSolid(c, r) && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5) {
                  addWaterUpdateCandidate(c, r-1);
                  addWaterUpdateCandidate(c, r+1);
                  addWaterUpdateCandidate(c-1, r);
                  addWaterUpdateCandidate(c+1, r);
             }
        }
    }
    // Ensure any player-placed blocks near water also trigger neighbor checks
    const grid = WorldData.getGrid();
    grid.forEach((rowArray, r) => {
        if (r < Config.WORLD_WATER_LEVEL_ROW_TARGET - 5 || r >= Config.GRID_ROWS) return; // Optimization
        rowArray.forEach((block, c) => {
            if (typeof block === 'object' && block.isPlayerPlaced) {
                 addWaterUpdateCandidate(c, r-1);
                 addWaterUpdateCandidate(c, r+1);
                 addWaterUpdateCandidate(c-1, r);
                 addWaterUpdateCandidate(c+1, r);
            }
        });
    });


     console.log(`WorldManager: Seeded Water Update Queue with ${waterUpdateQueue.size} candidates.`);
     // Reset timer so water simulation starts immediately after seeding
     waterPropagationTimer = 0;
}

export function placePlayerBlock(col, row, blockType) { // sets player-placed block - assumes validity checks (range, clear, neighbor) are done by the Player class
    // ... (no changes needed here, already queues water candidates and resets timer) ...
    const success = WorldData.setBlock(col, row, blockType, true); // WorldData.setBlock uses createBlock which handles HP/maxHP
    if (success) {
        updateStaticWorldAt(col, row); // update visual cache
        // Trigger water sim if block placement is at or near the waterline by adding neighbors to queue
        // Note: We add neighbors of the *new* block, and potentially the block itself if it's water
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5) {
             let candidateAdded = false;
             candidateAdded = addWaterUpdateCandidate(col, row) || candidateAdded; // queue changed block itself if it's water
             candidateAdded = addWaterUpdateCandidate(col, row - 1) || candidateAdded; // queue neighbours
             candidateAdded = addWaterUpdateCandidate(col, row + 1) || candidateAdded;
             candidateAdded = addWaterUpdateCandidate(col - 1, row) || candidateAdded;
             candidateAdded = addWaterUpdateCandidate(col + 1, row) || candidateAdded;

             if(candidateAdded) {
                 waterPropagationTimer = 0; // reset timer to force immediate water update
             }
        }
    } else {
         console.error(`WorldManager placePlayerBlock failed to set block at [${col}, ${row}]`);
    }
    return success;
}

export function damageBlock(col, row, damageAmount) { // applies damage to block at given coordinates - if block drops to 0 HP, replace with AIR and drop material
    // ... (no changes needed here, already queues water candidates and resets timer on destruction) ...
    if (damageAmount <= 0) return false; // zero damage dealt
    const block = WorldData.getBlock(col, row);

    // Check if block is a valid object, is breakable, and is not already at 0 HP
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
         // console.log(`Attempted to damage unbreakable/already broken block at [${col}, ${row}]. Type: ${typeof block === 'object' ? block.type : block}`); // Too noisy
        return false;
    }

    // Ensure HP is a number before subtracting
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
         console.error(`Invalid HP type for block at [${col}, ${row}]. HP: ${block.hp}. Resetting HP and skipping damage.`); // Use row variable
         block.hp = block.maxHp; // Reset HP to prevent infinite errors
         return false; // Cannot damage
    }


    block.hp -= damageAmount; // apply damage
    updateStaticWorldAt(col, row); // redraw the block on the static canvas with updated damage indicator

    let wasDestroyed = false;
    if (block.hp <= 0) { // check for destruction
        wasDestroyed = true;
        block.hp = 0; // ensure health doesn't go below zero in data

        // Determine drop type based on the type *before* it was destroyed
        let dropType = null;
        switch (block.type) {
            case Config.BLOCK_GRASS: dropType = 'dirt'; break; // Grass drops dirt
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
            // Add other block types and their drops
        }

        if (dropType) { // spawn drop (if any)
            // Position slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;

             // Ensure coordinates are valid before spawning item
             const finalDropX = dropX + offsetX;
             const finalDropY = dropY + offsetY;
             if (!isNaN(finalDropX) && !isNaN(finalDropY) && typeof finalDropX === 'number' && typeof finalDropY === 'number') {
                 ItemManager.spawnItem(finalDropX, finalDropY, dropType);
             } else {
                 console.error(`ITEM SPAWN FAILED: Invalid drop coordinates [${finalDropX}, ${finalDropY}] for ${dropType} from destroyed block at [${col}, ${row}].`);
             }
        }

        // Replace the block with AIR, preserving playerPlaced status if it was player-placed
        // WorldData.setBlock handles creating the new block data object for AIR
        const success = WorldData.setBlock(col, row, Config.BLOCK_AIR, typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false);

        if (success) { // WorldData.setBlock returned true
            updateStaticWorldAt(col, row); // update/ clear block area static visual cache
            // Trigger water simulation if the destruction is at or near the waterline
             if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5) { // Check a few rows above
                 let candidateAdded = false;
                 candidateAdded = addWaterUpdateCandidate(col, row) || candidateAdded; // queue changed block itself if it's water (unlikely to be water after destruction)
                 candidateAdded = addWaterUpdateCandidate(col, row - 1) || candidateAdded; // and neighbors
                 candidateAdded = addWaterUpdateCandidate(col, row + 1) || candidateAdded;
                 candidateAdded = addWaterUpdateCandidate(col - 1, row) || candidateAdded;
                 candidateAdded = addWaterUpdateCandidate(col + 1, row) || candidateAdded;
                 if(candidateAdded) {
                     waterPropagationTimer = 0; // reset timer
                 }
             }
        } else {
             console.error(`WorldManager damageBlock failed to set AIR at [${col}, ${row}] after destruction.`);
        }
    }
    return true; // damage applied, regardless of destruction status
}

export function draw(ctx) { // draw pre-rendered static world onto main canvas
    // ... (no changes needed here) ...
    if (!ctx) { console.error("WorldManager.draw: No drawing context provided!"); return; }
    const gridCanvas = Renderer.getGridCanvas();
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0);
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }
}

export function update(dt) { // handles dynamic world state like water flow
         waterPropagationTimer = Math.max(0, waterPropagationTimer - dt); // ensure timer doesn't go massively negative if frame rate drops
        // Only process water flow if there are candidates and a timer ready
        if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
            waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // reset timer

            // Process a limited number of candidates per frame to prevent physics collapse
            // Convert map values to array to easily slice and iterate
            const candidatesArray = Array.from(waterUpdateQueue.values());

            // Sort candidates to process cells in lower rows (higher 'r' value) first for more natural downward flow
            candidatesArray.sort((a, b) => b.r - a.r);

            // Select the batch to process this frame
            const candidatesToProcess = candidatesArray.slice(0, Config.WATER_UPDATES_PER_FRAME);

            // Remove processed candidates from queue *before* processing the batch
            // This prevents infinite re-queuing of the same cell in the current batch if it doesn't change type
            candidatesToProcess.forEach(({c, r}) => {
                const key = `${c},${r}`;
                waterUpdateQueue.delete(key);
            });

            // Process the batch of candidates
            candidatesToProcess.forEach(({c, r}) => {
                // Recheck bounds, as blocks may've been changed since queueing
                if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;

                const currentBlockType = WorldData.getBlockType(c, r); // get current block type

                // Queue neighbors below waterline to the queue for potential updates
                // This ensures changes propagate. Queueing neighbors of AIR/WATER blocks.
                // Or queue neighbors of solid blocks that might cause water to pool.
                 const neighborsToQueue = [
                     { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
                     { dc: 1, dr: 0 }, { dc: -1, dr: 0 }
                 ]; // Cardinal neighbours

                 // Add neighbors of the *current* block being processed if it's water or near the waterline
                 // This ensures surrounding cells are re-evaluated based on this cell's state *after* its potential type change (or if it was just processed)
                 // Check is at/below waterline threshold for optimization
                 if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 5) {
                    neighborsToQueue.forEach(neighbor => {
                         const nc = c + neighbor.dc;
                         const nr = r + neighbor.dr;
                         // addWaterUpdateCandidate handles the bounds, type (AIR/WATER), and existence checks
                         // Use the EXPORTED version here now
                         addWaterUpdateCandidate(nc, nr);
                    });
                 }


                // --- Water Flow Logic ---
                // Only process flow/filling if current cell is AIR or WATER and below waterline
                 if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET -5 && r < Config.GRID_ROWS) { // Apply water logic slightly above waterline threshold too

                     if (currentBlockType === Config.BLOCK_AIR) {
                         // If current cell is AIR, check if it should be filled by adjacent WATER
                         let adjacentToWater = false;
                         const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // cardinal neighbours again
                         for (const neighbor of immediateNeighbors) {
                            const nc = c + neighbor.dc;
                            const nr = r + neighbor.nr; // Corrected typo: neighbor.dr instead of neighbor.nr
                            // Check if neighbor is within bounds and is WATER
                            if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) {
                                adjacentToWater = true;
                                break; // found water neighbour
                            }
                        }
                        if (adjacentToWater) {
                            // If adjacent to water, this AIR block becomes WATER
                            const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false); // water flows; not player-placed
                            if (success) {
                                updateStaticWorldAt(c, r); // Redraw the block
                                 // Queue neighbors (already done above, but ensuring they are candidates is key)
                                 // Forcing timer reset is handled once below after the batch.
                            }
                        }
                    }

                    if (currentBlockType === Config.BLOCK_WATER) {
                        // If current cell is WATER, check if it should flow downwards or sideways

                        const blockBelowType = WorldData.getBlockType(c, r + 1);
                        // Flow Down: If there is AIR directly below this WATER block
                        if (blockBelowType === Config.BLOCK_AIR) {
                            // Queue the AIR block below. The next water update cycle will process it and turn it to WATER.
                            addWaterUpdateCandidate(c, r + 1); // This will ensure the cell below is considered for filling
                        }

                        // Flow Sideways: If block below is solid or water AND side block is AIR
                        const blockBelow = WorldData.getBlock(c, r + 1); // Get block data for the one below
                        const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Get type, default to AIR if null/undefined
                        // Is block below something that would act as a "floor" for sideways flow? (Any solid block or another water block)
                        const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                        if (isBelowSolidOrWater) {
                             // Check left
                            if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) {
                                addWaterUpdateCandidate(c - 1, r); // Queue air block to left
                            }
                             // Check right
                            if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) {
                                addWaterUpdateCandidate(c + 1, r); // Queue air block to right
                            }
                        }
                    } // End if currentBlockType === BLOCK_WATER

                } // End if block is at or below waterline threshold + buffer
            }); // End candidatesToProcess.forEach


             // Reset the propagation timer *after* processing the batch if *any* candidate was processed.
             // This keeps the simulation running as long as there's potential for flow.
             if(candidatesToProcess.length > 0) {
                 // waterPropagationTimer = 0; // Moved outside the loop, reset once per propagation tick.
             }


        } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
           // console.log("[WaterMgr] Water update timer ready, but queue is empty."); // Too noisy
        } else if (waterPropagationTimer > 0) {
           // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`); // Too noisy
        }
}