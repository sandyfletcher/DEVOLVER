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
import * as WaveManager from './waveManager.js';

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

// Constants for lighting pass (re-used for visual sun rays)
const SUN_MOVEMENT_Y_ROW_OFFSET = -3; // This is now in config.js, but kept here for direct use if not referencing Config for it.

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

export function applyLightingPass(DEBUG_DRAW_LIGHTING = false) {
    // console.log("[WorldManager] Calculating proposed lighting changes...");
    let proposedChanges = [];
    const blocksToAnimateThisPass = new Set(); // Prevents duplicate animation queueing for the same block

    const grid = World.getGrid();
    if (!grid || grid.length === 0) {
        console.error("[WorldManager] applyLightingPass: World grid not available for calculation.");
        return proposedChanges;
    }

    // --- DEBUG DRAWING SETUP ---
    let mainCtxForDebug;
    if (DEBUG_DRAW_LIGHTING) {
        mainCtxForDebug = Renderer.getContext();
        if (!mainCtxForDebug) {
            console.error("Debug Lighting: Main context not available!");
            DEBUG_DRAW_LIGHTING = false;
        }
    }
    // --- END DEBUG DRAWING SETUP ---

    const sunCenterPixelY = (Config.SUN_MOVEMENT_Y_ROW_OFFSET * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2); // Use Config value
    const sunStartPixelX = Config.CANVAS_WIDTH + (Config.BLOCK_WIDTH * 10);
    const sunEndPixelX = -(Config.BLOCK_WIDTH * 10);
    const sunStepPixelX = Config.SUN_MOVEMENT_STEP_COLUMNS * Config.BLOCK_WIDTH;

    for (let currentSunPixelX = sunStartPixelX; currentSunPixelX >= sunEndPixelX; currentSunPixelX -= sunStepPixelX) {
        const sunGridCol = Math.floor(currentSunPixelX / Config.BLOCK_WIDTH);
        const sunGridRow = Math.floor(sunCenterPixelY / Config.BLOCK_HEIGHT);

        if (DEBUG_DRAW_LIGHTING && mainCtxForDebug) {
            mainCtxForDebug.save();
            Renderer.applyCameraTransforms(mainCtxForDebug);
            mainCtxForDebug.fillStyle = "yellow";
            mainCtxForDebug.beginPath();
            mainCtxForDebug.arc(currentSunPixelX, sunCenterPixelY, Config.BLOCK_WIDTH * 2, 0, Math.PI * 2);
            mainCtxForDebug.fill();
            mainCtxForDebug.strokeStyle = "orange";
            mainCtxForDebug.lineWidth = 2;
            mainCtxForDebug.stroke();
            Renderer.restoreCameraTransforms(mainCtxForDebug);
            mainCtxForDebug.restore();
        }

       const numDownwardRays = Math.ceil(Config.SUN_RAYS_PER_POSITION / 2);
       if (numDownwardRays <= 0) {
           continue;
       }

       for (let i = 0; i < numDownwardRays; i++) {
           let angle;
           if (numDownwardRays === 1) {
               angle = Math.PI / 2;
           } else {
               angle = (i / (numDownwardRays - 1)) * Math.PI;
           }

            let rayCurrentGridCol = sunGridCol;
            let rayCurrentGridRow = sunGridRow;
            const rayEndGridCol = Math.floor(sunGridCol + Math.cos(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);
            const rayEndGridRow = Math.floor(sunGridRow + Math.sin(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);

            let rayPixelStartX = currentSunPixelX;
            let rayPixelStartY = sunCenterPixelY;
            let rayPixelEndX = rayPixelStartX;
            let rayPixelEndY = rayPixelStartY;

            let dx = Math.abs(rayEndGridCol - rayCurrentGridCol);
            let dy = Math.abs(rayEndGridRow - rayCurrentGridRow);
            let sx = (rayCurrentGridCol < rayEndGridCol) ? 1 : -1;
            let sy = (rayCurrentGridRow < rayEndGridRow) ? 1 : -1;
            let err = dx - dy;
            let currentRayBlockLength = 0;

            while (currentRayBlockLength < Config.MAX_LIGHT_RAY_LENGTH_BLOCKS) {
                rayPixelEndX = (rayCurrentGridCol * Config.BLOCK_WIDTH) + (Config.BLOCK_WIDTH / 2);
                rayPixelEndY = (rayCurrentGridRow * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);

                if (rayCurrentGridCol >= 0 && rayCurrentGridCol < Config.GRID_COLS &&
                    rayCurrentGridRow >= 0 && rayCurrentGridRow < Config.GRID_ROWS) {

                    const block = World.getBlock(rayCurrentGridCol, rayCurrentGridRow); // Get full block data

                    if (block === Config.BLOCK_AIR) {
                        // Ray passes through air freely
                    } else if (typeof block === 'object' && block !== null) {
                        // It's a block object (not air). It can be lit.
                        if (!block.isLit) { // Check if block object is already lit
                            const changeKey = `${rayCurrentGridCol},${rayCurrentGridRow}`;
                            if (!blocksToAnimateThisPass.has(changeKey)) {
                                proposedChanges.push({ c: rayCurrentGridCol, r: rayCurrentGridRow, newLitState: true });
                                blocksToAnimateThisPass.add(changeKey);
                            }
                        }
                        // Check its translucency
                        if (block.translucency === 0.0) { // 0.0 means opaque
                            break; // Ray stops
                        }
                        // If translucency > 0.0, the ray continues through this block
                    } else {
                        // This case handles block === null (out of bounds)
                        // or any other unexpected block data. Treat as opaque.
                        break; // Ray stops
                    }
                } else if (rayCurrentGridRow >= Config.GRID_ROWS) { // Ray went below world
                    break;
                } else if (rayCurrentGridCol < 0 || rayCurrentGridCol >= Config.GRID_COLS) { // Ray went sideways out of world
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

            if (DEBUG_DRAW_LIGHTING && mainCtxForDebug) {
                mainCtxForDebug.save();
                Renderer.applyCameraTransforms(mainCtxForDebug);
                mainCtxForDebug.strokeStyle = "rgba(255, 255, 0, 0.3)";
                mainCtxForDebug.lineWidth = 1;
                mainCtxForDebug.beginPath();
                mainCtxForDebug.moveTo(rayPixelStartX, rayPixelStartY);
                mainCtxForDebug.lineTo(rayPixelEndX, rayPixelEndY);
                mainCtxForDebug.stroke();
                Renderer.restoreCameraTransforms(mainCtxForDebug);
                mainCtxForDebug.restore();
            }
        }
    }
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

    World.resetAllBlockLighting();
    const initialProposedLighting = applyLightingPass(false); // false = no debug drawing

    // Apply initial lighting directly to the world data
    initialProposedLighting.forEach(change => {
        const block = World.getBlock(change.c, change.r);
        if (block && typeof block === 'object') {
            block.isLit = change.newLitState;
        }
    });
    console.log(`[WorldManager] Initial lighting calculated and applied directly: ${initialProposedLighting.length} blocks lit.`);

    agingAnimationQueue = [];
    activeAgingAnimations = [];
    newAnimationStartTimer = 0;
    gravityAnimationQueue = [];
    activeGravityAnimations = [];
    newGravityAnimationStartTimer = 0;
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
                (blockType === Config.BLOCK_AIR && row >= Config.WATER_LEVEL))) { // Only add AIR blocks at/below water level as candidates
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
    // Diagonal checks might be useful for smoother water spread, but more computationally expensive.
    // candidateAdded = addWaterUpdateCandidate(c - 1, r - 1) || candidateAdded;
    // candidateAdded = addWaterUpdateCandidate(c + 1, r - 1) || candidateAdded;
    // candidateAdded = addWaterUpdateCandidate(c - 1, r + 1) || candidateAdded;
    // candidateAdded = addWaterUpdateCandidate(c + 1, r + 1) || candidateAdded;

    if (candidateAdded) {
        resetWaterPropagationTimer();
    }
}

export function seedWaterUpdateQueue() {
    console.log("WorldManager: Seeding water update queue...");
    waterUpdateQueue.clear(); // Clear any existing candidates
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = World.getBlockType(c, r);
            if (blockType === Config.BLOCK_WATER || blockType === Config.BLOCK_AIR) {
                addWaterUpdateCandidate(c, r);
            }
            // Also check neighbors of water and solid blocks near water level to kickstart flow
            if (blockType === Config.BLOCK_WATER || (GridCollision.isSolid(c, r) && r >= Config.WATER_LEVEL - 2)) {
                 queueWaterCandidatesAroundChange(c,r);
            }
        }
    }
    console.log(`WorldManager: Seeded Water Update Queue with ${waterUpdateQueue.size} candidates.`);
    waterPropagationTimer = 0; // Ensure water can propagate immediately if needed
}


// -----------------------------------------------------------------------------
// --- Block Interaction ---
// -----------------------------------------------------------------------------

export function placePlayerBlock(col, row, blockType) {
    const success = World.setBlock(col, row, blockType, true);
    if (success) {
        updateStaticWorldAt(col, row);
        queueWaterCandidatesAroundChange(col, row); // Re-evaluate water flow around the new block
    }
    return success;
}

export function damageBlock(col, row, damageAmount) {
    if (damageAmount <= 0) return false; // No damage to apply

    const block = World.getBlock(col, row); // Get the block data

    // Check if the block is valid and damageable
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.maxHp <= 0 || block.hp <= 0 || block.hp === Infinity) {
        return false; // Not damageable (air, water, already destroyed, or indestructible)
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) { // Sanity check for HP
        // console.warn(`Block at [${col}, ${row}] has invalid HP. Resetting to maxHp.`, block);
        block.hp = block.maxHp; // Reset HP if invalid
        return false; // Don't apply damage this frame if HP was invalid
    }

    block.hp -= damageAmount;
    updateStaticWorldAt(col, row); // Update visual on grid canvas for damage indicator

    let wasDestroyed = false;
    if (block.hp <= 0) {
        wasDestroyed = true;
        block.hp = 0; // Ensure HP doesn't go negative

        // --- Determine Item Drop ---
        let dropType = null;
        switch (block.type) {
            case Config.BLOCK_VEGETATION: dropType = 'vegetation'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break; // Assumes both player and natural wood drop 'wood'
            case Config.BLOCK_BONE: dropType = 'bone'; break;
            case Config.BLOCK_METAL: dropType = 'metal'; break;
            // Ropes typically don't drop items, or might drop 'vegetation' if desired
            // case Config.BLOCK_ROPE: dropType = 'vegetation'; break;
        }

        if (dropType) {
            const dropXBase = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2);
            const dropYBase = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // Scatter within 40% of block width
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4; // Scatter within 40% of block height
            const finalDropX = dropXBase + offsetX;
            const finalDropY = dropYBase + offsetY;

            if (!isNaN(finalDropX) && !isNaN(finalDropY)) { // Ensure coordinates are valid numbers
                 ItemManager.spawnItem(finalDropX, finalDropY, dropType);
            }
        }

        // Set block to AIR
        const success = World.setBlock(col, row, Config.BLOCK_AIR, false); // Destroyed blocks become non-player-placed air
        if (success) {
            updateStaticWorldAt(col, row); // Update visual for the new air block
            queueWaterCandidatesAroundChange(col, row); // Re-evaluate water
        }
    }
    return true; // Damage was applied (even if not destroyed)
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

        // Check if an animation for this block is already active
        const existingAnimIndex = activeAgingAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);
        if (existingAnimIndex !== -1) {
            // console.warn(`[WorldManager] Trying to start new animation for [${change.c},${change.r}] while one is active. Skipping.`);
        } else {
            activeAgingAnimations.push({
                c: change.c, r: change.r, oldBlockType: change.oldBlockType, newBlockType: change.newBlockType,
                timer: Config.AGING_ANIMATION_SWELL_DURATION, phase: 'swell', currentScale: 1.0,
            });
            newAnimationStartTimer = Config.AGING_ANIMATION_NEW_BLOCK_DELAY;

            // Clear the static grid canvas cell for this animating block
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
                anim.currentScale = 1.0; // Reset scale for pop phase (or use a different scale if desired)
            }
        } else if (anim.phase === 'pop') {
            if (anim.timer <= 0) {
                // Animation finished, update the static world representation
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
            if (oldColor && anim.oldBlockType !== Config.BLOCK_AIR) { // Only draw if it's not air
                ctx.fillStyle = Config.AGING_ANIMATION_OLD_BLOCK_COLOR; // Use a generic animation color
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        } else if (anim.phase === 'pop') {
            const newColor = Config.BLOCK_COLORS[anim.newBlockType];
            if (newColor && anim.newBlockType !== Config.BLOCK_AIR) { // Only draw if it's not air
                // Calculate alpha for a brief flash effect during pop
                const popProgress = Math.max(0, 1.0 - (anim.timer / Config.AGING_ANIMATION_POP_DURATION));
                const alpha = 0.6 + 0.4 * Math.sin(popProgress * Math.PI); // Simple sine wave for flash
                ctx.globalAlpha = alpha;
                ctx.fillStyle = Config.AGING_ANIMATION_NEW_BLOCK_COLOR; // Use a generic animation color
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
    // Process any remaining queued changes
    while(agingAnimationQueue.length > 0) {
        const change = agingAnimationQueue.shift();
        // World.setBlock has already been called for these changes by AgingManager
        // We just need to update the static grid canvas.
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    // Process any active animations
    while(activeAgingAnimations.length > 0) {
        const anim = activeAgingAnimations.shift();
        updateStaticWorldAt(anim.c, anim.r);
        queueWaterCandidatesAroundChange(anim.c, anim.r);
    }
}

// --- NEW: Lighting Animation Functions ---
export function addProposedLightingChanges(changes) {
    changes.forEach(change => {
        // Avoid queueing an animation if one is already queued or active for this block
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

        // Check if the block is *already* lit in the world data. If so, skip animating it again.
        const blockBeingAnimated = World.getBlock(change.c, change.r);
        if (blockBeingAnimated && typeof blockBeingAnimated === 'object' && blockBeingAnimated.isLit) {
            // Already lit, skip animation for this one
        } else {
            activeLightingAnimations.push({
                c: change.c,
                r: change.r,
                newLitState: change.newLitState, // Store the intended final state
                timer: Config.LIGHTING_ANIMATION_DURATION,
            });
            newLightingAnimationStartTimer = Config.LIGHTING_ANIMATION_NEW_BLOCK_DELAY;

            // Clear the static grid cell for this animating block
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
            // Animation finished, apply the lighting state to the world data
            const block = World.getBlock(anim.c, anim.r);
            if (block && typeof block === 'object') {
                block.isLit = anim.newLitState; // Set final lit state
            }
            updateStaticWorldAt(anim.c, anim.r); // Redraw on static canvas with final lit state
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

        // Animate alpha for a flash effect
        const progress = 1.0 - (anim.timer / Config.LIGHTING_ANIMATION_DURATION); // 0 (start) to 1 (end)
        const alpha = Math.sin(progress * Math.PI) * Config.LIGHTING_ANIMATION_MAX_ALPHA; // Sine wave for smooth flash

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)); // Clamp alpha
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

// --- NEW: Function to draw the animated sun and its rays (visual only) ---
function drawAnimatedSunEffect(ctx, sunWorldX, sunWorldY) {
    if (!ctx || !Config.SUN_ANIMATION_ENABLED) return;

    // 1. Draw the Sun
    const sunRadius = Config.SUN_ANIMATION_RADIUS_BLOCKS * Config.BLOCK_WIDTH;

    // Draw blurred outline/glow first
    ctx.save();
    ctx.shadowColor = Config.SUN_ANIMATION_OUTLINE_COLOR;
    ctx.shadowBlur = Config.SUN_ANIMATION_OUTLINE_BLUR;
    ctx.strokeStyle = Config.SUN_ANIMATION_OUTLINE_COLOR;
    ctx.lineWidth = Config.SUN_ANIMATION_OUTLINE_WIDTH;
    ctx.beginPath();
    ctx.arc(sunWorldX, sunWorldY, sunRadius, 0, Math.PI * 2);
    ctx.stroke(); // Draw the blurred stroke
    ctx.restore(); // Restore to remove shadow effect for fill

    // Draw the main sun fill
    ctx.fillStyle = Config.SUN_ANIMATION_COLOR;
    ctx.beginPath();
    ctx.arc(sunWorldX, sunWorldY, sunRadius, 0, Math.PI * 2);
    ctx.fill();


    // 2. Cast and Draw Rays (similar to applyLightingPass ray logic, but for drawing only)
    const sunGridCol = Math.floor(sunWorldX / Config.BLOCK_WIDTH);
    const sunGridRow = Math.floor(sunWorldY / Config.BLOCK_HEIGHT);

    // Outer ray (thicker, more transparent)
    const outerRayWidth = Config.SUN_ANIMATION_RAY_LINE_WIDTH * Config.SUN_ANIMATION_RAY_OUTER_WIDTH_FACTOR;

    for (let i = 0; i < Config.SUN_RAYS_PER_POSITION; i++) {
        const angle = (i / Config.SUN_RAYS_PER_POSITION) * 2 * Math.PI;

        let rayCurrentGridCol = sunGridCol;
        let rayCurrentGridRow = sunGridRow;

        // Use MAX_LIGHT_RAY_LENGTH_BLOCKS from Config for ray length consistency
        const rayEndGridColTarget = Math.floor(sunGridCol + Math.cos(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);
        const rayEndGridRowTarget = Math.floor(sunGridRow + Math.sin(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);

        let rayPixelEndX = sunWorldX;
        let rayPixelEndY = sunWorldY;

        let dx_ray = Math.abs(rayEndGridColTarget - rayCurrentGridCol);
        let dy_ray = Math.abs(rayEndGridRowTarget - rayCurrentGridRow);
        let sx_ray = (rayCurrentGridCol < rayEndGridColTarget) ? 1 : -1;
        let sy_ray = (rayCurrentGridRow < rayEndGridRowTarget) ? 1 : -1;
        let err_ray = dx_ray - dy_ray;
        let currentRayBlockLength = 0;

        while (currentRayBlockLength < Config.MAX_LIGHT_RAY_LENGTH_BLOCKS) {
            rayPixelEndX = (rayCurrentGridCol * Config.BLOCK_WIDTH) + (Config.BLOCK_WIDTH / 2);
            rayPixelEndY = (rayCurrentGridRow * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);

            if (rayCurrentGridCol >= 0 && rayCurrentGridCol < Config.GRID_COLS &&
                rayCurrentGridRow >= 0 && rayCurrentGridRow < Config.GRID_ROWS) {

                const block = World.getBlock(rayCurrentGridCol, rayCurrentGridRow);
                if (block !== Config.BLOCK_AIR && typeof block === 'object' && block.translucency === 0.0) {
                    break; // Stop ray if it hits an opaque block
                }
            } else if (rayCurrentGridRow >= Config.GRID_ROWS || rayCurrentGridCol < 0 || rayCurrentGridCol >= Config.GRID_COLS) {
                break; // Ray went out of bounds
            }

            if (rayCurrentGridCol === rayEndGridColTarget && rayCurrentGridRow === rayEndGridRowTarget) {
                break;
            }

            let e2_ray = 2 * err_ray;
            if (e2_ray > -dy_ray) { err_ray -= dy_ray; rayCurrentGridCol += sx_ray; }
            if (e2_ray <  dx_ray) { err_ray += dx_ray; rayCurrentGridRow += sy_ray; }
            currentRayBlockLength++;
        }

        // Draw Outer Ray (thicker halo)
        ctx.strokeStyle = Config.SUN_ANIMATION_RAY_COLOR_OUTER;
        ctx.lineWidth = outerRayWidth;
        ctx.beginPath();
        ctx.moveTo(sunWorldX, sunWorldY);
        ctx.lineTo(rayPixelEndX, rayPixelEndY);
        ctx.stroke();

        // Draw Inner Ray (thinner core)
        ctx.strokeStyle = Config.SUN_ANIMATION_RAY_COLOR_INNER;
        ctx.lineWidth = Config.SUN_ANIMATION_RAY_LINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(sunWorldX, sunWorldY);
        ctx.lineTo(rayPixelEndX, rayPixelEndY);
        ctx.stroke();
    }
}

export function updateStaticWorldAt(col, row) {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        // console.warn("updateStaticWorldAt: Grid context not available.");
        return;
    }

    const block = World.getBlock(col, row); // Get the block object or BLOCK_AIR
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH); // Use ceil to avoid 1px gaps due to flooring
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    // Clear the cell on the off-screen canvas
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    // Only draw if it's not an AIR block
    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
        const currentBlockType = typeof block === 'object' && block !== null ? block.type : block;

        // If somehow currentBlockType is AIR after all, exit (shouldn't happen if block !== Config.BLOCK_AIR)
        if (currentBlockType === Config.BLOCK_AIR) return;

        let baseColor = Config.BLOCK_COLORS[currentBlockType];
        let finalColor = baseColor;

        // Apply brightness if the block is lit (and it's an object with isLit property)
        if (typeof block === 'object' && block !== null && block.isLit && baseColor) {
            try {
                if (baseColor.startsWith('rgb(')) { // Ensure it's a simple rgb color string
                    const parts = baseColor.substring(4, baseColor.length - 1).split(',').map(s => parseInt(s.trim(), 10));
                    const r_val = Math.min(255, Math.floor(parts[0] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    const g_val = Math.min(255, Math.floor(parts[1] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    const b_val = Math.min(255, Math.floor(parts[2] * Config.LIT_BLOCK_BRIGHTNESS_FACTOR));
                    finalColor = `rgb(${r_val}, ${g_val}, ${b_val})`;
                }
                // Note: Could add similar logic for 'rgba(' if needed, or hex.
            } catch (e) {
                // console.error(`Error parsing color for lighting: ${baseColor}`, e);
                finalColor = baseColor; // Fallback to base color on error
            }
        }

        // --- Specific drawing logic for ROPE ---
        if (currentBlockType === Config.BLOCK_ROPE) {
            gridCtx.fillStyle = finalColor || Config.BLOCK_COLORS[Config.BLOCK_ROPE]; // Fallback to default rope color
            const ropeWidth = Math.max(1, Math.floor(blockW * 0.2)); // Rope is thin
            const ropeX = Math.floor(blockX + (blockW - ropeWidth) / 2);
            gridCtx.fillRect(ropeX, Math.floor(blockY), ropeWidth, blockH);

            const isPlayerPlacedRope = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlacedRope) {
                gridCtx.save();
                gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
                gridCtx.lineWidth = 1; // Ropes have a thinner outline for clarity
                gridCtx.strokeRect(
                    ropeX, Math.floor(blockY),
                    ropeWidth, blockH
                );
                gridCtx.restore();
            }
            // Rope HP/damage indicator (if applicable, usually ropes are simple)
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                gridCtx.save();
                gridCtx.globalAlpha = 0.5 + 0.5 * (block.hp / block.maxHp); // Visual feedback for HP
                gridCtx.fillStyle = finalColor || Config.BLOCK_COLORS[Config.BLOCK_ROPE];
                gridCtx.fillRect(ropeX, Math.floor(blockY), ropeWidth, blockH);
                gridCtx.restore();
            }

        } else if (currentBlockType === Config.BLOCK_VEGETATION) {
            // Vegetation Drawing
            if (finalColor) { // Ensure there's a color to draw with
                gridCtx.fillStyle = finalColor;
                // Iterate for each pixel in the block's area
                for (let py = 0; py < blockH; py++) {
                    for (let px = 0; px < blockW; px++) {
                        // Randomly decide whether to draw this pixel based on density
                        if (Math.random() < Config.VEGETATION_PIXEL_DENSITY) {
                            gridCtx.fillRect(Math.floor(blockX + px), Math.floor(blockY + py), 1, 1);
                        }
                    }
                }
            } // Closing brace for 'if (finalColor)' for VEGETATION FILL

            // Player-placed outline and damage indicators for vegetation are drawn regardless of finalColor for fill.
            const isPlayerPlacedVeg = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
            if (isPlayerPlacedVeg) {
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

            // Damage indicators for VEGETATION
            if (typeof block === 'object' && block !== null && block.maxHp > 0 && block.hp < block.maxHp && typeof block.hp === 'number' && !isNaN(block.hp)) {
                const hpRatio = block.hp / block.maxHp;
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) {
                    gridCtx.save();
                    gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                    gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                    gridCtx.lineCap = 'square'; // Or 'round'
                    const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // Inset path to be within block bounds
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
        } else { // For all other solid block types
            if (finalColor) {
                gridCtx.fillStyle = finalColor;
                gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

                // NEW: Draw natural wood outline
                if (currentBlockType === Config.BLOCK_WOOD && typeof block === 'object' && block !== null && !block.isPlayerPlaced) {
                    gridCtx.save();
                    gridCtx.strokeStyle = 'rgba(60, 40, 20, 0.7)'; // Darker brown, semi-transparent
                    gridCtx.lineWidth = 1; // Thin outline

                    // Left edge
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX) + 0.5, Math.floor(blockY));
                    gridCtx.lineTo(Math.floor(blockX) + 0.5, Math.floor(blockY + blockH));
                    gridCtx.stroke();

                    // Right edge
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX + blockW) - 0.5, Math.floor(blockY));
                    gridCtx.lineTo(Math.floor(blockX + blockW) - 0.5, Math.floor(blockY + blockH));
                    gridCtx.stroke();
                    gridCtx.restore();
                }
                // END NEW


                // Draw player-placed outline if applicable
                const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
                if (isPlayerPlaced) { // This will draw player outline ON TOP of natural wood outline if both apply (which is fine)
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

                // Draw damage indicators
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

    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); // Clear entire grid canvas

    const worldGrid = World.getGrid(); // Get the full grid data
    if (!worldGrid || !Array.isArray(worldGrid)) {
        console.error("WorldManager: Cannot render, worldGrid is invalid.");
        return;
    }

    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (!Array.isArray(worldGrid[r])) {
            // console.warn(`WorldManager: Row ${r} is not an array in worldGrid.`);
            continue;
        }
        for (let c = 0; c < Config.GRID_COLS; c++) {
            updateStaticWorldAt(c, r); // Redraw each cell
        }
    }
    console.log("WorldManager: Static world render complete.");
}

export function draw(ctx) {
    if (!ctx) {
        // console.error("WorldManager.draw: Main context not provided.");
        return;
    }

    // Draw the pre-rendered static world from the off-screen canvas
    const gridCanvasToDraw = Renderer.getGridCanvas();
    if (gridCanvasToDraw) {
        ctx.drawImage(gridCanvasToDraw, 0, 0);
    }

    // --- NEW: Draw animated sun effect ---
    const animatedSunPos = WaveManager.getAnimatedSunPosition();
    if (animatedSunPos) {
        drawAnimatedSunEffect(ctx, animatedSunPos.x, animatedSunPos.y);
    }
    // --- END NEW ---


    // Draw dynamic elements on top
    drawGravityAnimations(ctx);
    drawAgingAnimations(ctx);
    drawLightingAnimations(ctx); // Draw lighting flashes
}

// -----------------------------------------------------------------------------
// --- Update Cycle ---
// -----------------------------------------------------------------------------

export function update(dt) {
    // Water simulation update
    waterPropagationTimer = Math.max(0, waterPropagationTimer - dt);
    if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) {
        waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // Reset timer

        // Prioritize processing candidates from bottom-up to encourage downward flow first
        const candidatesArray = Array.from(waterUpdateQueue.values());
        candidatesArray.sort((a, b) => b.r - a.r); // Sort by row descending

        const candidatesToProcess = candidatesArray.slice(0, Config.WATER_UPDATES_PER_FRAME);

        // Remove processed candidates from the main queue
        candidatesToProcess.forEach(({c, r}) => {
            const key = `${c},${r}`;
            waterUpdateQueue.delete(key);
        });

        candidatesToProcess.forEach(({c, r}) => {
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return; // Bounds check

            const currentBlockType = World.getBlockType(c, r);

            if (currentBlockType === Config.BLOCK_AIR) {
                // If this AIR block is at or below water level and adjacent to WATER, it becomes WATER
                if (r >= Config.WATER_LEVEL) {
                    let adjacentToWater = false;
                    const immediateNeighbors = [
                        {dc:0, dr:1}, {dc:0, dr:-1}, {dc:1, dr:0}, {dc:-1, dr:0}
                        // Optional: Diagonals for faster fill: {dc:1, dr:1}, {dc:-1, dr:1}, {dc:1, dr:-1}, {dc:-1, dr:-1}
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
                            queueWaterCandidatesAroundChange(c, r); // Re-queue neighbors
                        }
                    }
                }
            } else if (currentBlockType === Config.BLOCK_WATER) {
                // Check if water can flow down
                const blockBelowType = World.getBlockType(c, r + 1);
                if (blockBelowType === Config.BLOCK_AIR) { // Can flow directly down
                    addWaterUpdateCandidate(c, r + 1); // Queue the block below
                    // Optional: If water moves down, the current block becomes AIR and its neighbors need re-evaluation
                    // World.setBlock(c, r, Config.BLOCK_AIR, false);
                    // updateStaticWorldAt(c, r);
                    // queueWaterCandidatesAroundChange(c, r); // But this can cause rapid oscillation
                } else {
                    // If blocked below, try to spread sideways
                    const blockBelow = World.getBlock(c, r + 1); // Get full data for robust check
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // Default to AIR if null/invalid
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR); // True if solid or already water

                    if (isBelowSolidOrWater) { // Only spread if actually blocked below
                        let spreadOccurred = false;
                        // Try to spread left
                        if (World.getBlockType(c - 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                            addWaterUpdateCandidate(c - 1, r);
                            spreadOccurred = true;
                        }
                        // Try to spread right
                        if (World.getBlockType(c + 1, r) === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                            addWaterUpdateCandidate(c + 1, r);
                            spreadOccurred = true;
                        }
                        // If spread, this water block might still be a candidate for future flow
                        if(spreadOccurred) {
                            addWaterUpdateCandidate(c,r); // Re-queue itself if it caused spread
                        }
                    }
                }
            }
        });
    }

    // Update animations
    updateGravityAnimations(dt);
    updateAgingAnimations(dt);
    updateLightingAnimations(dt);
}