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
import * as AgingManager from './agingManager.js'; // Import AgingManager if needed later

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
    if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
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

export function resetWaterPropagationTimer() {
     waterPropagationTimer = 0;
}

// NEW: Helper to queue cell and its neighbors for water updates if they are candidates
export function queueWaterCandidatesAroundChange(c, r) {
     let candidateAdded = false;
     candidateAdded = addWaterUpdateCandidate(c, r) || candidateAdded; // Add the changed block itself if it's a valid water candidate type
     candidateAdded = addWaterUpdateCandidate(c, r - 1) || candidateAdded; // Add neighbors
     candidateAdded = addWaterUpdateCandidate(c, r + 1) || candidateAdded;
     candidateAdded = addWaterUpdateCandidate(c - 1, r) || candidateAdded;
     candidateAdded = addWaterUpdateCandidate(c + 1, r) || candidateAdded;

     // If any candidate was added to the queue, reset the timer to force an immediate water update pass
     if (candidateAdded) {
         resetWaterPropagationTimer();
     }
}


// update visual representation of a single block
export function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    const block = WorldData.getBlock(col, row); // get block data *after* it has been updated in WorldData
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH); // always clear exact block area before redrawing
    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) { // if block is NOT air and NOT null (out of bounds), redraw it
         const currentBlockType = typeof block === 'object' && block !== null ? block.type : block; // ensure block is an object to get type and other properties
         if (currentBlockType === Config.BLOCK_AIR) return; // skip drawing if it's still just the number 0 for AIR (should be handled above, but safety)
        const blockColor = Config.BLOCK_COLORS[currentBlockType];
        if (blockColor) {
            gridCtx.fillStyle = blockColor; // draw block body
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false; // draw outline if player placed (check if block is an object and has property)
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
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp) { // draw damage indicators if block is an object with HP and is damaged
                const hpRatio = block.hp / block.maxHp;
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // only draw indicators if damage is significant enough based on thresholds
                    gridCtx.save(); // save context state before drawing lines
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square'; // use square cap
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points
                    gridCtx.beginPath(); // draw slash (\)
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();
                    if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) { // Draw second line (/) if HP is <= 30% (creating an 'X')
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
export function renderStaticWorldToGridCanvas() { // draw entire static world to off-screen canvas
    console.log("WorldManager: Rendering static world to grid canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); // clear entire off-screen canvas first
    const worldGrid = WorldData.getGrid();
    for (let r = 0; r < Config.GRID_ROWS; r++) { // iterate through grid data
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const block = worldGrid[r]?.[c]; // use optional chaining for safety
            if (block === Config.BLOCK_AIR || block === null || block === undefined) continue; // check for BLOCK_AIR (number 0) or null/undefined
            const blockType = typeof block === 'object' && block !== null ? block.type : block; // ensure block is an object to get type and other properties
            if (blockType === Config.BLOCK_AIR) continue; // skip drawing if it's still just the number 0 for AIR (should be handled above, but safety)
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`); // too noisy?
                continue; // skip drawing if no color
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const blockW = Math.ceil(Config.BLOCK_WIDTH);
            const blockH = Math.ceil(Config.BLOCK_HEIGHT);
            gridCtx.fillStyle = blockColor; // draw block body onto grid canvas using gridCtx
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false; // draw outline if player placed (check if block is an object and has property)
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
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp) { // draw damage indicators if block is an object with HP and is damaged
                const hpRatio = block.hp / block.maxHp;
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // only draw indicators if damage is significant enough based on thresholds
                    gridCtx.save(); // save context state before drawing lines
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square'; // use square cap
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points
                    gridCtx.beginPath(); // draw slash (\)
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();
                    if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) { // draw second line (/) if HP is <= 30% (creating an 'X')
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
export function seedWaterUpdateQueue() { // seed queue with initial water blocks and adjacent air candidates below waterline
    console.log("WorldManager: Seeding water update queue...");
    waterUpdateQueue.clear(); // start fresh
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) { // start seeding from slightly above waterline target to catch falling water
        for (let c = 0; c < Config.GRID_COLS; c++) {
             const blockType = WorldData.getBlockType(c, r); // add to queue WATER blocks, adjacent AIR/WATER at or below waterline threshold, or solid blocks near water
             if (blockType === Config.BLOCK_WATER) {
                 // Only add the water block itself if it's *above* the water line. Below it, assume it's stable initially.
                 // The neighbor checks below will handle areas adjacent to existing water.
                 // if (r < Config.WORLD_WATER_LEVEL_ROW_TARGET) { // This check might be too strict, let's keep it simple.
                     addWaterUpdateCandidate(c, r); // Add the water block itself regardless of row for robustness
                 // }

                 // Always add neighbors of water blocks (if they are candidates) regardless of their row vs waterline
                 // This is important for water receding/flowing into new spaces opened by aging/mining
                 addWaterUpdateCandidate(c, r-1); // even neighbors above water can be candidates if they turn to AIR/WATER later
                 addWaterUpdateCandidate(c, r+1);
                 addWaterUpdateCandidate(c-1, r);
                 addWaterUpdateCandidate(c+1, r);
             } else if (blockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // add air below waterline + buffer as potential fill candidates
                 addWaterUpdateCandidate(c, r);
             }
             // Also add neighbors of any solid block below the waterline buffer, as destroying them creates AIR for water to flow into
             if (GridCollision.isSolid(c, r) && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // also add neighbors of solid blocks near the water line, as destroying them can create new AIR space for water
                  addWaterUpdateCandidate(c, r-1);
                  addWaterUpdateCandidate(c, r+1);
                  addWaterUpdateCandidate(c-1, r);
                  addWaterUpdateCandidate(c+1, r);
             }
        }
    }
    const grid = WorldData.getGrid(); // ensure any player-placed blocks near water also trigger neighbor checks
    grid.forEach((rowArray, r) => {
        if (r < Config.WORLD_WATER_LEVEL_ROW_TARGET || r >= Config.GRID_ROWS) return; // Optimization
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
    waterPropagationTimer = 0; // reset timer so water simulation starts immediately after seeding
}

export function placePlayerBlock(col, row, blockType) { // sets player-placed block - assumes validity checks (range, clear, neighbor) are done by the Player class
    const success = WorldData.setBlock(col, row, blockType, true); // WorldData.setBlock uses createBlock which handles HP/maxHP
    if (success) {
        updateStaticWorldAt(col, row); // update visual cache
        // Note: We add neighbors of the *new* block, and potentially the block itself if it's water
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // trigger water sim if block placement is at or near waterline by adding neighbors of *new* block (and potentially block itself if water) to queue
            // Use the new helper function
            queueWaterCandidatesAroundChange(col, row);
        }
    } else {
        console.error(`WorldManager placePlayerBlock failed to set block at [${col}, ${row}]`);
    }
    return success;
}
export function damageBlock(col, row, damageAmount) { // applies damage to block at given coordinates - if block drops to 0 HP, replace with AIR and drop material
    if (damageAmount <= 0) return false; // zero damage dealt
    const block = WorldData.getBlock(col, row); // check if block is a valid object, is breakable, and is not already at 0 HP
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false;
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) { // ensure HP is a number before subtracting
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
        let dropType = null;
        switch (block.type) { // Determine drop type based on the type *before* it was destroyed
            case Config.BLOCK_GRASS: dropType = 'dirt'; break; // Grass drops dirt
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
            // TODO: Add other block types and their drops
        }
        if (dropType) { // spawn drop (if any) slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            const finalDropX = dropX + offsetX; // Ensure coordinates are valid before spawning item
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
             if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                 // Use the new helper function
                 queueWaterCandidatesAroundChange(col, row);
             }
        } else {
             console.error(`WorldManager damageBlock failed to set AIR at [${col}, ${r}] after destruction.`); // Fixed row variable
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
                if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) { // Corrected check for c
                    // console.warn(`Water update candidate [${c},${r}] out of bounds during processing.`); // Too noisy
                    return; // Skip if out of bounds
                }


                const currentBlockType = WorldData.getBlockType(c, r); // get current block type *again* inside the loop

                // Queue neighbors below waterline to the queue for potential updates
                // This ensures changes propagate. Queueing neighbors of AIR/WATER blocks.
                // Or queue neighbors of solid blocks that might cause water to pool.
                 // This neighbor queueing is now done by queueWaterCandidatesAroundChange when a block *type* changes (aging, mining, placing)
                 // We should NOT queue neighbors here *within* the water update loop, as it leads to excessive queue growth.
                 // If a block *remains* AIR or WATER after processing (i.e., it didn't fill or stay filled), it will be re-added
                 // to the queue in the logic below IF it's part of an active flow/spread.


                // --- Water Flow Logic ---
                // Only process flow/filling if current cell is AIR or WATER and below waterline
                 if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET -5 && r < Config.GRID_ROWS) { // Apply water logic slightly above waterline threshold too

                     if (currentBlockType === Config.BLOCK_AIR) {
                         // If current cell is AIR, check if it should be filled by adjacent WATER
                         let adjacentToWater = false;
                         const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // cardinal neighbours again
                         for (const neighbor of immediateNeighbors) {
                            const nc = c + neighbor.dc;
                            const nr = r + neighbor.dr; // Corrected typo: neighbor.dr instead of neighbor.nr
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
                                // Re-add this cell (now water) and its neighbors to the queue for the NEXT pass
                                queueWaterCandidatesAroundChange(c, r); // Queue self (as water) and neighbors
                            } else {
                                // If setting block failed, maybe log error and ensure the cell isn't stuck in the queue?
                                // The remove logic at the start of the function handles queue removal for this batch.
                                console.warn(`Water flow failed to set block to WATER at [${c},${r}]`);
                            }
                        } else {
                            // If AIR cell does not become WATER, it means it's surrounded by non-WATER (AIR, SOLID, etc.).
                            // It should only be re-added to the queue if a neighbor changes to water.
                            // This is handled by queueWaterCandidatesAroundChange when a neighbor changes.
                        }
                    }

                    if (currentBlockType === Config.BLOCK_WATER) {
                        // If current cell is WATER, check if it should flow downwards or sideways

                        const blockBelowType = WorldData.getBlockType(c, r + 1);
                        // Flow Down: If there is AIR directly below this WATER block
                        if (blockBelowType === Config.BLOCK_AIR) {
                            // Queue the AIR block below. The next water update cycle will process it and turn it to WATER.
                            addWaterUpdateCandidate(c, r + 1); // This will ensure the cell below is considered for filling
                            // We do NOT queue this cell (c, r) again if it flows down - it remains WATER.
                        } else {
                             // Flow Sideways: If block below is solid or water AND side block is AIR
                             const blockBelow = WorldData.getBlock(c, r + 1); // Get block data for the one below
                             const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Get type, default to AIR if null/undefined
                             // Is block below something that would act as a "floor" for sideways flow? (Any solid block or another water block)
                             const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                             if (isBelowSolidOrWater) {
                                  // Check left
                                 if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) {
                                     addWaterUpdateCandidate(c - 1, r); // Queue air block to left
                                     // If water *spreads* sideways, re-add the current water block (c, r) to the queue
                                     // This ensures it's checked again in the next pass, potentially spreading further.
                                     addWaterUpdateCandidate(c, r); // Re-queue self
                                 }
                                  // Check right
                                 if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) {
                                     addWaterUpdateCandidate(c + 1, r); // Queue air block to right
                                      // If water *spreads* sideways, re-add the current water block (c, r) to the queue
                                     addWaterUpdateCandidate(c, r); // Re-queue self
                                 }
                             }
                        } // End else (block below is not AIR)
                    } // End if currentBlockType === BLOCK_WATER

                } // End if block is at or below waterline threshold + buffer
            }); // End candidatesToProcess.forEach


             // Reset the propagation timer *after* processing the batch if *any* candidate was processed.
             // This keeps the simulation running as long as there's potential for flow.
             // NOTE: This reset is now handled by queueWaterCandidatesAroundChange when a block type changes.
             // We might need a check here to *ensure* the timer is reset if any water flowed, even if no type change occurred.
             // Let's rely on queueWaterCandidatesAroundChange for now. It's called when AIR becomes WATER, or when water spreads sideways.

        } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
           // console.log("[WaterMgr] Water update timer ready, but queue is empty."); // Too noisy
        } else if (waterPropagationTimer > 0) {
           // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`); // Too noisy
        }
}