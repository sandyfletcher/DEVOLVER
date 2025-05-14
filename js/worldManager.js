// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as Renderer from './renderer.js';
import * as World from './utils/world.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld as generateWorldFromGenerator } from './utils/worldGenerator.js'; // Import the generator
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

// --- NEW: Lighting Animation State ---
let lightingAnimationQueue = []; // Stores { c, r, newLitState: true } for pending animations
let activeLightingAnimations = []; // Stores { c, r, newLitState, timer }
let newLightingAnimationStartTimer = 0; // Timer to delay starting new lighting animations

const MAX_FALLING_BLOCKS_AT_ONCE = 20; 
const GRAVITY_ANIMATION_FALL_SPEED = 200; 
const NEW_GRAVITY_ANIM_DELAY = 0.02; 

const SUN_MOVEMENT_Y_ROW_OFFSET = -3; 
const SUN_RAYS_PER_POSITION = 36;    
const SUN_MOVEMENT_STEP_COLUMNS = 5;   
const MAX_LIGHT_RAY_LENGTH_BLOCKS = Math.floor(Config.GRID_ROWS * 1.2); 

// This function will take the output of `diffGrids` and try to identify falling blocks.
function parseGravityDiffsIntoFallingBlocks(diffs) {
    const fallingBlocks = [];
    const disappeared = new Map(); 
    const appeared = new Map();    

    diffs.forEach(diff => {
        if (diff.oldBlockType !== Config.BLOCK_AIR && diff.oldBlockType !== Config.BLOCK_WATER && diff.newBlockType === Config.BLOCK_AIR) {
            if (!disappeared.has(diff.c)) disappeared.set(diff.c, new Map());
            disappeared.get(diff.c).set(diff.r, diff.oldBlockType); 
        }
        else if (diff.oldBlockType === Config.BLOCK_AIR && diff.newBlockType !== Config.BLOCK_AIR && diff.newBlockType !== Config.BLOCK_WATER) {
            if (!appeared.has(diff.c)) appeared.set(diff.c, new Map());
            appeared.get(diff.c).set(diff.r, World.getBlock(diff.c, diff.r));
        }
    });

    appeared.forEach((rowMapNew, c) => {
        if (disappeared.has(c)) {
            const rowMapOld = disappeared.get(c);
            rowMapOld.forEach((oldType, rOld) => {
                let bestMatchRNew = -1;
                let matchedBlockData = null;
                rowMapNew.forEach((blockDataNew, rNew) => {
                    if (rNew > rOld) {
                        if (bestMatchRNew === -1 || rNew < bestMatchRNew) {
                            if (blockDataNew.type === oldType) {
                                bestMatchRNew = rNew;
                                matchedBlockData = blockDataNew;
                            }
                        }
                    }
                });
                if (bestMatchRNew !== -1 && matchedBlockData) {
                    fallingBlocks.push({
                        c: c, r_start: rOld, r_end: bestMatchRNew, blockData: matchedBlockData
                    });
                    rowMapNew.delete(bestMatchRNew);
                }
            });
        }
    });
    return fallingBlocks;
}

export function addProposedGravityChanges(changes) {
    changes.forEach(change => {
        gravityAnimationQueue.push(change);
    });
}

function updateGravityAnimations(dt) {
    if (dt <= 0) return;
    newGravityAnimationStartTimer -= dt;
    if (newGravityAnimationStartTimer <= 0 && gravityAnimationQueue.length > 0 && activeGravityAnimations.length < MAX_FALLING_BLOCKS_AT_ONCE) {
        const change = gravityAnimationQueue.shift();
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
            r_start_pixel_y: change.r_start * Config.BLOCK_HEIGHT,
            r_current_pixel_y: change.r_start * Config.BLOCK_HEIGHT,
            r_end_pixel_y: change.r_end * Config.BLOCK_HEIGHT,
            blockData: change.blockData,
            fallSpeed: GRAVITY_ANIMATION_FALL_SPEED,
        });
        newGravityAnimationStartTimer = NEW_GRAVITY_ANIM_DELAY;
    }
    for (let i = activeGravityAnimations.length - 1; i >= 0; i--) {
        const anim = activeGravityAnimations[i];
        anim.r_current_pixel_y += anim.fallSpeed * dt;
        if (anim.r_current_pixel_y >= anim.r_end_pixel_y) {
            const end_row = Math.round(anim.r_end_pixel_y / Config.BLOCK_HEIGHT);
            updateStaticWorldAt(anim.c, end_row);
            queueWaterCandidatesAroundChange(anim.c, anim.r_start);
            queueWaterCandidatesAroundChange(anim.c, end_row);
            activeGravityAnimations.splice(i, 1);
        }
    }
}

