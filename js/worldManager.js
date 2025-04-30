// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js'; // Need to draw static world on canvas
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js'; // Import GridCollision for isSolid check

// -----------------------------------------------------------------------------
// --- Water Simulation ---
// -----------------------------------------------------------------------------

// --- Use a Map to store coordinates that need checking, preventing duplicates ---
let waterUpdateQueue = new Map(); // Map: "col,row" -> {c, r}
let waterPropagationTimer = 0;     // Timer to control spread speed

// --- Add coordinates to the water update queue ---
// Only adds cells that are within bounds, at or below the water line threshold,
// not already in the queue, AND are not solid ground types.
function addWaterUpdateCandidate(col, row) {
     // Check if within bounds and at or below the water line threshold
     if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
         const key = `${col},${row}`;
         // Check if the cell is already in the queue to avoid duplicates
         if (!waterUpdateQueue.has(key)) {
             // Get the block type to check if it's solid ground
             const blockType = WorldData.getBlockType(col, row);

             // Add to queue only if it's NOT one of the solid ground types AND is not null (out of bounds)
             // Null check is technically redundant with the outer bounds check but harmless.
             // Explicitly include BLOCK_AIR, BLOCK_WATER, BLOCK_SAND, BLOCK_BONE as non-solid ground candidates.
             if (blockType !== null &&
                 blockType !== Config.BLOCK_STONE &&
                 blockType !== Config.BLOCK_DIRT &&
                 blockType !== Config.BLOCK_GRASS &&
                 blockType !== Config.BLOCK_METAL // Added METAL as solid ground too
                )
             {
                 waterUpdateQueue.set(key, {c: col, r: row});
                 // --> DEBUG LOG: Candidate Added <--
                 console.log(`[WaterQ] Added candidate [${col}, ${row}] type: ${blockType}. Current queue size: ${waterUpdateQueue.size}`);
             } else {
                 // --> OPTIONAL DEBUG LOG: Why candidate NOT added <--
                 // if (waterUpdateQueue.has(key)) console.log(`[WaterQ] Did NOT add [${col}, ${row}]: Already in queue.`);
                 // else if (blockType === null) console.log(`[WaterQ] Did NOT add [${col}, ${row}]: Out of bounds/null type.`);
                 // else console.log(`[WaterQ] Did NOT add [${col}, ${row}]: Is solid ground (${blockType}).`);
             }
         }
     }
}

// --- Internal function to set a block in grid data AND update the static visual cache ---
// This function is used internally by WorldManager whenever block type changes.
function internalSetBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL, isPlayerPlaced = false) {
    // --> DEBUG LOG: internalSetBlock Call <--
    console.log(`[WaterMgr] internalSetBlock called for [${col}, ${row}] to type ${blockType}, player placed: ${isPlayerPlaced}.`);

    // Use setBlock from WorldData to update the underlying data structure
    const success = WorldData.setBlock(col, row, blockType, orientation, isPlayerPlaced);

    if (success) {
        // Always update the static visual cache on block data change
        updateStaticWorldAt(col, row);
        // --> DEBUG LOG: Block Set Success <--
        console.log(`[WaterMgr] Block [${col}, ${row}] set successfully. Static canvas updated.`);
    } else {
        // --> DEBUG LOG: Block Set Failure <--
        console.warn(`[WaterMgr] Failed to set block data at [${col}, ${row}].`);
    }
    return success;
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
            // Directly check for BLOCK_AIR (number 0) or null/undefined
            if (!block || typeof block === 'number' && block === Config.BLOCK_AIR) continue;

            const blockType = block.type; // Access type property
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue;
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            // const orientation = block.orientation; // Unused for now
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
                     Math.ceil(Config.BLOCK_WIDTH) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS * 2, // Subtract stroke width from both sides
                     Math.ceil(Config.BLOCK_HEIGHT) - Config.PLAYER_BLOCK_OUTLINE_THICKNESS * 2
                 );
                 gridCtx.restore(); // restore context state
            }
        }
    }
// Optional: Draw grid lines over the world
// GridRenderer.drawStaticGrid(); // Ensure this is imported if used
}

