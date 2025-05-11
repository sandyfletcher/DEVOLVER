// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as World from './utils/world.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';
import { createBlock } from './utils/block.js';

// --- Module State ---
let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed

// Aging Animation State
let agingAnimationQueue = []; // Stores { c, r, oldBlockType, newBlockType } for pending animations
let activeAgingAnimations = []; // Stores { c, r, oldBlockType, newBlockType, timer, phase, currentScale }
let newAnimationStartTimer = 0; // Timer to delay starting new animations from the queue

// Gravity Animation State
let gravityAnimationQueue = []; // Stores { c, r_start, r_end, blockData }
let activeGravityAnimations = []; // Stores { c, r_current_pixel_y, r_end_pixel_y, blockData, fallSpeed }
let newGravityAnimationStartTimer = 0; // Timer for staggering gravity animations

const MAX_FALLING_BLOCKS_AT_ONCE = 20; // Configurable: how many blocks fall visually at once
const GRAVITY_ANIMATION_FALL_SPEED = 200; // Configurable: pixels per second for visual fall
const NEW_GRAVITY_ANIM_DELAY = 0.02; // Configurable: delay between starting falling block visuals

// This function will take the output of `diffGrids` and try to identify falling blocks.
function parseGravityDiffsIntoFallingBlocks(diffs) {
    const fallingBlocks = [];
    const disappeared = new Map(); // c -> Map(r_old -> blockType)
    const appeared = new Map();    // c -> Map(r_new -> blockType_or_blockData)

    diffs.forEach(diff => {
        // If a solid block became AIR, it "disappeared" from its old spot.
        if (diff.oldBlockType !== Config.BLOCK_AIR && diff.oldBlockType !== Config.BLOCK_WATER && diff.newBlockType === Config.BLOCK_AIR) {
            if (!disappeared.has(diff.c)) disappeared.set(diff.c, new Map());
            // We need the actual block data that disappeared, not just its type.
            // This is a challenge if diffGrids only gives types.
            // Let's assume `applyGravitySettlement` has updated `World.grid`.
            // `diff.oldBlockType` is what *was* there.
            // We need to know *what block object* moved.
            //
            // **Simplification for now:** Assume `diffGrids` can be enhanced or we can reconstruct.
            // For now, let's just store the type. We'll need to refine how `blockData` is passed.
            // IDEALLY: `applyGravitySettlement` itself would return `[{ c, r_old, r_new, blockData }]`.
            //
            // If `applyGravitySettlement` returns the list of *chunks* that fell:
            // `chunksFallen = [{ blocks: [{c, r_original, blockData}, ...], fallDistance: d }, ...]`
            // Then `addProposedGravityChanges` would iterate `chunksFallen` and directly queue:
            // `{ c: block.c, r_start: block.r_original, r_end: block.r_original + chunk.fallDistance, blockData: block.blockData }`
            // This bypasses needing `parseGravityDiffsIntoFallingBlocks`.
            // Let's assume `applyGravitySettlement` can be modified to return this.
            // For now, this function will be a placeholder if `diffGrids` is the input.
        }
        // If AIR became a solid block, it "appeared" in its new spot.
        else if (diff.oldBlockType === Config.BLOCK_AIR && diff.newBlockType !== Config.BLOCK_AIR && diff.newBlockType !== Config.BLOCK_WATER) {
            if (!appeared.has(diff.c)) appeared.set(diff.c, new Map());
            // The `World.grid` now contains the block object at `diff.c, diff.r`.
            appeared.get(diff.c).set(diff.r, World.getBlock(diff.c, diff.r));
        }
    });

    // Match disappeared with appeared for the same column
    appeared.forEach((rowMapNew, c) => {
        if (disappeared.has(c)) {
            const rowMapOld = disappeared.get(c);
            rowMapOld.forEach((_, rOld) => { // We stored oldType, but need to find corresponding new
                // Find the "lowest" appeared block in this column that is below rOld
                let bestMatchRNew = -1;
                let matchedBlockData = null;

                rowMapNew.forEach((blockDataNew, rNew) => {
                    if (rNew > rOld) { // Must have fallen downwards
                        if (bestMatchRNew === -1 || rNew < bestMatchRNew) { // Find closest new position
                            // This matching logic is tricky with just types.
                            // If `blockDataNew.type` matches what `oldType` was (from `rowMapOld.get(rOld)`),
                            // it's a potential match.
                            // For now, let's assume any solid appearance below a disappearance is a fall.
                            bestMatchRNew = rNew;
                            matchedBlockData = blockDataNew;
                        }
                    }
                });

                if (bestMatchRNew !== -1 && matchedBlockData) {
                    fallingBlocks.push({
                        c: c,
                        r_start: rOld,
                        r_end: bestMatchRNew,
                        blockData: matchedBlockData // The actual block object that landed
                    });
                    // Remove the matched appeared block so it's not processed again
                    rowMapNew.delete(bestMatchRNew);
                }
            });
        }
    });
    return fallingBlocks;
}

