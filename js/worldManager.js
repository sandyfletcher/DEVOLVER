// root/js/worldManager.js - Manages world state, drawing, and interactions

// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';

// -----------------------------------------------------------------------------
// --- Water Simulation ---
// -----------------------------------------------------------------------------

// --- Use a Map to store coordinates that need checking, preventing duplicates ---
let waterUpdateQueue = new Map(); // Map: "col,row" -> {c, r}
let waterPropagationTimer = 0;     // Timer to control spread speed

// --- Add coordinates to the water update queue ---
// Only adds cells that are within bounds, at or below the water line threshold,
// not already in the queue, AND are types that participate in water simulation (AIR or WATER).
function addWaterUpdateCandidate(col, row) {
    // Check if within bounds and at or below the water line threshold
    if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const key = `${col},${row}`;
        // Check if the cell is already in the queue to avoid duplicates
        if (!waterUpdateQueue.has(key)) {
            // Get the block type to check if it's a type that participates in water simulation
            const blockType = WorldData.getBlockType(col, row);

            // Add to queue only if it's BLOCK_AIR or BLOCK_WATER
            if (blockType !== null && (blockType === Config.BLOCK_AIR || blockType === Config.BLOCK_WATER))
            {
                waterUpdateQueue.set(key, {c: col, r: row});
            } // else: console.log(`[WaterQ] Did NOT add [${col}, ${row}]: Already in queue or Solid/Non-WaterSimulation Type (${blockType}).`);
        }
    }
}

// --- Internal function to set a block in grid data AND update the static visual cache ---
function internalSetBlock(col, row, blockType, isPlayerPlaced = false) {
    // Use setBlock from WorldData to update the underlying data structure
    const success = WorldData.setBlock(col, row, blockType, isPlayerPlaced);

    if (success) {
        // Always update the static visual cache on block data change
        // Pass the *new* block type to updateStaticWorldAt
        updateStaticWorldAt(col, row); // MODIFIED: No longer need to pass blockTypeAfterUpdate here

        // Trigger Water Simulation Update for Changed Area if below Waterline ---
        // If the change is at or below the water level threshold, queue this cell and its neighbors
        // for potential re-evaluation by the water simulation. addWaterUpdateCandidate
        // handles the checks for bounds and block type (only queues AIR/WATER).
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
            let addedToQueue = false;
            // Helper to add candidate and track if anything was actually added
            const tryAddCandidate = (c, r) => {
                const initialSize = waterUpdateQueue.size;
                addWaterUpdateCandidate(c, r); // This handles bounds, type, and existence checks
                if (waterUpdateQueue.size > initialSize) {
                    addedToQueue = true; // Set flag if queue size increased
                }
            };

            // Add the changed cell itself
            tryAddCandidate(col, row);

            // Add neighbors - necessary to propagate water away from a new solid block,
            // or into/away from a newly created AIR/WATER block.
            const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors
            neighbors.forEach(neighbor => tryAddCandidate(col + neighbor.dc, row + neighbor.dr));

            // --- CRITICAL FIX: Reset the propagation timer IF any candidates were added ---
            // This ensures the water simulation loop processes the change very soon.
            if (addedToQueue) {
                waterPropagationTimer = 0; // Force the timer to zero
                // console.log(`[WaterMgr] Block change at [${col}, ${row}] triggered water queue update. Resetting propagation timer.`);
            }
        }
    } else {
        console.log(`[WaterMgr] Failed to set block data at [${col}, ${row}].`);
    }
    return success;
}


// --- Draw the entire static world to the off-screen canvas ---
function renderStaticWorldToGridCanvas() {
    // console.log("Rendering initial static world blocks to off-screen canvas...");
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
            // Directly check for BLOCK_AIR (number 0) or null/undefined
            if (!block || typeof block === 'number' && block === Config.BLOCK_AIR) continue;

            const blockType = typeof block === 'object' ? block.type : block; // Get type property or use block value
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue;
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use Math.ceil for robustness
            const blockH = Math.ceil(Config.BLOCK_HEIGHT);

            // draw block body onto GRID CANVAS using gridCtx
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH); // Use Math.floor for origin

            // draw Outline if Player Placed ---
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // default to false if property is missing
            if (isPlayerPlaced) {
                 gridCtx.save(); // save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                // adjust coordinates for stroke to be inside the block boundaries
                const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                 gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS, // Subtract stroke width from both sides
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore(); // restore context state
            }

            // --- Draw Damage Indicators ---
            // Check if the block object exists, has HP and maxHp properties, and is potentially damaged
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;

                 gridCtx.save(); // Save context state before drawing lines
                 gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                 gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                 gridCtx.lineCap = 'square'; // Use square cap

                 // Calculate the effective inset for the line path points
                 // The stroke's center should be LINE_WIDTH / 2 from the edge.
                 // The path point should be LINE_WIDTH from the edge.
                 const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;


                 // Draw Slash (\) if HP is <= 70%
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                      gridCtx.beginPath();
                      // Move to inset top-left, draw to inset bottom-right
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 // Draw Second Line (/) if HP is <= 30% (creating an 'X')
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                      gridCtx.beginPath();
                       // Move to inset top-right, draw to inset bottom-left
                      gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 gridCtx.restore(); // Restore context state (removes line style changes)
            }
        }
    }
    // console.log("Initial static world rendered."); // Keep logs quieter
}