function drawGravityAnimations(ctx) {
    activeGravityAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
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
    while (gravityAnimationQueue.length > 0) {
        const change = gravityAnimationQueue.shift();
        const end_row = Math.round((change.r_end_pixel_y !== undefined ? change.r_end_pixel_y : change.r_end * Config.BLOCK_HEIGHT) / Config.BLOCK_HEIGHT);
        const start_row = Math.round((change.r_start_pixel_y !== undefined ? change.r_start_pixel_y : change.r_start * Config.BLOCK_HEIGHT) / Config.BLOCK_HEIGHT);
        updateStaticWorldAt(change.c, start_row);
        updateStaticWorldAt(change.c, end_row);
        queueWaterCandidatesAroundChange(change.c, start_row);
        queueWaterCandidatesAroundChange(change.c, end_row);
    }
    while (activeGravityAnimations.length > 0) {
        const anim = activeGravityAnimations.shift();
        const end_row = Math.round(anim.r_end_pixel_y / Config.BLOCK_HEIGHT);
        const start_row = Math.round(anim.r_start_pixel_y / Config.BLOCK_HEIGHT);
        updateStaticWorldAt(anim.c, start_row);
        updateStaticWorldAt(anim.c, end_row);
        queueWaterCandidatesAroundChange(anim.c, start_row);
        queueWaterCandidatesAroundChange(anim.c, end_row);
    }
    gravityAnimationQueue = [];
    activeGravityAnimations = [];
}

