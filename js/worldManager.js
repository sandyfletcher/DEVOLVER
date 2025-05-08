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

// --- Module State ---
let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed

// Aging Animation State
let agingAnimationQueue = []; // Stores { c, r, oldBlockType, newBlockType } for pending animations
let activeAgingAnimations = []; // Stores { c, r, oldBlockType, newBlockType, timer, phase, currentScale }
let newAnimationStartTimer = 0; // Timer to delay starting new animations from the queue

// -----------------------------------------------------------------------------
// --- Initialization ---
// -----------------------------------------------------------------------------

export function init(portalRef) {
    console.log("Initializing WorldManager...");
    WorldData.initializeGrid(); // Ensure grid is initialized first
    generateInitialWorld(); // world generator now handles landmass + flood fill

    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before WorldManager.init().");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("FATAL: Renderer.createGridCanvas() failed during WorldManager.init fallback.");
        }
        console.warn("Renderer.createGridCanvas() was called as a fallback during WorldManager.init.");
    }

    // Reset animation queues on init
    agingAnimationQueue = [];
    activeAgingAnimations = [];
    newAnimationStartTimer = 0;

    console.log("WorldManager initialized.");
}

// -----------------------------------------------------------------------------
// --- Water Simulation ---
// -----------------------------------------------------------------------------

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
             const blockType = WorldData.getBlockType(c, r);
             if (blockType === Config.BLOCK_WATER || blockType === Config.BLOCK_AIR) {
                 addWaterUpdateCandidate(c, r);
             }
             if (blockType === Config.BLOCK_WATER || (GridCollision.isSolid(c, r) && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - 2)) {
                 queueWaterCandidatesAroundChange(c, r);
             }
        }
    }
    console.log(`WorldManager: Seeded Water Update Queue with ${waterUpdateQueue.size} candidates.`);
    waterPropagationTimer = 0;
}

// -----------------------------------------------------------------------------
// --- Block Interaction ---
// -----------------------------------------------------------------------------

export function placePlayerBlock(col, row, blockType) {
    const success = WorldData.setBlock(col, row, blockType, true);
    if (success) {
        updateStaticWorldAt(col, row);
        queueWaterCandidatesAroundChange(col, row);
    } else {
        console.error(`WorldManager placePlayerBlock failed to set block at [${col}, ${row}]`);
    }
    return success;
}

export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false;
    const block = WorldData.getBlock(col, row);
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false;
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
         console.error(`Invalid HP type for block at [${col}, ${row}]. HP: ${block.hp}. Resetting HP.`);
         block.hp = block.maxHp;
         return false;
    }

    block.hp -= damageAmount;
    updateStaticWorldAt(col, row);

    let wasDestroyed = false;
    if (block.hp <= 0) {
        wasDestroyed = true;
        block.hp = 0;
        let dropType = null;
        switch (block.type) {
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
        }

        if (dropType) {
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

        const success = WorldData.setBlock(col, row, Config.BLOCK_AIR, false);
        if (success) {
            updateStaticWorldAt(col, row);
            queueWaterCandidatesAroundChange(col, row);
        } else {
             console.error(`WorldManager damageBlock failed to set AIR at [${col}, ${row}] after destruction.`);
        }
    }
    return true;
}

// -----------------------------------------------------------------------------
// --- Aging Animation ---
// -----------------------------------------------------------------------------

