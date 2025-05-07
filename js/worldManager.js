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
// AgingManager itself doesn't need to be called from here anymore

// --- Module State ---
let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed

// NEW: Aging Animation State
let agingAnimationQueue = []; // Stores { c, r, oldBlockType, newBlockType } for pending animations
let activeAgingAnimations = []; // Stores { c, r, oldBlockType, newBlockType, timer, phase, currentScale }
let newAnimationStartTimer = 0; // Timer to delay starting new animations from the queue

export function init(portalRef) {
    console.log("Initializing WorldManager...");
    WorldData.initializeGrid(); // Ensure grid is initialized first
    generateInitialWorld(); // world generator now handles landmass + flood fill

    // AgingManager.init() is called in main.js

    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before WorldManager.init().");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("FATAL: Renderer.createGridCanvas() failed during WorldManager.init fallback.");
        }
        console.warn("Renderer.createGridCanvas() was called as a fallback during WorldManager.init.");
    }

    // Initial rendering and seeding handled by main.js or WaveManager now.
    // NEW: Reset animation queues on init
    agingAnimationQueue = [];
    activeAgingAnimations = [];
    newAnimationStartTimer = 0;


    console.log("WorldManager initialized.");
}

// Helper function to add cell to water update queue
export function addWaterUpdateCandidate(col, row) {
    // Check if within bounds
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const key = `${col},${row}`;
        // Check if the cell is already in the queue to avoid duplicates
        if (!waterUpdateQueue.has(key)) {
            const blockType = WorldData.getBlockType(col, row);
            // Only add AIR blocks if AT/BELOW waterline, or any WATER block.
            if (blockType !== null &&
                (blockType === Config.BLOCK_WATER ||
                 (blockType === Config.BLOCK_AIR && row >= Config.WORLD_WATER_LEVEL_ROW_TARGET))) {
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
// This is called AFTER a block change is finalized (mining, placement, aging animation end)
export function queueWaterCandidatesAroundChange(c, r) {
     let candidateAdded = false;
     candidateAdded = addWaterUpdateCandidate(c, r) || candidateAdded; // Add the changed block itself if it's now AIR/WATER (and meets criteria)
     candidateAdded = addWaterUpdateCandidate(c, r - 1) || candidateAdded; // Add neighbors
     candidateAdded = addWaterUpdateCandidate(c, r + 1) || candidateAdded;
     candidateAdded = addWaterUpdateCandidate(c - 1, r) || candidateAdded;
     candidateAdded = addWaterUpdateCandidate(c + 1, r) || candidateAdded;

     // If any candidate was added to the queue, reset the timer to force an immediate water update pass
     if (candidateAdded) {
         resetWaterPropagationTimer();
     }
}


// update visual representation of a single block ON THE STATIC CANVAS
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

            // draw damage indicators if block is an object with HP and is damaged
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                const hpRatio = block.hp / block.maxHp;
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // only draw indicators if damage is significant enough based on thresholds
                    gridCtx.save(); // save context state before drawing lines
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square'; // use square cap
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points

                    gridCtx.beginPath(); // draw slash (\)
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset); // draw to inset bottom-right
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
        } else {
             // console.warn(`No color defined for block type ${currentBlockType} at [${col}, ${row}]`); // Too noisy
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
            updateStaticWorldAt(c, r); // Reuse the single block update logic
        }
    }
}

export function seedWaterUpdateQueue() { // seed queue with initial water blocks and adjacent air candidates below waterline
    console.log("WorldManager: Seeding water update queue...");
    waterUpdateQueue.clear(); // start fresh
    for (let r = 0; r < Config.GRID_ROWS; r++) { // Check all rows initially
        for (let c = 0; c < Config.GRID_COLS; c++) {
             const blockType = WorldData.getBlockType(c, r);
             // Add any existing WATER block or AIR block at/below the waterline
             // addWaterUpdateCandidate now handles the row check for AIR
             if (blockType === Config.BLOCK_WATER || blockType === Config.BLOCK_AIR) {
                 addWaterUpdateCandidate(c, r);
             }
             // Also add neighbors of existing water or solids near the waterline
             // queueWaterCandidatesAroundChange will use the new addWaterUpdateCandidate logic
             if (blockType === Config.BLOCK_WATER || (GridCollision.isSolid(c, r) && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 2)) {
                 queueWaterCandidatesAroundChange(c, r);
             }
        }
    }

    console.log(`WorldManager: Seeded Water Update Queue with ${waterUpdateQueue.size} candidates.`);
    waterPropagationTimer = 0; // reset timer so water simulation starts immediately after seeding
}