function getConnectedSolidChunk(startX, startY, visitedInPass, portalRef) {
    const chunk = [];
    const queue = [{ c: startX, r: startY }];
    const visitedInChunk = new Set();
    const startKey = `${startX},${startY}`;
    visitedInChunk.add(startKey);
    visitedInPass.add(startKey);
    let portalX, portalY, protectedRadiusSq;
    let applyPortalProtection = false;
    if (portalRef && typeof portalRef.getPosition === 'function' && typeof portalRef.safetyRadius === 'number') {
        const portalCenter = portalRef.getPosition();
        if (portalCenter && typeof portalCenter.x === 'number' && typeof portalCenter.y === 'number') {
            portalX = portalCenter.x;
            portalY = portalCenter.y;
            protectedRadiusSq = portalRef.safetyRadius * portalRef.safetyRadius;
            applyPortalProtection = true;
        }
    }
    while (queue.length > 0) {
        const { c, r } = queue.shift();
        if (applyPortalProtection) {
            const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
            const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
            const dx = blockCenterX - portalX;
            const dy = blockCenterY - portalY;
            const distSqToPortal = dx * dx + dy * dy;
            if (distSqToPortal < protectedRadiusSq) {
                continue;
            }
        }
        const blockData = World.getBlock(c, r);
        const blockType = (typeof blockData === 'object' && blockData !== null) ? blockData.type : blockData;
        if (blockType !== Config.BLOCK_AIR && blockType !== Config.BLOCK_WATER && blockData !== null) {
            chunk.push({ c, r, blockData });
        } else {
            continue;
        }
        const neighbors = [
            { dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
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
                    let canAddToQueue = true;
                    if (applyPortalProtection) {
                        const nBlockCenterX = nc * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                        const nBlockCenterY = nr * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                        const nDx = nBlockCenterX - portalX;
                        const nDy = nBlockCenterY - portalY;
                        if ((nDx * nDx + nDy * nDy) < protectedRadiusSq) {
                            canAddToQueue = false;
                        }
                    }
                    if (canAddToQueue) {
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
    let allMovedBlocksInSettlement = [];
    let iterations = 0;
    const MAX_ITERATIONS = Config.MAX_GRAVITY_SETTLEMENT_PASSES || Config.GRID_ROWS;
    let blocksMovedThisIteration = true;
    while (blocksMovedThisIteration && iterations < MAX_ITERATIONS) {
        iterations++;
        blocksMovedThisIteration = false;
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
                            isSupported = true; break;
                        }
                        const blockBelowData = World.getBlock(cb_c, cb_r + 1);
                        const blockBelowType = (typeof blockBelowData === 'object' && blockBelowData !== null) ? blockBelowData.type : blockBelowData;
                        if (blockBelowType !== Config.BLOCK_AIR && blockBelowType !== Config.BLOCK_WATER && blockBelowData !== null) {
                            const isSupportInternal = chunk.some(b => b.c === cb_c && b.r === cb_r + 1);
                            if (!isSupportInternal) {
                                isSupported = true; break;
                            }
                        }
                    }
                    if (isSupported) continue;
                    let minFallDistance = Config.GRID_ROWS;
                    for (const chunkBlock of chunk) {
                        let currentFall = 0;
                        for (let fall_r = chunkBlock.r + 1; fall_r < Config.GRID_ROWS; fall_r++) {
                            const blockAtFallTargetData = World.getBlock(chunkBlock.c, fall_r);
                            const typeAtFallTarget = (typeof blockAtFallTargetData === 'object' && blockAtFallTargetData !== null) ? blockAtFallTargetData.type : blockAtFallTargetData;
                            const isTargetBelowPartOfChunk = chunk.some(b => b.c === chunkBlock.c && b.r === fall_r);
                            if (isTargetBelowPartOfChunk) {
                                currentFall++;
                            } else if (typeAtFallTarget !== Config.BLOCK_AIR && typeAtFallTarget !== Config.BLOCK_WATER && blockAtFallTargetData !== null) {
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
                                c: chunkBlock.c, r_start: chunkBlock.r, r_end: chunkBlock.r + minFallDistance, blockData: chunkBlock.blockData
                            });
                            World.setBlockData(chunkBlock.c, chunkBlock.r, createBlock(Config.BLOCK_AIR, false));
                        }
                        for (const chunkBlock of chunk) {
                            const newR = chunkBlock.r + minFallDistance;
                            World.setBlockData(chunkBlock.c, newR, chunkBlock.blockData);
                        }
                        allMovedBlocksInSettlement.push(...currentChunkMoves);
                    }
                }
            }
        }
        if (!blocksMovedThisIteration) break;
    }
    return allMovedBlocksInSettlement;
}

function applyInitialFloodFill() {
    const queue = [];
    const visited = new Set();
    for (let r = Config.WATER_LEVEL; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (World.getBlockType(c, r) === Config.BLOCK_AIR) {
                const neighbors = [{dc:0,dr:-1},{dc:0,dr:1},{dc:-1,dr:0},{dc:1,dr:0}];
                let isSeed = false;
                for(const n_off of neighbors) {
                    const nc = c + n_off.dc;
                    const nr = r + n_off.dr;
                    if (nr < Config.WATER_LEVEL || World.getBlockType(nc,nr) !== Config.BLOCK_AIR) {
                        isSeed = true; break;
                    }
                }
                if(isSeed || r === Config.GRID_ROWS -1) {
                     const key = `${c},${r}`;
                     if (!visited.has(key)) {
                        queue.push({ c, r });
                        visited.add(key);
                     }
                }
            }
        }
    }
    let processed = 0;
    while (queue.length > 0) {
        const { c, r } = queue.shift();
        if (r < Config.WATER_LEVEL || World.getBlockType(c, r) !== Config.BLOCK_AIR) continue;
        World.setBlock(c, r, Config.BLOCK_WATER, false);
        processed++;
        const neighbors = [{dc:0,dr:-1},{dc:0,dr:1},{dc:-1,dr:0},{dc:1,dr:0}];
        for(const n_off of neighbors) {
            const nc = c + n_off.dc;
            const nr = r + n_off.dr;
             const nKey = `${nc},${nr}`;
            if (nr >= Config.WATER_LEVEL && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS &&
                World.getBlockType(nc,nr) === Config.BLOCK_AIR && !visited.has(nKey)) {
                visited.add(nKey);
                queue.push({ c: nc, r: nr });
            }
        }
    }
}