// --- NEW: Gravity Animation ---
export function addProposedGravityChanges(changes) {
    // 'changes' should be an array of { c, r_start, r_end, blockData }
    // where blockData is the actual block object that fell.
    changes.forEach(change => {
        // Ensure we don't queue if an animation for this start/end is already active/queued
        // This check might be complex if multiple things could happen to the same cell.
        // For now, assume distinct changes.
        gravityAnimationQueue.push(change);
    });
    // console.log(`[WorldManager] Added ${changes.length} proposed gravity changes to animation queue. Total: ${gravityAnimationQueue.length}`);
}

function updateGravityAnimations(dt) {
    if (dt <= 0) return;

    // Start new gravity animations
    newGravityAnimationStartTimer -= dt;
    if (newGravityAnimationStartTimer <= 0 && gravityAnimationQueue.length > 0 && activeGravityAnimations.length < MAX_FALLING_BLOCKS_AT_ONCE) {
        const change = gravityAnimationQueue.shift();

        // Clear the block from its original position on the static canvas
        // This makes it "disappear" from its old spot to prepare for the falling visual
        const gridCtx = Renderer.getGridContext();
        if (gridCtx) {
            gridCtx.clearRect(
                Math.floor(change.c * Config.BLOCK_WIDTH),
                Math.floor(change.r_start * Config.BLOCK_HEIGHT),
                Math.ceil(Config.BLOCK_WIDTH),
                Math.ceil(Config.BLOCK_HEIGHT)
            );
        }

        activeGravityAnimations.push({
            c: change.c,
            r_start_pixel_y: change.r_start * Config.BLOCK_HEIGHT, // Store pixel positions
            r_current_pixel_y: change.r_start * Config.BLOCK_HEIGHT,
            r_end_pixel_y: change.r_end * Config.BLOCK_HEIGHT,
            blockData: change.blockData, // The block object itself
            fallSpeed: GRAVITY_ANIMATION_FALL_SPEED, // pixels/sec
        });
        newGravityAnimationStartTimer = NEW_GRAVITY_ANIM_DELAY;
    }

    // Update active gravity animations
    for (let i = activeGravityAnimations.length - 1; i >= 0; i--) {
        const anim = activeGravityAnimations[i];
        anim.r_current_pixel_y += anim.fallSpeed * dt;

        if (anim.r_current_pixel_y >= anim.r_end_pixel_y) {
            // Animation finished, update the world grid's static visual at the new location
            // The logical World.grid was already updated by applyGravitySettlement.
            // We just need to ensure the static canvas reflects the block in its new spot.
            // Need to convert r_end_pixel_y back to a row index for updateStaticWorldAt
            const end_row = Math.round(anim.r_end_pixel_y / Config.BLOCK_HEIGHT); // Use round for precision
            updateStaticWorldAt(anim.c, end_row); // This will draw the blockData at its final spot
            
            queueWaterCandidatesAroundChange(anim.c, anim.r_start); // Check original spot for water
            queueWaterCandidatesAroundChange(anim.c, end_row);   // Check new spot for water

            activeGravityAnimations.splice(i, 1);
        }
    }
}

function drawGravityAnimations(ctx) {
    activeGravityAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        // Use anim.r_current_pixel_y for drawing
        const blockPixelY = anim.r_current_pixel_y;

        const blockColor = Config.BLOCK_COLORS[anim.blockData.type];
        if (blockColor) {
            ctx.fillStyle = blockColor;
            ctx.fillRect(
                Math.floor(blockPixelX),
                Math.floor(blockPixelY),
                Math.ceil(Config.BLOCK_WIDTH),
                Math.ceil(Config.BLOCK_HEIGHT)
            );
            // Optionally draw player-placed outline if anim.blockData.isPlayerPlaced
            if (anim.blockData.isPlayerPlaced) {
                ctx.save();
                ctx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                ctx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                ctx.strokeRect(
                    Math.floor(blockPixelX) + outlineInset,
                    Math.floor(blockPixelY) + outlineInset,
                    Config.BLOCK_WIDTH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                    Config.BLOCK_HEIGHT - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                );
                ctx.restore();
            }
        }
    });
}