// sets player-placed block - assumes validity checks are done by Player
export function placePlayerBlock(col, row, blockType) {
    const success = WorldData.setBlock(col, row, blockType, true);
    if (success) {
        updateStaticWorldAt(col, row); // update static visual cache
        // Trigger water sim if block placement is at or near waterline
        // Use the helper function to queue neighbors
        queueWaterCandidatesAroundChange(col, row);
    } else {
        console.error(`WorldManager placePlayerBlock failed to set block at [${col}, ${row}]`);
    }
    return success;
}

// applies damage to block, handles destruction and drops
export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false;
    const block = WorldData.getBlock(col, row);
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false; // Not a damageable block
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
         console.error(`Invalid HP type for block at [${col}, ${row}]. HP: ${block.hp}. Resetting HP.`);
         block.hp = block.maxHp;
         return false;
    }

    block.hp -= damageAmount;
    updateStaticWorldAt(col, row); // Redraw with damage indicator

    let wasDestroyed = false;
    if (block.hp <= 0) {
        wasDestroyed = true;
        block.hp = 0;
        let dropType = null;
        // Determine drop type
        switch (block.type) {
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
        }

        if (dropType) { // Spawn drop
            const dropXBase = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropYBase = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4;
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
            const finalDropX = dropXBase + offsetX;
            const finalDropY = dropYBase + offsetY;
            if (!isNaN(finalDropX) && !isNaN(finalDropY)) {
                ItemManager.spawnItem(finalDropX, finalDropY, dropType);
            } else {
                console.error(`ITEM SPAWN FAILED: Invalid drop coordinates [${finalDropX}, ${finalDropY}] for ${dropType}`);
            }
        }

        // Replace the block with AIR
        const success = WorldData.setBlock(col, row, Config.BLOCK_AIR, false); // Destroyed blocks are no longer player-placed

        if (success) {
            updateStaticWorldAt(col, row); // Update static visual cache (clears the block)
            // Trigger water simulation check around the destroyed block
            queueWaterCandidatesAroundChange(col, row);
        } else {
             console.error(`WorldManager damageBlock failed to set AIR at [${col}, ${row}] after destruction.`);
        }
    }
    return true; // Damage was applied
}

// draw pre-rendered static world AND active aging animations onto main canvas
export function draw(ctx) {
    if (!ctx) { console.error("WorldManager.draw: No drawing context provided!"); return; }
    const gridCanvas = Renderer.getGridCanvas();
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0); // Draw the static background first
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }

    // NEW: Draw active aging animations ON TOP of the static world
    if (Config.AGING_ANIMATION_ENABLED) {
        drawAgingAnimations(ctx);
    }
}

// handles dynamic world state like water flow AND aging animations
export function update(dt) {
    // Water propagation timer and logic
    waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY;
        const candidatesArray = Array.from(waterUpdateQueue.values());
        candidatesArray.sort((a, b) => b.r - a.r); // Process lower blocks first
        const candidatesToProcess = candidatesArray.slice(0, Config.WATER_UPDATES_PER_FRAME);

        candidatesToProcess.forEach(({c, r}) => {
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key); // Remove before processing
        });

        candidatesToProcess.forEach(({c, r}) => {
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;
            const currentBlockType = WorldData.getBlockType(c, r);

            if (currentBlockType === Config.BLOCK_AIR) {
                // Only turn AIR to WATER if this AIR block is AT or BELOW the target water line
                if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                    let adjacentToWater = false;
                    const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}];
                    for (const neighbor of immediateNeighbors) {
                        const nc = c + neighbor.dc;
                        const nr = r + neighbor.dr;
                        if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) {
                            adjacentToWater = true;
                            break;
                        }
                    }
                    if (adjacentToWater) {
                        const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false);
                        if (success) {
                            updateStaticWorldAt(c, r);
                            queueWaterCandidatesAroundChange(c, r);
                        } else {
                            console.warn(`Water flow failed to set block to WATER at [${c},${r}]`);
                        }
                    }
                }
            } else if (currentBlockType === Config.BLOCK_WATER) {
                // Water flowing downwards
                const blockBelowType = WorldData.getBlockType(c, r + 1);
                if (blockBelowType === Config.BLOCK_AIR) {
                    // The AIR block below (c, r+1) will be added to queue if it's at/below water line by addWaterUpdateCandidate
                    addWaterUpdateCandidate(c, r + 1);
                } else {
                    // Solid or water below, try to spread sideways
                    const blockBelow = WorldData.getBlock(c, r + 1);
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR;
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                    if (isBelowSolidOrWater) {
                         let spreadOccurred = false;
                         // Check left: if AIR and THIS water block's row (r) is at/below water level
                         if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                             addWaterUpdateCandidate(c - 1, r);
                             spreadOccurred = true;
                         }
                         // Check right: if AIR and THIS water block's row (r) is at/below water level
                         if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                             addWaterUpdateCandidate(c + 1, r);
                             spreadOccurred = true;
                         }
                         // Re-queue self ONLY if spread occurred to check further spread next cycle
                         if (spreadOccurred) {
                              addWaterUpdateCandidate(c, r);
                         }
                    }
                }
            }
        });
    }

    // NEW: Update aging animations if enabled
    if (Config.AGING_ANIMATION_ENABLED) {
        updateAgingAnimations(dt);
    }
}