// --- MODIFIED: applyLightingPass ---
// This function will now identify blocks that *should* change their lit state
// and return them as proposed changes, rather than directly modifying the grid.
export function applyLightingPass() {
    // console.log("[WorldManager] Calculating proposed lighting changes...");
    let proposedChanges = [];
    const blocksToAnimateThisPass = new Set(); // To avoid duplicate animation proposals in one pass

    const grid = World.getGrid();
    if (!grid || grid.length === 0) {
        console.error("[WorldManager] applyLightingPass: World grid not available for calculation.");
        return proposedChanges; // Return empty array
    }

    // 1. Raycasting logic (remains largely the same, but collects changes)
    const sunCenterPixelY = (SUN_MOVEMENT_Y_ROW_OFFSET * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);
    const sunStartPixelX = Config.CANVAS_WIDTH + (Config.BLOCK_WIDTH * 10);
    const sunEndPixelX = -(Config.BLOCK_WIDTH * 10);
    const sunStepPixelX = SUN_MOVEMENT_STEP_COLUMNS * Config.BLOCK_WIDTH;

    for (let currentSunPixelX = sunStartPixelX; currentSunPixelX >= sunEndPixelX; currentSunPixelX -= sunStepPixelX) {
        const sunGridCol = Math.floor(currentSunPixelX / Config.BLOCK_WIDTH);
        const sunGridRow = Math.floor(sunCenterPixelY / Config.BLOCK_HEIGHT);

        for (let i = 0; i < SUN_RAYS_PER_POSITION; i++) {
            const angle = (i / SUN_RAYS_PER_POSITION) * 2 * Math.PI;
            let rayCurrentGridCol = sunGridCol;
            let rayCurrentGridRow = sunGridRow;
            const rayEndGridCol = Math.floor(sunGridCol + Math.cos(angle) * MAX_LIGHT_RAY_LENGTH_BLOCKS);
            const rayEndGridRow = Math.floor(sunGridRow + Math.sin(angle) * MAX_LIGHT_RAY_LENGTH_BLOCKS);

            let dx = Math.abs(rayEndGridCol - rayCurrentGridCol);
            let dy = Math.abs(rayEndGridRow - rayCurrentGridRow);
            let sx = (rayCurrentGridCol < rayEndGridCol) ? 1 : -1;
            let sy = (rayCurrentGridRow < rayEndGridRow) ? 1 : -1;
            let err = dx - dy;
            let currentRayBlockLength = 0;

            while (currentRayBlockLength < MAX_LIGHT_RAY_LENGTH_BLOCKS) {
                if (rayCurrentGridCol >= 0 && rayCurrentGridCol < Config.GRID_COLS &&
                    rayCurrentGridRow >= 0 && rayCurrentGridRow < Config.GRID_ROWS) {
                    
                    const block = World.getBlock(rayCurrentGridCol, rayCurrentGridRow); // Use World.getBlock
                    const blockType = (typeof block === 'object' && block !== null) ? block.type : block;

                    if (blockType !== Config.BLOCK_AIR && blockType !== Config.BLOCK_WATER && block !== null) {
                        if (typeof block === 'object' && !block.isLit) { // Check if it's not already lit
                            const changeKey = `${rayCurrentGridCol},${rayCurrentGridRow}`;
                            if (!blocksToAnimateThisPass.has(changeKey)) {
                                proposedChanges.push({ c: rayCurrentGridCol, r: rayCurrentGridRow, newLitState: true });
                                blocksToAnimateThisPass.add(changeKey);
                            }
                        }
                        break; 
                    }
                } else if (rayCurrentGridRow >= Config.GRID_ROWS) {
                    break;
                }

                if (rayCurrentGridCol === rayEndGridCol && rayCurrentGridRow === rayEndGridRow) {
                    break;
                }
                let e2 = 2 * err;
                if (e2 > -dy) { err -= dy; rayCurrentGridCol += sx; }
                if (e2 < dx) { err += dx; rayCurrentGridRow += sy; }
                currentRayBlockLength++;
            }
        }
    }
    // console.log(`[WorldManager] Lighting pass calculation complete. Proposed ${proposedChanges.length} lighting changes.`);
    return proposedChanges;
}