export function areGravityAnimationsComplete() {
    return gravityAnimationQueue.length === 0 && activeGravityAnimations.length === 0;
}

export function finalizeAllGravityAnimations() {
    console.log(`[WorldManager] Finalizing ${gravityAnimationQueue.length} queued and ${activeGravityAnimations.length} active gravity animations...`);
    while (gravityAnimationQueue.length > 0) {
        const change = gravityAnimationQueue.shift();
        const end_row = Math.round(change.r_end_pixel_y / Config.BLOCK_HEIGHT); // r_end might not be pixel if queue stores rows
        updateStaticWorldAt(change.c, change.r_start); // Clear original spot
        updateStaticWorldAt(change.c, end_row);   // Draw in new spot
        queueWaterCandidatesAroundChange(change.c, change.r_start);
        queueWaterCandidatesAroundChange(change.c, end_row);
    }
    while (activeGravityAnimations.length > 0) {
        const anim = activeGravityAnimations.shift();
        const end_row = Math.round(anim.r_end_pixel_y / Config.BLOCK_HEIGHT);
        updateStaticWorldAt(anim.c, Math.round(anim.r_start_pixel_y / Config.BLOCK_HEIGHT)); // Clear original
        updateStaticWorldAt(anim.c, end_row); // Draw in new spot
        queueWaterCandidatesAroundChange(anim.c, Math.round(anim.r_start_pixel_y / Config.BLOCK_HEIGHT));
        queueWaterCandidatesAroundChange(anim.c, end_row);
    }
    gravityAnimationQueue = [];
    activeGravityAnimations = [];
    console.log("[WorldManager] All gravity animations finalized.");
}

// Helper for BFS/DFS to find connected solid blocks for gravity settlement
function getConnectedSolidChunk(startX, startY, visitedInPass, portalRef) {
    const chunk = [];
    const queue = [{ c: startX, r: startY }];
    const visitedInChunk = new Set(); // Tracks blocks visited for *this specific chunk*
    
    // Mark starting block as visited for this chunk and for the overall pass
    const startKey = `${startX},${startY}`;
    visitedInChunk.add(startKey);
    visitedInPass.add(startKey);

    const portalCenter = portalRef.getPosition();
    const portalX = portalCenter.x;
    const portalY = portalCenter.y;
    const protectedRadiusSq = portalRef.safetyRadius * portalRef.safetyRadius;

    while (queue.length > 0) {
        const { c, r } = queue.shift();

        // Check portal protection for this block
        const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
        const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
        const dx = blockCenterX - portalX;
        const dy = blockCenterY - portalY;
        const distSqToPortal = dx * dx + dy * dy;

        if (distSqToPortal < protectedRadiusSq) {
            // This block is protected, it cannot be part of a *falling* chunk.
            // It acts as a fixed point / external support from other chunks' perspective.
            continue; 
        }

        const blockData = World.getBlock(c, r); 
        const blockType = (typeof blockData === 'object' && blockData !== null) ? blockData.type : blockData;

        if (blockType !== Config.BLOCK_AIR && blockType !== Config.BLOCK_WATER && blockData !== null) {
            chunk.push({ c, r, blockData }); // Store original block data (will be an object for solid blocks)
        } else {
             // This should ideally not happen if BFS starts from a solid, unvisited block.
            continue;
        }

        const neighbors = [
            { dc: 0, dr: -1 }, { dc: 0, dr: 1 }, // Up, Down
            { dc: -1, dr: 0 }, { dc: 1, dr: 0 }  // Left, Right
        ];

        for (const offset of neighbors) {
            const nc = c + offset.dc;
            const nr = r + offset.dr;
            const neighborKey = `${nc},${nr}`;

            if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS &&
                !visitedInChunk.has(neighborKey) && !visitedInPass.has(neighborKey)) {

                const neighborBlockData = World.getBlock(nc, nr);
                const neighborType = (typeof neighborBlockData === 'object' && neighborBlockData !== null) ? neighborBlockData.type : neighborBlockData;

                if (neighborType !== Config.BLOCK_AIR && neighborType !== Config.BLOCK_WATER && neighborBlockData !== null) {
                     // Check portal protection for neighbor before adding to queue for this chunk
                    const nBlockCenterX = nc * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                    const nBlockCenterY = nr * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                    const nDx = nBlockCenterX - portalX;
                    const nDy = nBlockCenterY - portalY;
                    if ( (nDx * nDx + nDy * nDy) >= protectedRadiusSq) { // Only add if NOT protected
                        visitedInChunk.add(neighborKey);
                        visitedInPass.add(neighborKey); 
                        queue.push({ c: nc, r: nr });
                    }
                }
            }
        }
    }
    return chunk;
}