// --- NEW Aging Animation Functions ---

/**
 * Adds proposed block changes from AgingManager to the aging animation queue.
 * If animations are disabled, applies changes directly to the static canvas.
 * @param {Array<{c: number, r: number, oldBlockType: number, newBlockType: number}>} changes
 */
export function addProposedAgingChanges(changes) {
    if (!Config.AGING_ANIMATION_ENABLED) {
        // console.log("[WorldManager] Aging animation disabled. Applying changes directly."); // Less verbose
        changes.forEach(({ c, r }) => { // oldBlockType, newBlockType from diff are not needed here for direct application
            // WorldData is already updated by AgingManager by the time diffGrids runs.
            // So, we just need to update the static canvas for the final state.
            updateStaticWorldAt(c, r);
            queueWaterCandidatesAroundChange(c, r);
        });
        return;
    }

    // Add changes to the queue for animation processing
    changes.forEach(change => agingAnimationQueue.push(change));
    // console.log(`[WorldManager] Added ${changes.length} proposed aging changes to animation queue. Total: ${agingAnimationQueue.length}`); // Less verbose
}

/**
 * Updates the state of currently active aging animations and starts new ones from the queue.
 * @param {number} dt Delta time in seconds.
 */
function updateAgingAnimations(dt) {
    if (dt <= 0) return; // Don't process if no time has passed

    newAnimationStartTimer -= dt;

    // Start new animations if conditions are met
    if (newAnimationStartTimer <= 0 && agingAnimationQueue.length > 0 && activeAgingAnimations.length < Config.AGING_ANIMATION_BLOCKS_AT_ONCE) {
        const change = agingAnimationQueue.shift();

        // Find if there's already an active animation for this cell (shouldn't happen with queue logic, but safety)
        const existingAnimIndex = activeAgingAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);
        if (existingAnimIndex !== -1) {
             // console.warn(`[WorldManager] Trying to start new animation for [${change.c},${change.r}] while one is active. Skipping.`); // Less verbose
        } else {
            activeAgingAnimations.push({
                c: change.c,
                r: change.r,
                oldBlockType: change.oldBlockType,
                newBlockType: change.newBlockType,
                timer: Config.AGING_ANIMATION_SWELL_DURATION,
                phase: 'swell', // 'swell', 'pop'
                currentScale: 1.0,
            });
            newAnimationStartTimer = Config.AGING_ANIMATION_NEW_BLOCK_DELAY;

            // Temporarily clear the spot on the static grid canvas
            // This allows the animation to draw into an empty space without the old block being visible underneath.
            const gridCtx = Renderer.getGridContext();
            if (gridCtx) {
                gridCtx.clearRect(
                    Math.floor(change.c * Config.BLOCK_WIDTH),
                    Math.floor(change.r * Config.BLOCK_HEIGHT),
                    Math.ceil(Config.BLOCK_WIDTH),
                    Math.ceil(Config.BLOCK_HEIGHT)
                );
            }
        }
    }

    // Update active animations
    for (let i = activeAgingAnimations.length - 1; i >= 0; i--) {
        const anim = activeAgingAnimations[i];
        anim.timer -= dt;

        if (anim.phase === 'swell') {
            const timeElapsed = Config.AGING_ANIMATION_SWELL_DURATION - anim.timer;
            const progress = Math.min(1.0, Math.max(0, timeElapsed / Config.AGING_ANIMATION_SWELL_DURATION)); // Ensure progress is 0-1
            // Use a sine ease-out curve for smoother scaling
            anim.currentScale = 1.0 + (Config.AGING_ANIMATION_SWELL_SCALE - 1.0) * Math.sin(progress * Math.PI / 2);

            if (anim.timer <= 0) {
                anim.phase = 'pop';
                anim.timer = Config.AGING_ANIMATION_POP_DURATION; // Reset timer for pop phase
                 // Reset scale for pop phase if needed, or let draw handle it
                 anim.currentScale = 1.0; // Reset scale after swell finishes
            }
        } else if (anim.phase === 'pop') {
            // Pop phase timer counts down. Visuals handled in drawAgingAnimations.
            if (anim.timer <= 0) {
                // Animation finished: Update static canvas and queue water candidates
                updateStaticWorldAt(anim.c, anim.r); // Draws the final newBlockType
                queueWaterCandidatesAroundChange(anim.c, anim.r);
                activeAgingAnimations.splice(i, 1); // Remove from active list
            }
        }
    }
}