// --- Helper function to update a single block on the off-screen canvas ---
// Clears the block's area and redraws it if it's not air, INCLUDING DAMAGE INDICATORS.
// MODIFIED: Removed blockTypeAfterUpdate argument.
function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }

    // Get the block data *after* it has been updated in WorldData
    const block = WorldData.getBlock(col, row);

    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use Math.ceil for robustness
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    // --- Clear Area ---
    // Always clear the exact block area before redrawing (or not drawing if air)
    // If drawing the damage lines strictly within the block bounds works,
    // we don't need an expanded clear here.
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    // 2. If the block is NOT air and NOT null (out of bounds), redraw it
    // WorldData.getBlock returns 0 for AIR and null for out of bounds. Any other value is an object.
    // The drawing logic itself should still draw within the block's original bounds [blockX, blockY, blockW, blockH]
    if (block !== Config.BLOCK_AIR && block !== null) {
        const currentBlockType = typeof block === 'object' ? block.type : block;
        const blockColor = Config.BLOCK_COLORS[currentBlockType];

        if (blockColor) {
            // Draw block body
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // --- Draw Outline if Player Placed ---
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;
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

            // --- Draw Damage Indicators (Inset) ---
            // Check if the block object exists, has HP and maxHp properties, and is damaged
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) {
                 const hpRatio = block.hp / block.maxHp;

                 gridCtx.save(); // Save context state before drawing lines
                 gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                 gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                 gridCtx.lineCap = 'square'; // Use square cap

                // Calculate the effective inset for the line path points
                 // The stroke's center should be LINE_WIDTH / 2 from the edge.
                 // The path point should be LINE_WIDTH from the edge.
                 const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;


                 // Draw Slash (\) if HP is <= 70%
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                      gridCtx.beginPath();
                      // Move to inset top-left, draw to inset bottom-right
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 // Draw Second Line (/) if HP is <= 30% (creating an 'X')
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
                      gridCtx.beginPath();
                       // Move to inset top-right, draw to inset bottom-left
                      gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // MODIFIED: Use pathInset
                      gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset); // MODIFIED: Use pathInset
                      gridCtx.stroke();
                 }

                 gridCtx.restore(); // Restore context state
            }
        }
    }
    // If block IS AIR (or null), the drawing logic for block body/indicators is skipped,
    // and only the exact clearRect runs, leaving the area empty.
}


// --- Initialize World Manager ---
export function init() {
    console.time("WorldManager initialized");
    WorldData.initializeGrid();
    generateInitialWorld(); // This now includes the improved flood fill
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before World.init().");
        console.warn("Attempting fallback grid canvas creation.");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("Fallback grid canvas creation failed.");
        }
    }
    renderStaticWorldToGridCanvas(); // Draw the initially generated world
    seedWaterUpdateQueue(); // Seed the water simulation after world generation
    // console.timeEnd("WorldManager initialized");
}

// --- Seed water update queue with initial water blocks and adjacent air candidates below the waterline ---
function seedWaterUpdateQueue() {
    waterUpdateQueue.clear(); // start fresh
    // console.log("[WaterMgr] Seeding initial water update queue...");
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Add any block AT or below the waterline threshold that is AIR or WATER.
            // The addWaterUpdateCandidate function handles the bounds, queue.has check,
            // and whether the block type is valid for being in the queue.
            addWaterUpdateCandidate(c, r);
        }
    }
    // console.log(`[WaterMgr] Initial water update queue size after seeding: ${waterUpdateQueue.size}`);
}