export function applyGravitySettlement(portalRef) {
    if (!portalRef) {
        console.error("[WorldManager] applyGravitySettlement: Portal reference is null. Skipping settlement.");
        return [];
    }

    let allMovedBlocksInSettlement = [];
    let iterations = 0;
    const MAX_ITERATIONS = Config.MAX_GRAVITY_SETTLEMENT_PASSES || Config.GRID_ROWS;

    console.log("[WorldManager] Starting Connected Component Gravity Settlement...");

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        let blocksMovedThisIteration = false;
        const visitedInPass = new Set();

        for (let r_scan = 0; r_scan < Config.GRID_ROWS; r_scan++) {
            for (let c_scan = 0; c_scan < Config.GRID_COLS; c_scan++) {
                const currentKey = `${c_scan},${r_scan}`;
                if (visitedInPass.has(currentKey)) {
                    continue;
                }

                const blockStart = World.getBlock(c_scan, r_scan);
                const blockTypeStart = (typeof blockStart === 'object' && blockStart !== null) ? blockStart.type : blockStart;

                if (blockTypeStart !== Config.BLOCK_AIR && blockTypeStart !== Config.BLOCK_WATER && blockStart !== null) {
                    const chunk = getConnectedSolidChunk(c_scan, r_scan, visitedInPass, portalRef);

                    if (chunk.length === 0) continue;

                    let isSupported = false;
                    for (const chunkBlock of chunk) {
                        const cb_c = chunkBlock.c;
                        const cb_r = chunkBlock.r;

                        if (cb_r === Config.GRID_ROWS - 1) {
                            isSupported = true;
                            break;
                        }

                        const blockBelowType = World.getBlockType(cb_c, cb_r + 1);

                        if (blockBelowType !== Config.BLOCK_AIR && blockBelowType !== Config.BLOCK_WATER && blockBelowType !== null) {
                            const isSupportInternal = chunk.some(b => b.c === cb_c && b.r === cb_r + 1);
                            if (!isSupportInternal) {
                                isSupported = true;
                                break;
                            }
                        }
                    }

                    if (isSupported) {
                        continue;
                    }

                    let minFallDistance = Config.GRID_ROWS;
                    for (const chunkBlock of chunk) {
                        let currentFall = 0;
                        for (let fall_r = chunkBlock.r + 1; fall_r < Config.GRID_ROWS; fall_r++) {
                            const blockAtFallTarget = World.getBlock(chunkBlock.c, fall_r);
                            const typeAtFallTarget = (typeof blockAtFallTarget === 'object' && blockAtFallTarget !== null) ? blockAtFallTarget.type : blockAtFallTarget;
                            const isTargetBelowPartOfChunk = chunk.some(b => b.c === chunkBlock.c && b.r === fall_r);

                            if (isTargetBelowPartOfChunk) {
                                currentFall++;
                            } else if (typeAtFallTarget !== Config.BLOCK_AIR && typeAtFallTarget !== Config.BLOCK_WATER && blockAtFallTarget !== null) {
                                break;
                            } else {
                                currentFall++;
                            }
                        }
                        minFallDistance = Math.min(minFallDistance, currentFall);
                    }

                    if (minFallDistance > 0) {
                        blocksMovedThisIteration = true;
                        chunk.sort((a, b) => b.r - a.r);

                        const currentChunkMoves = [];
                        for (const chunkBlock of chunk) {
                            currentChunkMoves.push({
                                c: chunkBlock.c,
                                r_start: chunkBlock.r,
                                r_end: chunkBlock.r + minFallDistance,
                                blockData: chunkBlock.blockData
                            });
                        }
                        allMovedBlocksInSettlement.push(...currentChunkMoves); // <<< --- ACCUMULATE HERE ---

                        for (const chunkBlock of chunk) {
                            World.setBlockData(chunkBlock.c, chunkBlock.r, createBlock(Config.BLOCK_AIR, false));
                        }
                        for (const chunkBlock of chunk) {
                            const newR = chunkBlock.r + minFallDistance;
                            World.setBlockData(chunkBlock.c, newR, chunkBlock.blockData);
                        }
                    }
                }
            }
        }
        if (!blocksMovedThisIteration) {
            break;
        }
    }

    if (iterations >= MAX_ITERATIONS && blocksMovedThisIteration) {
        console.warn(`[WorldManager] Connected Component Gravity Settlement reached max iterations (${MAX_ITERATIONS}). Settlement might be incomplete.`);
    }
    console.log(`[WorldManager] Connected Component Gravity Settlement finished in ${iterations} iteration(s). Blocks moved: ${allMovedBlocksInSettlement.length}`);

    return allMovedBlocksInSettlement; // <<< --- RETURN THE ACCUMULATED MOVES ---
}