export function addProposedAgingChanges(changes) {
    // Aging animations are always on, directly add to queue.
    changes.forEach(change => agingAnimationQueue.push(change));
    console.log(`[WorldManager] Added ${changes.length} proposed aging changes to animation queue. Total: ${agingAnimationQueue.length}`);
}
function updateAgingAnimations(dt) {
    if (dt <= 0) return;
    newAnimationStartTimer -= dt;
    if (newAnimationStartTimer <= 0 && agingAnimationQueue.length > 0 && activeAgingAnimations.length < Config.AGING_ANIMATION_BLOCKS_AT_ONCE) {
        const change = agingAnimationQueue.shift();
        const existingAnimIndex = activeAgingAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);
        if (existingAnimIndex !== -1) {
             console.warn(`[WorldManager] Trying to start new animation for [${change.c},${change.r}] while one is active. Skipping.`);
        } else {
            activeAgingAnimations.push({
                c: change.c,
                r: change.r,
                oldBlockType: change.oldBlockType,
                newBlockType: change.newBlockType,
                timer: Config.AGING_ANIMATION_SWELL_DURATION,
                phase: 'swell',
                currentScale: 1.0,
            });
            newAnimationStartTimer = Config.AGING_ANIMATION_NEW_BLOCK_DELAY;
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
    for (let i = activeAgingAnimations.length - 1; i >= 0; i--) {
        const anim = activeAgingAnimations[i];
        anim.timer -= dt;
        if (anim.phase === 'swell') {
            const timeElapsed = Config.AGING_ANIMATION_SWELL_DURATION - anim.timer;
            const progress = Math.min(1.0, Math.max(0, timeElapsed / Config.AGING_ANIMATION_SWELL_DURATION));
            anim.currentScale = 1.0 + (Config.AGING_ANIMATION_SWELL_SCALE - 1.0) * Math.sin(progress * Math.PI / 2);
            if (anim.timer <= 0) {
                anim.phase = 'pop';
                anim.timer = Config.AGING_ANIMATION_POP_DURATION;
                 anim.currentScale = 1.0;
            }
        } else if (anim.phase === 'pop') {
            if (anim.timer <= 0) {
                updateStaticWorldAt(anim.c, anim.r);
                queueWaterCandidatesAroundChange(anim.c, anim.r);
                activeAgingAnimations.splice(i, 1);
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
            ctx.translate(blockPixelX + blockWidth / 2, blockPixelY + blockHeight / 2);
            ctx.scale(anim.currentScale, anim.currentScale);
            ctx.translate(-(blockPixelX + blockWidth / 2), -(blockPixelY + blockHeight / 2));
            const oldColor = Config.BLOCK_COLORS[anim.oldBlockType];
            if (oldColor && anim.oldBlockType !== Config.BLOCK_AIR) {
                ctx.fillStyle = Config.AGING_ANIMATION_OLD_BLOCK_COLOR;
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        } else if (anim.phase === 'pop') {
            const newColor = Config.BLOCK_COLORS[anim.newBlockType];
            if (newColor && anim.newBlockType !== Config.BLOCK_AIR) {
                 const popProgress = Math.max(0, 1.0 - (anim.timer / Config.AGING_ANIMATION_POP_DURATION));
                 const alpha = 0.6 + 0.4 * Math.sin(popProgress * Math.PI);
                 ctx.globalAlpha = alpha;
                 ctx.fillStyle = Config.AGING_ANIMATION_NEW_BLOCK_COLOR;
                 ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
                 ctx.globalAlpha = 1.0;
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
    while(agingAnimationQueue.length > 0) {
        const change = agingAnimationQueue.shift();
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    while(activeAgingAnimations.length > 0) {
        const anim = activeAgingAnimations.shift();
        updateStaticWorldAt(anim.c, anim.r);
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
    const block = WorldData.getBlock(col, row);
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
         const currentBlockType = typeof block === 'object' && block !== null ? block.type : block;
         if (currentBlockType === Config.BLOCK_AIR) return;
         const blockColor = Config.BLOCK_COLORS[currentBlockType];
         if (blockColor) {
            gridCtx.fillStyle = blockColor;
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                 gridCtx.save();
                 gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                 gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                 const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                  gridCtx.strokeRect(
                     Math.floor(blockX) + outlineInset,
                     Math.floor(blockY) + outlineInset,
                     blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS,
                     blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                 );
                 gridCtx.restore();
            }
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                const hpRatio = block.hp / block.maxHp;
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                    gridCtx.save();
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square';
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;

                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset);
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();

                    if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) {
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
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    const worldGrid = WorldData.getGrid();
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            updateStaticWorldAt(c, r);
        }
    }
}
export function draw(ctx) {
    if (!ctx) {
        console.error("WorldManager.draw: No drawing context provided!");
        return;
    }
    const gridCanvas = Renderer.getGridCanvas();
    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0);
    } else {
        console.error("WorldManager.draw: Cannot draw world, grid canvas is not available!");
    }
    drawAgingAnimations(ctx);
}

// -----------------------------------------------------------------------------
// --- Update Cycle ---
// -----------------------------------------------------------------------------

export function update(dt) {
    waterPropagationTimer = Math.max(0, waterPropagationTimer - dt); // Water propagation
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY;
        const candidatesArray = Array.from(waterUpdateQueue.values());
        candidatesArray.sort((a, b) => b.r - a.r);
        const candidatesToProcess = candidatesArray.slice(0, Config.WATER_UPDATES_PER_FRAME);

        candidatesToProcess.forEach(({c, r}) => {
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key);
        });

        candidatesToProcess.forEach(({c, r}) => {
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return;
            const currentBlockType = WorldData.getBlockType(c, r);

            if (currentBlockType === Config.BLOCK_AIR) {
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
                const blockBelowType = WorldData.getBlockType(c, r + 1);
                if (blockBelowType === Config.BLOCK_AIR) {
                    addWaterUpdateCandidate(c, r + 1);
                } else {
                    const blockBelow = WorldData.getBlock(c, r + 1);
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR;
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);

                    if (isBelowSolidOrWater) {
                         let spreadOccurred = false;
                         if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                             addWaterUpdateCandidate(c - 1, r);
                             spreadOccurred = true;
                         }
                         if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                             addWaterUpdateCandidate(c + 1, r);
                             spreadOccurred = true;
                         }
                         if (spreadOccurred) {
                              addWaterUpdateCandidate(c, r);
                         }
                    }
                }
            }
        });
    }
    updateAgingAnimations(dt);
}