// -----------------------------------------------------------------------------
// --- Initialization ---
// -----------------------------------------------------------------------------
 
export function executeInitialWorldGenerationSequence() {
    console.log("[WorldManager] Executing initial world data generation sequence...");
    generateWorldFromGenerator(); 
    applyGravitySettlement(null); 
    applyInitialFloodFill();
    
    // --- MODIFIED for initial lighting ---
    World.resetAllBlockLighting(); // Reset before calculation
    const initialProposedLighting = applyLightingPass(); // Get proposed changes
    initialProposedLighting.forEach(change => { // Directly apply for initial setup
        const block = World.getBlock(change.c, change.r);
        if (block && typeof block === 'object') {
            block.isLit = change.newLitState;
        }
    });
    console.log(`[WorldManager] Initial lighting calculated and applied directly: ${initialProposedLighting.length} blocks lit.`);
    // --- END MODIFICATION ---

    // Initialize animation queues
    agingAnimationQueue = [];
    activeAgingAnimations = [];
    newAnimationStartTimer = 0;
    gravityAnimationQueue = [];
    activeGravityAnimations = [];
    newGravityAnimationStartTimer = 0;
    // NEW: Initialize lighting animation queues
    lightingAnimationQueue = [];
    activeLightingAnimations = [];
    newLightingAnimationStartTimer = 0;

    console.log("[WorldManager] Initial world data generation sequence complete.");
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
            if (blockType === Config.BLOCK_WATER || blockType === Config.BLOCK_AIR) {
                addWaterUpdateCandidate(c, r);
            }
            if (blockType === Config.BLOCK_WATER || (GridCollision.isSolid(c, r) && r >= Config.WATER_LEVEL - 2)) {
                 queueWaterCandidatesAroundChange(c,r);
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
    const success = World.setBlock(col, row, blockType, true);
    if (success) {
        updateStaticWorldAt(col, row);
        queueWaterCandidatesAroundChange(col, row);
    } 
    return success;
}

export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false;
    const block = World.getBlock(col, row);
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false;
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
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
            case Config.BLOCK_VEGETATION: dropType = 'vegetation'; break;
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
            }
        }
        const success = World.setBlock(col, row, Config.BLOCK_AIR, false);
        if (success) {
            updateStaticWorldAt(col, row);
            queueWaterCandidatesAroundChange(col, row);
        }
    }
    return true;
}

// -----------------------------------------------------------------------------
// --- Aging Animation ---
// -----------------------------------------------------------------------------

export function addProposedAgingChanges(changes) {
    changes.forEach(change => agingAnimationQueue.push(change));
}