// -----------------------------------------------------------------------------
// --- Initialization ---
// -----------------------------------------------------------------------------

export function init(portalRef) {
    console.log("Initializing WorldManager...");
    World.initializeGrid();
    generateInitialWorld();

    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before WorldManager.init().");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("FATAL: Renderer.createGridCanvas() failed during WorldManager.init fallback.");
        }
        console.warn("Renderer.createGridCanvas() was called as a fallback during WorldManager.init.");
    }

    agingAnimationQueue = [];
    activeAgingAnimations = [];
    newAnimationStartTimer = 0;

    console.log("WorldManager initialized.");
}

// -----------------------------------------------------------------------------
// --- Water Simulation ---
// -----------------------------------------------------------------------------

export function addWaterUpdateCandidate(col, row) {
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        const key = `${col},${row}`;
        if (!waterUpdateQueue.has(key)) {
            const blockType = World.getBlockType(col, row);
            if (blockType !== null &&
                (blockType === Config.BLOCK_WATER ||
                (blockType === Config.BLOCK_AIR && row >= Config.WATER_LEVEL))) {
                waterUpdateQueue.set(key, {c: col, r: row});
                return true;
            }
        }
    }
    return false;
}

export function resetWaterPropagationTimer() {
    waterPropagationTimer = 0;
}

export function queueWaterCandidatesAroundChange(c, r) {
    let candidateAdded = false;
    candidateAdded = addWaterUpdateCandidate(c, r) || candidateAdded;
    candidateAdded = addWaterUpdateCandidate(c, r - 1) || candidateAdded;
    candidateAdded = addWaterUpdateCandidate(c, r + 1) || candidateAdded;
    candidateAdded = addWaterUpdateCandidate(c - 1, r) || candidateAdded;
    candidateAdded = addWaterUpdateCandidate(c + 1, r) || candidateAdded;

    if (candidateAdded) {
        resetWaterPropagationTimer();
    }
}

export function seedWaterUpdateQueue() {
    console.log("WorldManager: Seeding water update queue...");
    waterUpdateQueue.clear();
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = World.getBlockType(c, r);
            // Add any existing water block or any air block as a candidate initially
            if (blockType === Config.BLOCK_WATER || blockType === Config.BLOCK_AIR) {
                addWaterUpdateCandidate(c, r);
            }
            // Also, ensure neighbors of water and solid blocks near the waterline are considered,
            // as they might become candidates for water flow or have water flow into them.
            if (blockType === Config.BLOCK_WATER || (GridCollision.isSolid(c, r) && r >= Config.WATER_LEVEL - 2)) {
                 queueWaterCandidatesAroundChange(c,r);
            }
        }
    }
    console.log(`WorldManager: Seeded Water Update Queue with ${waterUpdateQueue.size} candidates.`);
    waterPropagationTimer = 0; // Reset timer to allow immediate processing
}


// -----------------------------------------------------------------------------
// --- Block Interaction ---
// -----------------------------------------------------------------------------

export function placePlayerBlock(col, row, blockType) {
    const success = World.setBlock(col, row, blockType, true); // Mark as player placed
    if (success) {
        updateStaticWorldAt(col, row); // Update the specific block on the static canvas
        queueWaterCandidatesAroundChange(col, row); // Queue neighbors for water update
    } else {
        console.error(`WorldManager placePlayerBlock failed to set block at [${col}, ${row}]`);
    }
    return success;
}