// --- Helper function to update a single block on the off-screen canvas ---
// Clears the block's area and redraws it if it's not air.
function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    const block = WorldData.getBlock(col, row); // Get the block data (0 for air, object for others, null for out of bounds)
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    // 1. Clear the area corresponding to this grid cell on the static canvas
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    // 2. If the block is NOT air and NOT null (out of bounds), redraw it
    // WorldData.getBlock returns 0 for AIR and null for out of bounds. Any other value is an object.
    if (block !== Config.BLOCK_AIR && block !== null) {
        const blockType = typeof block === 'object' ? block.type : block; // Get type from object or directly if it's a number like WATER constant
        const blockColor = Config.BLOCK_COLORS[blockType];

        if (blockColor) {
            // Draw block body
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // --- Draw Outline if Player Placed ---
            // Check isPlayerPlaced property on the block object if it's an object
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                 gridCtx.save(); // Save context state
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                  gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS * 2, // Subtract stroke width from both sides
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS * 2
                 );
                 gridCtx.restore(); // Restore context state
            }
        } else {
             console.warn(`WorldManager: No color defined for block type ${blockType} at [${col}, ${row}] during updateStaticWorldAt.`);
        }
    }
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
    console.timeEnd("WorldManager initialized");
}

// --- Seed water update queue with initial water blocks and adjacent air candidates below the waterline ---
function seedWaterUpdateQueue() {
    waterUpdateQueue.clear(); // start fresh
     console.log("[WaterMgr] Seeding initial water update queue...");
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Add any block AT or below the waterline threshold.
            // The addWaterUpdateCandidate function handles the bounds, queue.has check,
            // and whether the block type is valid for being in the queue (i.e., not solid ground).
            addWaterUpdateCandidate(c, r);
        }
    }
    // --> DEBUG LOG: Final Queue Size After Seeding <--
     console.log(`[WaterMgr] Initial water update queue size after seeding: ${waterUpdateQueue.size}`);
}