// Sets a player-placed block - assumes validity checks (range, clear, neighbor) are done by the caller (Player class).
export function placePlayerBlock(col, row, blockType) {
    // Use the internalSetBlock function, marking it as player placed.
    // internalSetBlock now handles the water queue update AND timer reset.
    return internalSetBlock(col, row, blockType, true); // Set isPlayerPlaced = true
}

// Applies damage to a block at the given coordinates. If block HP drops to 0, it's replaced with air and drops an item.
export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage dealt

    const block = WorldData.getBlock(col, row);
    // Check if block is valid, breakable, and not already air/water/out of bounds
    // Also check if it's an object to avoid errors accessing block.hp
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.hp === Infinity) {
        return false;
    }

    // Apply damage
    block.hp -= damageAmount;

    // --- ADDED: Update the visual state of the block on the static canvas ---
    // This redraws the block with the potentially new damage indicator.
    // Pass the block's current type (it's not becoming air yet)
    updateStaticWorldAt(col, row); // MODIFIED: No longer need to pass block.type

    let wasDestroyed = false;
    // Check for destruction
    if (block.hp <= 0) {
        wasDestroyed = true;
        // Ensure health doesn't go below zero in data
        block.hp = 0;
        // Determine Drop Type
        let dropType = null;
        switch (block.type) { // Use the current type from the object
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
             case Config.BLOCK_BONE: dropType = 'bone'; break;
             case Config.BLOCK_METAL: dropType = 'metal'; break;
             // Add cases for other block types that drop items
        }
        // --- Spawn Item Drop (if any) ---
        if (dropType) {
            // position slightly off-center and random within the block bounds
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            // Ensure dropX and dropY are valid numbers before spawning
             if (!isNaN(dropX) && !isNaN(dropY) && typeof dropX === 'number' && typeof dropY === 'number') {
                 ItemManager.spawnItem(dropX + offsetX, dropY + offsetY, dropType);
                 // console.log(` > Spawning ${dropType} at ~${(dropX + offsetX).toFixed(1)}, ${(dropY + offsetY).toFixed(1)}`); // Keep logs quieter
             } else {
                 console.error(`>>> ITEM SPAWN FAILED: Invalid drop coordinates [${dropX}, ${dropY}] for ${dropType} from destroyed block at [${col}, ${row}].`);
             }
        }
        // --- Replace Block with Air ---
        // Use internalSetBlock to change the block data AND update the visual cache.
        // Destroyed blocks are naturally occurring, so isPlayerPlaced is false.
        // internalSetBlock will call updateStaticWorldAt with BLOCK_AIR.
        internalSetBlock(col, row, Config.BLOCK_AIR, false); // isPlayerPlaced = false

    } else {
         // Block damaged but not destroyed: updateStaticWorldAt was already called above
         // to redraw the block with the damage indicator. No further action needed here.
    }
    // Damage was applied, regardless of destruction
    return true;
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
         // Ensure timer doesn't go massively negative if frame rate is very low
         waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
         // console.log(`[WaterMgr.Update] dt: ${dt.toFixed(4)}, Timer: ${waterPropagationTimer.toFixed(4)}, Queue: ${waterUpdateQueue.size}`);
    // Only process water flow if the timer is ready and there are candidates
        if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
            waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

    // Get and process a limited number of candidates from the queue
    // Convert Map values to an array to slice
            const candidatesToProcess = Array.from(waterUpdateQueue.values()).slice(0, Config.WATER_UPDATES_PER_FRAME);
            // Sort candidates to process cells in lower rows (higher 'r' value) first.
            candidatesToProcess.sort((a, b) => b.r - a.r);
            // Remove processed candidates from the queue *before* processing the batch
            // This prevents infinite re-queuing within the same batch update.
            candidatesToProcess.forEach(({c, r}) => {
                const key = `${c},${r}`;
                waterUpdateQueue.delete(key);
            });
            // Process the batch of candidates
            candidatesToProcess.forEach(({c, r}) => {
                 // Re-check bounds, as things might have changed since it was queued (e.e. block placed/destroyed)
                if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;
                const currentBlockType = WorldData.getBlockType(c, r);
                // --- Water Propagation: Add Neighbors below waterline that are WATER or AIR to the queue ---
                // This ensures both AIR (can become water) and WATER (can spread water) are queued.
                // NOTE: The order of adding neighbors here (down, up, right, left) doesn't directly
                // control the *processing* order *within* the current batch, but it *does* affect
                // the order they *might* be added to the queue for *future* batches.
                // The sorting step above controls the *processing* order of the current batch.
                const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors
                neighbors.forEach(neighbor => {
                     const nc = c + neighbor.dc;
                     const nr = r + neighbor.dr;
                     // Queue neighbor if it's within bounds, AT or below waterline, and IS WATER or AIR.
                     // The addWaterUpdateCandidate function handles the specific type check (non-solid ground) and queue check.
                     // Also important: addWaterUpdateCandidate already checks if nr >= Config.WORLD_WATER_LEVEL_ROW_TARGET
                     addWaterUpdateCandidate(nc, nr); // Call addWaterUpdateCandidate for valid neighbors
                });
                // --- Water Filling: If the candidate is AIR, check if it should BECOME water ---
                // Only process filling if the current cell is still AIR.
                if (currentBlockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                    // Check current neighbors for water source *right now* in WorldData
                    let adjacentToWater = false;
                    // To prioritize downward filling, we could specifically check the neighbor ABOVE first
                    // and ONLY fill if there is water ABOVE it, OR if there is water adjacent AND the cell below is solid/water.
                    // For a simple bias, just checking *any* adjacent water is okay, but the sorting helps ensure
                    // that lower air blocks next to water are processed earlier in the *next* batch.
                    const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors again
                     for (const neighbor of immediateNeighbors) {
                        const nc = c + neighbor.dc;
                        const nr = r + neighbor.dr; // FIX: Should be neighbor.dr not neighbor.nr
                        // Check if neighbor is within bounds and is WATER
                        if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) { // Use WorldData's function directly
                            adjacentToWater = true;
                            // --> DEBUG LOG: Adjacent to Water Found <--
                            // console.log(`[WaterProc] [${c}, ${r}] (AIR) adjacent to WATER at [${nc}, ${nr}]`);
                            break; // Found water neighbor
                        }
                    }
                    if (adjacentToWater) {
                        // console.log(`[WaterFill] Filling [${c}, ${r}]`);
                        // Set to WATER. internalSetBlock updates WorldData and static canvas, AND re-queues neighbors and resets timer.
                        // internalSetBlock will call updateStaticWorldAt.
                        internalSetBlock(c, r, Config.BLOCK_WATER, false); // Water is not player-placed
                    }
                }
                // --- Logic for WATER to propagate (from water blocks) ---
                // If the candidate *was* water (and hasn't become air this batch)
                 if (currentBlockType === Config.BLOCK_WATER) {
                    // If there is AIR directly below this water block, queue that AIR block.
                    // Processing water from bottom-up due to sorting helps ensure this check
                    // queues air below which will then be processed sooner in the *next* batch.
                    const blockBelowType = WorldData.getBlockType(c, r + 1);
                    if (blockBelowType === Config.BLOCK_AIR) {
                         addWaterUpdateCandidate(c, r + 1); // Queue the air block below!
                         // console.log(`[WaterQueueBelow] Queueing [${c}, ${r+1}] from [${c}, ${r}]`);
                    }
                    // Check for sideways flow over solid ground: if block below is solid OR water AND side block is air
                    // First, check the block directly below this water cell.
                    const blockBelow = WorldData.getBlock(c, r + 1);
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Use resolved type, handle null/0

                    // Is the block below something that would act as a "floor" for sideways flow?
                    // This means it's NOT air AND it exists (not null).
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                    if (isBelowSolidOrWater) {
                        // If there's solid ground or water directly below, water can try to flow sideways.
                        // Check left
                        if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) {
                            addWaterUpdateCandidate(c - 1, r); // Queue the air block to the left
                             // --> DEBUG LOG: Queueing Sideways Left <--
                             // console.log(`[WaterQueueSide] Queueing [${c-1}, ${r}] from [${c}, ${r}]`);
                        }
                        // Check right
                        if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) {
                            addWaterUpdateCandidate(c + 1, r); // Queue the air block to the right
                             // --> DEBUG LOG: Queueing Sideways Right <--
                             // console.log(`[WaterQueueSide] Queueing [${c+1}, ${r}] from [${c}, ${r}]`);
                        }
                    }
                }
                // Solid candidates and water candidates (after adding neighbors) are just finished.
                // They served their purpose by potentially adding neighbors to the queue for the NEXT step.
            });
        } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
           // console.log("[WaterMgr] Water update timer ready, but queue is empty.");
        } else if (waterPropagationTimer > 0) {
           // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`);
        }
    }