export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage to apply

    const block = World.getBlock(col, row);

    // Check if block is valid and damageable
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false; // Not a damageable block
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
        console.error(`Invalid HP type for block at [${col}, ${row}]. HP: ${block.hp}. Resetting HP.`);
        block.hp = block.maxHp; // Attempt to recover by resetting HP
        return false; // Don't process damage this frame if HP was invalid
    }


    block.hp -= damageAmount;
    updateStaticWorldAt(col, row); // Update visual representation (damage indicator)

    let wasDestroyed = false;
    if (block.hp <= 0) {
        wasDestroyed = true;
        block.hp = 0; // Ensure HP doesn't go negative

        // Determine item drop type
        let dropType = null;
        switch (block.type) {
            case Config.BLOCK_VEGETATION: dropType = 'vegetation'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
            // Add other block types that drop items here
        }

        // Spawn item if a drop type is defined
        if (dropType) {
            const dropXBase = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropYBase = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            // Add a little random scatter to the drop position
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

        // Set block to AIR
        const success = World.setBlock(col, row, Config.BLOCK_AIR, false); // Destroyed block is no longer player placed
        if (success) {
            updateStaticWorldAt(col, row); // Update static canvas
            queueWaterCandidatesAroundChange(col, row); // Queue neighbors for water update
        } else {
            console.error(`WorldManager damageBlock failed to set AIR at [${col}, ${row}] after destruction.`);
        }
    }
    return true; // Damage was processed (even if not destroyed)
}


// -----------------------------------------------------------------------------
// --- Aging Animation ---
// -----------------------------------------------------------------------------

export function addProposedAgingChanges(changes) {
    changes.forEach(change => agingAnimationQueue.push(change));
    console.log(`[WorldManager] Added ${changes.length} proposed aging changes to animation queue. Total: ${agingAnimationQueue.length}`);
}

function updateAgingAnimations(dt) {
    if (dt <= 0) return; // Don't process if no time has passed

    // Start new animations from queue if conditions are met
    newAnimationStartTimer -= dt;
    if (newAnimationStartTimer <= 0 && agingAnimationQueue.length > 0 && activeAgingAnimations.length < Config.AGING_ANIMATION_BLOCKS_AT_ONCE) {
        const change = agingAnimationQueue.shift(); // Get the next change from the queue

        // Check if an animation is already active for this cell
        const existingAnimIndex = activeAgingAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);

        if (existingAnimIndex !== -1) {
            console.warn(`[WorldManager] Trying to start new animation for [${change.c},${change.r}] while one is active. Skipping.`);
        } else {
            activeAgingAnimations.push({
                c: change.c,
                r: change.r,
                oldBlockType: change.oldBlockType,
                newBlockType: change.newBlockType,
                timer: Config.AGING_ANIMATION_SWELL_DURATION, // Duration for swell phase
                phase: 'swell', // Initial phase
                currentScale: 1.0,
            });
            newAnimationStartTimer = Config.AGING_ANIMATION_NEW_BLOCK_DELAY; // Reset delay for next animation

            // Clear the block on the static canvas to make way for the animation
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
            const progress = Math.min(1.0, Math.max(0, timeElapsed / Config.AGING_ANIMATION_SWELL_DURATION));
            // Simple ease-out sine for swell: anim.currentScale = 1.0 + (Config.AGING_ANIMATION_SWELL_SCALE - 1.0) * Math.sin(progress * Math.PI / 2);
            // Let's try a slightly different curve:
            anim.currentScale = 1.0 + (Config.AGING_ANIMATION_SWELL_SCALE - 1.0) * progress; // Linear for now, can be eased

            if (anim.timer <= 0) {
                anim.phase = 'pop';
                anim.timer = Config.AGING_ANIMATION_POP_DURATION; // Duration for pop phase
                anim.currentScale = 1.0; // Reset scale for pop phase (new block appears)
            }
        } else if (anim.phase === 'pop') {
            // Pop phase: New block appears (can be animated too, e.g., scale up or fade in)
            // For now, it's just a brief display before finalization.
            if (anim.timer <= 0) {
                // Animation finished, update the world grid and static canvas
                // The logical change to World.grid already happened when AgingManager.applyAging ran.
                // Here, we just update the static visual on gridCtx.
                updateStaticWorldAt(anim.c, anim.r);
                queueWaterCandidatesAroundChange(anim.c, anim.r); // Queue for water sim
                activeAgingAnimations.splice(i, 1); // Remove from active animations
            }
        }
    }
}