function updateAgingAnimations(dt) {
    if (dt <= 0) return;
    newAnimationStartTimer -= dt;
    if (newAnimationStartTimer <= 0 && agingAnimationQueue.length > 0 && activeAgingAnimations.length < Config.AGING_ANIMATION_BLOCKS_AT_ONCE) {
        const change = agingAnimationQueue.shift();
        const existingAnimIndex = activeAgingAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);
        if (existingAnimIndex !== -1) {
            // console.warn(`[WorldManager] Trying to start new animation for [${change.c},${change.r}] while one is active. Skipping.`);
        } else {
            activeAgingAnimations.push({
                c: change.c, r: change.r, oldBlockType: change.oldBlockType, newBlockType: change.newBlockType,
                timer: Config.AGING_ANIMATION_SWELL_DURATION, phase: 'swell', currentScale: 1.0,
            });
            newAnimationStartTimer = Config.AGING_ANIMATION_NEW_BLOCK_DELAY;
            const gridCtx = Renderer.getGridContext();
            if (gridCtx) {
                gridCtx.clearRect(
                    Math.floor(change.c * Config.BLOCK_WIDTH), Math.floor(change.r * Config.BLOCK_HEIGHT),
                    Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT)
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
            anim.currentScale = 1.0 + (Config.AGING_ANIMATION_SWELL_SCALE - 1.0) * progress;
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
}

// --- NEW: Lighting Animation Functions ---
export function addProposedLightingChanges(changes) {
    changes.forEach(change => {
        const existingQueueIndex = lightingAnimationQueue.findIndex(q => q.c === change.c && q.r === change.r);
        const existingActiveIndex = activeLightingAnimations.findIndex(a => a.c === change.c && a.r === change.r);
        if (existingQueueIndex === -1 && existingActiveIndex === -1) {
            lightingAnimationQueue.push(change);
        }
    });
}

function updateLightingAnimations(dt) {
    if (dt <= 0) return;

    newLightingAnimationStartTimer -= dt;
    if (newLightingAnimationStartTimer <= 0 && lightingAnimationQueue.length > 0 && activeLightingAnimations.length < Config.LIGHTING_ANIMATION_BLOCKS_AT_ONCE) {
        const change = lightingAnimationQueue.shift();
        
        const blockBeingAnimated = World.getBlock(change.c, change.r);
        if (blockBeingAnimated && typeof blockBeingAnimated === 'object' && blockBeingAnimated.isLit) {
            // Already lit, skip animation for this one
        } else {
            activeLightingAnimations.push({
                c: change.c,
                r: change.r,
                newLitState: change.newLitState,
                timer: Config.LIGHTING_ANIMATION_DURATION,
            });
            newLightingAnimationStartTimer = Config.LIGHTING_ANIMATION_NEW_BLOCK_DELAY;

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

    for (let i = activeLightingAnimations.length - 1; i >= 0; i--) {
        const anim = activeLightingAnimations[i];
        anim.timer -= dt;

        if (anim.timer <= 0) {
            const block = World.getBlock(anim.c, anim.r);
            if (block && typeof block === 'object') {
                block.isLit = anim.newLitState; 
            }
            updateStaticWorldAt(anim.c, anim.r); 
            queueWaterCandidatesAroundChange(anim.c, anim.r); 
            activeLightingAnimations.splice(i, 1);
        }
    }
}

function drawLightingAnimations(ctx) {
    activeLightingAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        const blockPixelY = anim.r * Config.BLOCK_HEIGHT;
        const blockWidth = Config.BLOCK_WIDTH;
        const blockHeight = Config.BLOCK_HEIGHT;

        const progress = 1.0 - (anim.timer / Config.LIGHTING_ANIMATION_DURATION); 
        const alpha = Math.sin(progress * Math.PI) * Config.LIGHTING_ANIMATION_MAX_ALPHA; 

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = Config.LIGHTING_ANIMATION_COLOR;
        ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
        ctx.restore();
    });
}

export function areLightingAnimationsComplete() {
    return lightingAnimationQueue.length === 0 && activeLightingAnimations.length === 0;
}

export function finalizeAllLightingAnimations() {
    while (lightingAnimationQueue.length > 0) {
        const change = lightingAnimationQueue.shift();
        const block = World.getBlock(change.c, change.r);
        if (block && typeof block === 'object') {
            block.isLit = change.newLitState;
        }
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    while (activeLightingAnimations.length > 0) {
        const anim = activeLightingAnimations.shift();
        const block = World.getBlock(anim.c, anim.r);
        if (block && typeof block === 'object') {
            block.isLit = anim.newLitState;
        }
        updateStaticWorldAt(anim.c, anim.r);
        queueWaterCandidatesAroundChange(anim.c, anim.r);
    }
}

// -----------------------------------------------------------------------------
// --- Rendering ---
// -----------------------------------------------------------------------------

export function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        return;
    }
    const block = World.getBlock(col, row);
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
        const currentBlockType = typeof block === 'object' && block !== null ? block.type : block;
        if (currentBlockType === Config.BLOCK_AIR) return;

        let baseColor = Config.BLOCK_COLORS[currentBlockType];
        let finalColor = baseColor;

        if (typeof block === 'object' && block !== null && block.isLit && baseColor) {
            try {
                if (baseColor.startsWith('rgb(')) {
                    const parts = baseColor.substring(4, baseColor.length - 1).split(',').map(s => parseInt(s.trim(), 10));
                    const r = Math.min(255, Math.floor(parts[0] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    const g = Math.min(255, Math.floor(parts[1] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    const b = Math.min(255, Math.floor(parts[2] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    finalColor = `rgb(${r}, ${g}, ${b})`;
                }
            } catch (e) {
                finalColor = baseColor; 
            }
        }
        
        if (currentBlockType === Config.BLOCK_ROPE) {
            gridCtx.fillStyle = finalColor || Config.BLOCK_COLORS[Config.BLOCK_ROPE]; 
            const ropeWidth = Math.max(1, Math.floor(blockW * 0.2)); 
            const ropeX = Math.floor(blockX + (blockW - ropeWidth) / 2);
            gridCtx.fillRect(ropeX, Math.floor(blockY), ropeWidth, blockH);
            const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlaced) {
                gridCtx.save();
                gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR; 
                gridCtx.lineWidth = 1; 
                gridCtx.strokeRect(
                    ropeX, Math.floor(blockY),
                    ropeWidth, blockH
                );
                gridCtx.restore();
            }
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                gridCtx.save();
                gridCtx.globalAlpha = 0.5 + 0.5 * (block.hp / block.maxHp);
                gridCtx.fillStyle = finalColor || Config.BLOCK_COLORS[Config.BLOCK_ROPE]; 
                gridCtx.fillRect(ropeX, Math.floor(blockY), ropeWidth, blockH);
                gridCtx.restore();
            }

        } else { 
            if (finalColor) {
                gridCtx.fillStyle = finalColor;
                gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
                const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
                if (isPlayerPlaced) {
                    gridCtx.save();
                    gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                    gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
                    const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
                    gridCtx.strokeRect(
                        Math.floor(blockX) + outlineInset, Math.floor(blockY) + outlineInset,
                        blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS, blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
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
            }
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
    const worldGrid = World.getGrid();
    if (!worldGrid || !Array.isArray(worldGrid)) {
        console.error("WorldManager: Cannot render, worldGrid is invalid.");
        return;
    }
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (!Array.isArray(worldGrid[r])) {
            continue;
        }
        for (let c = 0; c < Config.GRID_COLS; c++) {
            updateStaticWorldAt(c, r);
        }
    }
    console.log("WorldManager: Static world render complete.");
}

export function draw(ctx) {
    if (!ctx) {
        return;
    }
    const gridCanvasToDraw = Renderer.getGridCanvas(); 
    if (gridCanvasToDraw) { 
        ctx.drawImage(gridCanvasToDraw, 0, 0);
    }
    
    drawGravityAnimations(ctx);
    drawAgingAnimations(ctx);
    drawLightingAnimations(ctx); // NEW: Draw lighting animations
}

// -----------------------------------------------------------------------------
// --- Update Cycle ---
// -----------------------------------------------------------------------------

export function update(dt) {
    waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
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
            const currentBlockType = World.getBlockType(c, r);
            if (currentBlockType === Config.BLOCK_AIR) {
                if (r >= Config.WATER_LEVEL) {
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
                            queueWaterCandidatesAroundChange(c, r);
                        }
                    }
                }
            } else if (currentBlockType === Config.BLOCK_WATER) {
                const blockBelowType = World.getBlockType(c, r + 1);
                if (blockBelowType === Config.BLOCK_AIR) {
                    addWaterUpdateCandidate(c, r + 1);
                } else {
                     const blockBelow = World.getBlock(c, r + 1);
                     const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR;
                     const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR);
                    if (isBelowSolidOrWater) {
                        let spreadOccurred = false;
                        if (World.getBlockType(c - 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                            addWaterUpdateCandidate(c - 1, r);
                            spreadOccurred = true;
                        }
                        if (World.getBlockType(c + 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                            addWaterUpdateCandidate(c + 1, r);
                            spreadOccurred = true;
                        }
                        if(spreadOccurred) {
                            addWaterUpdateCandidate(c,r);
                        }
                    }
                }
            }
        });
    }
    updateGravityAnimations(dt);
    updateAgingAnimations(dt);
    updateLightingAnimations(dt); // NEW: Update lighting animations
}