// Sets a player-placed block - assumes validity checks (range, clear, neighbor) are done by the caller (Player class).
export function placePlayerBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    // Use the internalSetBlock function, marking it as player placed
    const success = internalSetBlock(col, row, blockType, orientation, true); // Set isPlayerPlaced = true

    // If a block was successfully placed AND it's at or below the water level,
    // add this cell and neighbors to the water update queue.
     if (success && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
         // addWaterUpdateCandidate handles checking if the newly placed block type is valid to be in the queue (e.g., placing AIR to drain)
         addWaterUpdateCandidate(col, row); // Add the placed block's cell itself

         // Add neighbors - necessary to propagate water away from the new block or into new AIR space
         const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
         neighbors.forEach(neighbor => addWaterUpdateCandidate(col + neighbor.dc, row + neighbor.dr));
     }

    return success;
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

    const rowBeforeDamage = row; // Store row before potential destruction
    const colBeforeDamage = col; // Store col before potential destruction
    const blockTypeBeforeDamage = block.type; // Store type before potential destruction

    // Apply damage
    block.hp -= damageAmount;

    let wasDestroyed = false;
    // Check for destruction
    if (block.hp <= 0) {
        wasDestroyed = true;
// Determine Drop Type
        let dropType = null;
        switch (blockTypeBeforeDamage) { // Use the type BEFORE it was set to air
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
// TODO: more cases for breakable blocks that drop items here
             case Config.BLOCK_BONE: dropType = 'bone'; break; // Example: Bone blocks drop bone
             case Config.BLOCK_METAL: dropType = 'metal'; break; // Example: Metal blocks drop metal
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
        // Use internalSetBlock to change the block data AND update the visual cache.
        // Destroyed blocks are naturally occurring, so isPlayerPlaced is false.
        internalSetBlock(col, row, Config.BLOCK_AIR, Config.ORIENTATION_FULL, false);
    } else {
        // Block damaged but not destroyed: No need to update static visual cache for HP change.
    }

     // If the block was destroyed OR damaged, and it's at or below the water level,
     // add this cell and neighbors to the water update queue.
     // This ensures water flow responds to both breaking and placing blocks.
     if (rowBeforeDamage >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
         // The damaged/destroyed cell is now AIR. addWaterUpdateCandidate will queue it.
         addWaterUpdateCandidate(colBeforeDamage, rowBeforeDamage);
         // Add neighbors - necessary to propagate water into the new air pocket or away from damaged block
         const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
         neighbors.forEach(neighbor => addWaterUpdateCandidate(colBeforeDamage + neighbor.dc, rowBeforeDamage + neighbor.dr));
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
     // Ensure timer doesn't go massively negative if frame rate is very low
     waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);

// Only process water flow if the timer is ready and there are candidates
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

// Get and process a limited number of candidates from the queue
// Convert Map values to an array to slice
        const candidatesToProcess = Array.from(waterUpdateQueue.values()).slice(0, Config.WATER_UPDATES_PER_FRAME);

        // Remove processed candidates from the queue *before* processing the batch
        // This prevents infinite re-queuing within the same batch update.
        candidatesToProcess.forEach(({c, r}) => {
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key);
        });

        // --> DEBUG LOG: Processing Batch <--
        console.log(`[WaterMgr] Processing batch (${candidatesToProcess.length} candidates). Queue size before processing: ${waterUpdateQueue.size + candidatesToProcess.length}. Queue size after removal: ${waterUpdateQueue.size}`);

        // Process the batch of candidates
        candidatesToProcess.forEach(({c, r}) => {
             // Re-check bounds, as things might have changed since it was queued (e.g. block placed/destroyed)
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;

            const currentBlockType = WorldData.getBlockType(c, r);

            // --> DEBUG LOG: Candidate Type <--
            console.log(`[WaterMgr] Candidate [${c}, ${r}] type: ${currentBlockType}.`);


            // --- Water Propagation: Add Neighbors below waterline that are not solid ground to the queue ---
            // This ensures both AIR (can become water) and WATER (can spread water) are queued.
            const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors
            neighbors.forEach(neighbor => {
                 const nc = c + neighbor.dc;
                 const nr = r + neighbor.dr; // <-- Corrected this from neighbor.nr

                 // Queue neighbor if it's within bounds, AT or below waterline, and IS NOT SOLID GROUND.
                 // The addWaterUpdateCandidate function handles the specific type check (non-solid ground) and queue check.
                 if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && nr >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                       addWaterUpdateCandidate(nc, nr); // Call addWaterUpdateCandidate for valid neighbors
                 }
            });


            // --- Water Filling: If the candidate is AIR, check if it should BECOME water ---
            // Only process filling if the current cell is still AIR.
            if (currentBlockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                // Check current neighbors for water source *right now* in WorldData
                let adjacentToWater = false;
                const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // Cardinal neighbors again
                 for (const neighbor of immediateNeighbors) {
                    const nc = c + neighbor.dc;
                    const nr = r + neighbor.dr; // <-- Corrected this from neighbor.nr
                    // Check if neighbor is within bounds and is WATER
                    if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) { // Use WorldData's function directly
                        adjacentToWater = true;
                        break; // Found water neighbor
                    }
                }
                // If adjacent to water, fill this air block with water
                // --> DEBUG LOG: Adjacent to Water Check <--
                console.log(`[WaterMgr] [${c}, ${r}] (AIR). Adjacent to water? ${adjacentToWater}`);

                if (adjacentToWater) {
                    // --> DEBUG LOG: Filling with Water <--
                    console.log(`[WaterMgr] Filling [${c}, ${r}] with water.`);
   // Set to WATER. internalSetBlock updates WorldData and static canvas.
                    internalSetBlock(c, r, Config.BLOCK_WATER, Config.ORIENTATION_FULL, false); // Water is not player-placed
                }
            }
            // Solid candidates and water candidates (after adding neighbors) are just finished.
            // They served their purpose by potentially adding neighbors to the queue for the NEXT step.
        });
    } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
       // --> OPTIONAL DEBUG LOG: Queue Empty <--
       // console.log("[WaterMgr] Water update timer ready, but queue is empty.");
    } else if (waterPropagationTimer > 0) {
       // --> OPTIONAL DEBUG LOG: Timer Waiting <--
       // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`);
    }
}