function drawAgingAnimations(ctx) {
    activeAgingAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        const blockPixelY = anim.r * Config.BLOCK_HEIGHT;
        const blockWidth = Config.BLOCK_WIDTH;
        const blockHeight = Config.BLOCK_HEIGHT;

        ctx.save();

        if (anim.phase === 'swell') {
            // Center transformation around the block's center
            ctx.translate(blockPixelX + blockWidth / 2, blockPixelY + blockHeight / 2);
            ctx.scale(anim.currentScale, anim.currentScale);
            ctx.translate(-(blockPixelX + blockWidth / 2), -(blockPixelY + blockHeight / 2));

            // Draw the "swelling" old block
            const oldColor = Config.BLOCK_COLORS[anim.oldBlockType];
            if (oldColor && anim.oldBlockType !== Config.BLOCK_AIR) { // Don't draw swelling air
                ctx.fillStyle = Config.AGING_ANIMATION_OLD_BLOCK_COLOR; // Use a distinct animation color
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        } else if (anim.phase === 'pop') {
            // Draw the "popping in" new block
            const newColor = Config.BLOCK_COLORS[anim.newBlockType];
            if (newColor && anim.newBlockType !== Config.BLOCK_AIR) { // Don't draw appearing air
                // Optional: Animate alpha or scale for the pop
                const popProgress = Math.max(0, 1.0 - (anim.timer / Config.AGING_ANIMATION_POP_DURATION));
                // Example: Fade in
                const alpha = 0.6 + 0.4 * Math.sin(popProgress * Math.PI); // Simple fade-in/out effect
                ctx.globalAlpha = alpha;
                ctx.fillStyle = Config.AGING_ANIMATION_NEW_BLOCK_COLOR; // Use distinct animation color
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
                ctx.globalAlpha = 1.0; // Reset alpha
            }
        }
        ctx.restore();
    });
}

export function areAgingAnimationsComplete() {
    return agingAnimationQueue.length === 0 && activeAgingAnimations.length === 0;
}

export function finalizeAllAgingAnimations() {
    console.log(`[WorldManager] Finalizing ${agingAnimationQueue.length} queued and ${activeAgingAnimations.length} active aging animations...`);
    // Process any remaining queued animations (apply their changes instantly)
    while(agingAnimationQueue.length > 0) {
        const change = agingAnimationQueue.shift();
        // The logical change to World.grid already happened. We just update the static canvas.
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    // Process any remaining active animations (apply their final state instantly)
    while(activeAgingAnimations.length > 0) {
        const anim = activeAgingAnimations.shift();
        updateStaticWorldAt(anim.c, anim.r); // Apply the newBlockType to static canvas
        queueWaterCandidatesAroundChange(anim.c, anim.r);
    }
    console.log("[WorldManager] All aging animations finalized.");
}


// -----------------------------------------------------------------------------
// --- Rendering ---
// -----------------------------------------------------------------------------

export function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }

    const block = World.getBlock(col, row); // Get the block data (could be an object or Config.BLOCK_AIR)
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use ceil for pixel-perfect covering
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH); // Clear the cell

    // Only draw if not AIR and not null/undefined
    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
        const currentBlockType = typeof block === 'object' && block !== null ? block.type : block; // Handle if block is just a type ID (shouldn't happen if createBlock is used)

        if (currentBlockType === Config.BLOCK_AIR) return; // Explicitly skip drawing AIR

        const blockColor = Config.BLOCK_COLORS[currentBlockType];
        if (blockColor) {
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

            // Draw player-placed outline if applicable
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                gridCtx.save();
                gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                // Inset stroke so it's fully within the block's bounds
                const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                gridCtx.strokeRect(
                    Math.floor(blockX) + outlineInset,
                    Math.floor(blockY) + outlineInset,
                    blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                    blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                );
                gridCtx.restore();
            }


            // Draw damage indicators if applicable
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                const hpRatio = block.hp / block.maxHp;

                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // Show first slash
                    gridCtx.save();
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square'; // For sharper line ends

                    // Offset for line width to keep indicators within block bounds
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // Adjusted for better visuals

                    // Draw first slash (top-left to bottom-right)
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset);
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();

                    if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) { // Show second slash (X)
                        gridCtx.beginPath();
                        gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset);
                        gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset);
                        gridCtx.stroke();
                    }
                    gridCtx.restore();
                }
            }
        } else {
            console.warn(`No color defined for block type ${currentBlockType} at [${col}, ${row}]`);
        }
    }
}


export function renderStaticWorldToGridCanvas() {
    console.log("WorldManager: Rendering static world to grid canvas...");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();

    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        return;
    }

    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); // Clear entire grid canvas

    const worldGrid = World.getGrid(); // Get the current state of the world
    if (!worldGrid || !Array.isArray(worldGrid)) {
        console.error("WorldManager: Cannot render, worldGrid is invalid.");
        return;
    }

    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (!Array.isArray(worldGrid[r])) {
            // console.warn(`WorldManager: Row ${r} is invalid during render. Skipping.`); // Can be noisy
            continue;
        }
        for (let c = 0; c < Config.GRID_COLS; c++) {
            updateStaticWorldAt(c, r); // Draw each block individually
        }
    }
    console.log("WorldManager: Static world render complete.");
}