/**
 * Draws the currently active aging animations onto the provided context.
 * Assumes context transformations (camera) have already been applied.
 * @param {CanvasRenderingContext2D} ctx The main canvas context.
 */
function drawAgingAnimations(ctx) {
    activeAgingAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        const blockPixelY = anim.r * Config.BLOCK_HEIGHT;
        const blockWidth = Config.BLOCK_WIDTH;
        const blockHeight = Config.BLOCK_HEIGHT;

        ctx.save();

        if (anim.phase === 'swell') {
            // Translate to center, scale, translate back
            ctx.translate(blockPixelX + blockWidth / 2, blockPixelY + blockHeight / 2);
            ctx.scale(anim.currentScale, anim.currentScale);
            ctx.translate(-(blockPixelX + blockWidth / 2), -(blockPixelY + blockHeight / 2));

            // Draw the OLD block type swelling
            const oldColor = Config.BLOCK_COLORS[anim.oldBlockType];
            if (oldColor && anim.oldBlockType !== Config.BLOCK_AIR) { // Don't draw AIR
                ctx.fillStyle = Config.AGING_ANIMATION_OLD_BLOCK_COLOR; // Use specific animation color
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        } else if (anim.phase === 'pop') {
            // Draw the NEW block type flashing in
            const newColor = Config.BLOCK_COLORS[anim.newBlockType];
            if (newColor && anim.newBlockType !== Config.BLOCK_AIR) { // Don't draw AIR
                 // Optional: Fade in/out during pop phase based on timer progress
                 const popProgress = Math.max(0, 1.0 - (anim.timer / Config.AGING_ANIMATION_POP_DURATION)); // 0 to 1
                 // Example: Flash bright then fade slightly
                 const alpha = 0.6 + 0.4 * Math.sin(popProgress * Math.PI); // Pulses alpha
                 ctx.globalAlpha = alpha;
                 ctx.fillStyle = Config.AGING_ANIMATION_NEW_BLOCK_COLOR; // Use specific animation color
                 ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
                 ctx.globalAlpha = 1.0; // Reset alpha
            }
        }
        ctx.restore();
    });
}

/**
 * Checks if all aging animations (queued and active) are complete.
 * Used by WaveManager to know when the visual warp is finished.
 * @returns {boolean} True if no animations are pending or active.
 */
export function areAgingAnimationsComplete() {
    return agingAnimationQueue.length === 0 && activeAgingAnimations.length === 0;
}

/**
 * Finishes all pending and active aging animations immediately.
 * Called when the WARPPHASE timer ends or if animations need to be skipped.
 */
export function finalizeAllAgingAnimations() {
    if (!Config.AGING_ANIMATION_ENABLED) return; // Do nothing if disabled

    // console.log(`[WorldManager] Finalizing ${agingAnimationQueue.length} queued and ${activeAgingAnimations.length} active aging animations...`); // Less verbose
    // Process remaining queued items
    while(agingAnimationQueue.length > 0) {
        const change = agingAnimationQueue.shift();
        // Directly apply the change: update static canvas, queue water sim
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    // Process currently active animations
    while(activeAgingAnimations.length > 0) {
        const anim = activeAgingAnimations.shift(); // Remove from front
        // Directly apply the final state: update static canvas, queue water sim
        updateStaticWorldAt(anim.c, anim.r);
        queueWaterCandidatesAroundChange(anim.c, anim.r);
    }
    // console.log("[WorldManager] All aging animations finalized."); // Less verbose
}