export function draw(ctx) {
    if (!ctx) {
        console.error("WorldManager.draw: No drawing context provided!");
        return;
    }

    // Draw the pre-rendered static world from the off-screen canvas
    const gridCanvas = Renderer.getGridCanvas();
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0);
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
        // As a fallback, could try to render directly, but it would be slow:
        // for (let r = 0; r < Config.GRID_ROWS; r++) {
        //     for (let c = 0; c < Config.GRID_COLS; c++) {
        //         // ... direct drawing logic for each block ...
        //     }
        // }
    }

    // Draw active aging animations on top
    drawGravityAnimations(ctx); //
    drawAgingAnimations(ctx);
}

// -----------------------------------------------------------------------------
// --- Update Cycle ---
// -----------------------------------------------------------------------------

export function update(dt) {
    // --- Water Propagation ---
    waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

        // Get candidates and sort by row (bottom-up) to simulate gravity flow better
        const candidatesArray = Array.from(waterUpdateQueue.values());
        candidatesArray.sort((a, b) => b.r - a.r); // Process lower rows first

        // Process a limited number of candidates per frame
        const candidatesToProcess = candidatesArray.slice(0, Config.WATER_UPDATES_PER_FRAME);

        // Remove processed candidates from the main queue
        candidatesToProcess.forEach(({c, r}) => {
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key);
        });

        // Process each candidate
        candidatesToProcess.forEach(({c, r}) => {
            // Boundary checks (should be redundant if addWaterUpdateCandidate is robust)
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;

            const currentBlockType = World.getBlockType(c, r);

            if (currentBlockType === Config.BLOCK_AIR) {
                // If this AIR block is at or below the water level
                // OR if it's adjacent to an existing WATER block (above, below, left, right)
                // then it can become water.
                if (r >= Config.WATER_LEVEL) { // At or below general water level
                    let adjacentToWater = false;
                    const immediateNeighbors = [
                        {dc:0, dr:1}, {dc:0, dr:-1}, {dc:1, dr:0}, {dc:-1, dr:0}
                    ];
                    for (const neighbor of immediateNeighbors) {
                        const nc = c + neighbor.dc;
                        const nr = r + neighbor.dr;
                        if (nc >=0 && nc < Config.GRID_COLS && nr >=0 && nr < Config.GRID_ROWS && World.getBlockType(nc, nr) === Config.BLOCK_WATER) {
                            adjacentToWater = true;
                            break;
                        }
                    }

                    if (adjacentToWater) {
                        const success = World.setBlock(c, r, Config.BLOCK_WATER, false);
                        if (success) {
                            updateStaticWorldAt(c, r);
                            queueWaterCandidatesAroundChange(c, r); // Add its neighbors for next tick
                        } else {
                             console.warn(`Water flow failed to set block to WATER at [${c},${r}]`);
                        }
                    }
                }
            } else if (currentBlockType === Config.BLOCK_WATER) {
                // If this is a WATER block, try to flow downwards or sideways

                // 1. Try to flow down into AIR
                const blockBelowType = World.getBlockType(c, r + 1);
                if (blockBelowType === Config.BLOCK_AIR) {
                    addWaterUpdateCandidate(c, r + 1); // Add the air block below to be processed
                } else {
                    // If cannot flow down (blocked by solid or another water block)
                    // Check if the block below is either solid or already water
                     const blockBelow = World.getBlock(c, r + 1);
                     const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Treat null as AIR for logic
                     const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);


                    if (isBelowSolidOrWater) { // Includes being blocked by other water
                        // 2. Try to flow sideways into AIR (only if at or below water level)
                        let spreadOccurred = false;
                        if (World.getBlockType(c - 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) { // Left
                            addWaterUpdateCandidate(c - 1, r);
                            spreadOccurred = true;
                        }
                        if (World.getBlockType(c + 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) { // Right
                            addWaterUpdateCandidate(c + 1, r);
                            spreadOccurred = true;
                        }
                        // If water spread, it might be able to flow further from its current spot next tick
                        if(spreadOccurred) {
                            addWaterUpdateCandidate(c,r); // Re-add current water block if it spread
                        }
                    }
                }
            }
        });
    }

    // --- Aging Animations ---
    updateGravityAnimations(dt);
    updateAgingAnimations(dt);
}