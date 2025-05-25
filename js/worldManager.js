// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import * as Renderer from './utils/renderer.js';
import * as World from './utils/world.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld as generateWorldFromGenerator } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';
import { createBlock } from './utils/block.js';
import * as WaveManager from './waveManager.js';
import * as DebugLogger from './utils/debugLogger.js';

// --- Module State ---
let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed

// --- Transform Animation State ---
let transformAnimationQueue = [];
export let activeTransformAnimations = [];
let newTransformAnimationStartTimer = 0;

// Gravity Animation State
let gravityAnimationQueue = [];
export let activeGravityAnimations = [];
let newGravityAnimationStartTimer = 0;

// --- Dynamic Pacing State ---
let isDynamicAnimationPacingActive = false;
let dynamicTransformAnimStartInterval = Config.AGING_ANIMATION_NEW_BLOCK_DELAY; // Fallback
let dynamicGravityAnimStartInterval = Config.NEW_GRAVITY_ANIM_DELAY;       // Fallback
// Define target duration for block animations, aligned with UI/Sun animations
export const BLOCK_ANIM_TARGET_DURATION = Config.MYA_TRANSITION_ANIMATION_DURATION > 0
                                  ? Config.MYA_TRANSITION_ANIMATION_DURATION
                                  : Config.FIXED_SUN_ANIMATION_DURATION;


const MAX_FALLING_BLOCKS_AT_ONCE = Config.MAX_FALLING_BLOCKS_AT_ONCE ?? 20;
const SUN_MOVEMENT_Y_ROW_OFFSET = Config.SUN_MOVEMENT_Y_ROW_OFFSET ?? -3;


function adjustColorByLightLevel(rgbString, lightLevel) {
    if (!rgbString || !rgbString.startsWith('rgb(')) return rgbString;
    const parts = rgbString.substring(4, rgbString.length - 1).split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length !== 3 || parts.some(isNaN)) return rgbString;
    const baseR = parts[0], baseG = parts[1], baseB = parts[2];
    const brightnessFactor = Config.MIN_LIGHT_LEVEL_COLOR_FACTOR +
                             (Config.MAX_LIGHT_LEVEL_BRIGHTNESS_FACTOR - Config.MIN_LIGHT_LEVEL_COLOR_FACTOR) * lightLevel;
    const r = Math.min(255, Math.floor(baseR * brightnessFactor));
    const g = Math.min(255, Math.floor(baseG * brightnessFactor));
    const b = Math.min(255, Math.floor(baseB * brightnessFactor));
    return `rgb(${r}, ${g}, ${b})`;
}

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
    DebugLogger.log(`[WorldManager] Added ${changes.length} gravity changes. Total queued: ${gravityAnimationQueue.length}`);
}

function calculateDynamicAnimationIntervals() {
    const single_transform_duration = Config.AGING_ANIMATION_SWELL_DURATION + Config.AGING_ANIMATION_POP_DURATION;

    if (transformAnimationQueue.length > 0) {
        // Calculate interval so the last animation STARTS in time to FINISH by BLOCK_ANIM_TARGET_DURATION
        const time_for_all_starts = BLOCK_ANIM_TARGET_DURATION - single_transform_duration;
        if (time_for_all_starts > 0 && transformAnimationQueue.length > 1) {
            // Spread starts so the last one begins at time_for_all_starts
            dynamicTransformAnimStartInterval = time_for_all_starts / (transformAnimationQueue.length - 1);
        } else { // Not enough time for spreading, or only one/zero animations. Start quickly.
            dynamicTransformAnimStartInterval = 0.001; // Effectively start them as fast as blocksAtOnce allows
        }
        dynamicTransformAnimStartInterval = Math.max(0.001, dynamicTransformAnimStartInterval); // Min interval
    } else {
        dynamicTransformAnimStartInterval = Config.AGING_ANIMATION_NEW_BLOCK_DELAY; // Fallback
    }

    // Adjust gravity pacing similarly, estimating an average gravity animation duration
    const avg_gravity_duration = 0.5; // A rough estimate for average fall time of a gravity animation
    if (gravityAnimationQueue.length > 0) {
        const time_for_all_gravity_starts = BLOCK_ANIM_TARGET_DURATION - avg_gravity_duration;
        if (time_for_all_gravity_starts > 0 && gravityAnimationQueue.length > 1) {
            dynamicGravityAnimStartInterval = time_for_all_gravity_starts / (gravityAnimationQueue.length - 1);
        } else {
            dynamicGravityAnimStartInterval = 0.001;
        }
        dynamicGravityAnimStartInterval = Math.max(0.001, dynamicGravityAnimStartInterval); // Min interval
    } else {
        dynamicGravityAnimStartInterval = Config.NEW_GRAVITY_ANIM_DELAY; // Fallback
    }
    DebugLogger.log(`[WorldManager] Dynamic Pacing Calculated: Transform Interval: ${dynamicTransformAnimStartInterval.toFixed(4)}s (Queue: ${transformAnimationQueue.length}), Gravity Interval: ${dynamicGravityAnimStartInterval.toFixed(4)}s (Queue: ${gravityAnimationQueue.length}) for target ${BLOCK_ANIM_TARGET_DURATION}s`);
}

export function startDynamicWarpPacing() {
    isDynamicAnimationPacingActive = true;
    calculateDynamicAnimationIntervals();
    newTransformAnimationStartTimer = 0; // Start first transform batch immediately
    newGravityAnimationStartTimer = 0;   // Start first gravity batch immediately
    DebugLogger.log("[WorldManager] Dynamic warp animation pacing STARTED.");
}

export function endDynamicWarpPacing() {
    isDynamicAnimationPacingActive = false;
    // Reset to defaults, they'll be recalculated next time if needed
    dynamicTransformAnimStartInterval = Config.AGING_ANIMATION_NEW_BLOCK_DELAY;
    dynamicGravityAnimStartInterval = Config.NEW_GRAVITY_ANIM_DELAY;
    DebugLogger.log("[WorldManager] Dynamic warp animation pacing ENDED.");
}


function updateGravityAnimations(dt) {
    if (dt <= 0) return;
    newGravityAnimationStartTimer -= dt;
    const maxFallingBlocks = Config.MAX_FALLING_BLOCKS_AT_ONCE;
    
    const currentNewGravityDelay = isDynamicAnimationPacingActive
                                 ? dynamicGravityAnimStartInterval
                                 : Config.NEW_GRAVITY_ANIM_DELAY;

    if (newGravityAnimationStartTimer <= 0) {
        if (gravityAnimationQueue.length > 0 && activeGravityAnimations.length < maxFallingBlocks) {
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
                fallSpeed: Config.GRAVITY_ANIMATION_FALL_SPEED,
            });
            newGravityAnimationStartTimer = currentNewGravityDelay;
        } else if (gravityAnimationQueue.length === 0 && activeGravityAnimations.length === 0) {
            newGravityAnimationStartTimer = 0;
        }
    }

    for (let i = activeGravityAnimations.length - 1; i >= 0; i--) {
        const anim = activeGravityAnimations[i];
        anim.r_current_pixel_y += anim.fallSpeed * dt;
        if (anim.r_current_pixel_y >= anim.r_end_pixel_y) {
            const end_row = Math.round(anim.r_end_pixel_y / Config.BLOCK_HEIGHT);
            updateStaticWorldAt(anim.c, end_row);
            queueWaterCandidatesAroundChange(anim.c, Math.round(anim.r_start_pixel_y / Config.BLOCK_HEIGHT));
            queueWaterCandidatesAroundChange(anim.c, end_row);
            activeGravityAnimations.splice(i, 1);
        }
    }
}

function drawGravityAnimations(ctx) {
    activeGravityAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        const blockPixelY = anim.r_current_pixel_y;
        const blockProps = Config.BLOCK_PROPERTIES[anim.blockData.type];
        const blockColor = blockProps?.color;

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
    DebugLogger.log("[WorldManager] Finalizing all gravity animations...");
    DebugLogger.time("finalizeAllGravityAnimations");
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
    DebugLogger.log("[WorldManager] All gravity animations finalized.");
    DebugLogger.timeEnd("finalizeAllGravityAnimations");
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
            { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
            { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
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
                            const typeAtFallTarget = (typeof blockAtFallTargetData === 'object' && blockAtFallTargetData !== null)
                                ? blockAtFallTargetData.type
                                : blockAtFallTargetData;
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

export function applyLightingPass(DEBUG_DRAW_LIGHTING = false, sunStepOverride = null) {
    const maxLightLevels = new Map();
    const grid = World.getGrid();
    if (!grid || grid.length === 0) {
        console.error("[WorldManager] applyLightingPass: World grid not available for calculation.");
        return [];
    }

    let mainCtxForDebug;
    if (DEBUG_DRAW_LIGHTING) {
        mainCtxForDebug = Renderer.getContext();
        if (!mainCtxForDebug) {
            console.error("Debug Lighting: Main context not available!");
            DEBUG_DRAW_LIGHTING = false;
        }
    }

    const sunCenterPixelY = (Config.SUN_MOVEMENT_Y_ROW_OFFSET * Config.BLOCK_HEIGHT) + (Config.BLOCK_HEIGHT / 2);
    const sunStartPixelX = Config.CANVAS_WIDTH + (Config.BLOCK_WIDTH * 10);
    const sunEndPixelX = -(Config.BLOCK_WIDTH * 10);
    
    const stepColumnsToUse = sunStepOverride !== null ? sunStepOverride : Config.SUN_MOVEMENT_STEP_COLUMNS;
    const sunStepPixelX = stepColumnsToUse * Config.BLOCK_WIDTH;

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
       if (numDownwardRays <= 0) continue;

       for (let i = 0; i < numDownwardRays; i++) {
           let angle = (numDownwardRays === 1) ? (Math.PI / 2) : (i / (numDownwardRays - 1)) * Math.PI;
            let rayCurrentGridCol = sunGridCol;
            let rayCurrentGridRow = sunGridRow;
            const rayEndGridCol = Math.floor(sunGridCol + Math.cos(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);
            const rayEndGridRow = Math.floor(sunGridRow + Math.sin(angle) * Config.MAX_LIGHT_RAY_LENGTH_BLOCKS);
            let dx = Math.abs(rayEndGridCol - rayCurrentGridCol);
            let dy = Math.abs(rayEndGridRow - rayCurrentGridRow);
            let sx = (rayCurrentGridCol < rayEndGridCol) ? 1 : -1;
            let sy = (rayCurrentGridRow < rayEndGridRow) ? 1 : -1;
            let err = dx - dy;
            let currentRayBlockLength = 0;
            let currentLightPower = Config.INITIAL_LIGHT_RAY_POWER;

            while (currentRayBlockLength < Config.MAX_LIGHT_RAY_LENGTH_BLOCKS) {
                if (currentLightPower < Config.MIN_LIGHT_THRESHOLD) {
                    break;
                }

                if (rayCurrentGridCol >= 0 && rayCurrentGridCol < Config.GRID_COLS &&
                    rayCurrentGridRow >= 0 && rayCurrentGridRow < Config.GRID_ROWS) {
                    const block = World.getBlock(rayCurrentGridCol, rayCurrentGridRow);
                    const blockProps = Config.BLOCK_PROPERTIES[block?.type ?? Config.BLOCK_AIR];

                    if (blockProps && blockProps.translucency !== undefined) {
                        if (blockProps.translucency === 0.0) {
                            const blockKey = `${rayCurrentGridCol},${rayCurrentGridRow}`;
                            const existingMaxLight = maxLightLevels.get(blockKey) || 0.0;
                            if (currentLightPower > existingMaxLight) {
                                maxLightLevels.set(blockKey, currentLightPower);
                            }
                            break;
                        }
                    }

                    if (block === Config.BLOCK_AIR || (blockProps && blockProps.translucency === 1.0) || block === null) {
                        // Ray passes without power reduction
                    } 
                    else if (typeof block === 'object' && block !== null && blockProps) {
                        const blockKey = `${rayCurrentGridCol},${rayCurrentGridRow}`;
                        const existingMaxLight = maxLightLevels.get(blockKey) || 0.0;
                        if (currentLightPower > existingMaxLight) {
                            maxLightLevels.set(blockKey, currentLightPower);
                        }
                        currentLightPower *= blockProps.translucency;
                    } 
                    else {
                        break; 
                    }
                } else if (rayCurrentGridRow >= Config.GRID_ROWS || rayCurrentGridCol < 0 || rayCurrentGridCol >= Config.GRID_COLS) {
                    break;
                }

                if (rayCurrentGridCol === rayEndGridCol && rayCurrentGridRow === rayEndGridRow) break;
                let e2 = 2 * err;
                if (e2 > -dy) { err -= dy; rayCurrentGridCol += sx; }
                if (e2 < dx) { err += dx; rayCurrentGridRow += sy; }
                currentRayBlockLength++;
            }
            if (DEBUG_DRAW_LIGHTING && mainCtxForDebug) { /* ... debug ray drawing ... */ }
        }
    }

    const proposedChanges = [];
    maxLightLevels.forEach((lightLevel, key) => {
        const [c, r] = key.split(',').map(Number);
        proposedChanges.push({ c, r, newLightLevel: lightLevel });
    });

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
    const initialProposedLighting = applyLightingPass(false);

    initialProposedLighting.forEach(change => {
        const block = World.getBlock(change.c, change.r);
        if (block && typeof block === 'object' && typeof block.lightLevel === 'number') {
            block.lightLevel = change.newLightLevel;
        }
    });
    console.log(`[WorldManager] Initial lighting calculated and applied directly: ${initialProposedLighting.length} blocks lit.`);

    transformAnimationQueue = [];
    activeTransformAnimations = [];
    newTransformAnimationStartTimer = 0;
    gravityAnimationQueue = [];
    activeGravityAnimations = [];
    newGravityAnimationStartTimer = 0;

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
    const blockProps = Config.BLOCK_PROPERTIES[block?.type ?? Config.BLOCK_AIR];
    if (!block || typeof block !== 'object' || !blockProps || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || blockProps.hp <= 0 || blockProps.hp === Infinity || block.hp <= 0) {
        return false;
    }
    if (typeof block.hp !== 'number' || isNaN(block.hp)) {
        block.hp = blockProps.hp;
        return false;
    }
    block.hp -= damageAmount;
    updateStaticWorldAt(col, row);
    let wasDestroyed = false;
    if (block.hp <= 0) {
        wasDestroyed = true;
        block.hp = 0;
        if (blockProps.droppedItemType && blockProps.droppedItemConfig) {
            const dropType = blockProps.droppedItemType;
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

// --- NEW: Transform Animation Functions ---
export function diffGridAndQueueTransformAnimations(initialGrid, finalGrid) {
    DebugLogger.time("diffGridAndQueueTransformAnimations");
    if (!initialGrid || !finalGrid || initialGrid.length !== finalGrid.length || (initialGrid.length > 0 && initialGrid[0]?.length !== finalGrid[0]?.length)) {
        console.error("[WorldManager] Diff Grids: Invalid grids provided for diffing.", initialGrid?.length, finalGrid?.length, initialGrid[0]?.length, finalGrid[0]?.length);
        DebugLogger.timeEnd("diffGridAndQueueTransformAnimations");
        return;
    }
    transformAnimationQueue = [];

    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (!initialGrid[r] || !finalGrid[r]) continue;
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const oldBlock = initialGrid[r][c];
            const newBlock = finalGrid[r][c];

            const oldType = (typeof oldBlock === 'object' && oldBlock !== null) ? oldBlock.type : oldBlock;
            const oldLightLevel = (typeof oldBlock === 'object' && oldBlock !== null) ? (oldBlock.lightLevel ?? 0.0) : 0.0;

            const newType = (typeof newBlock === 'object' && newBlock !== null) ? newBlock.type : newBlock;
            const newLightLevel = (typeof newBlock === 'object' && newBlock !== null) ? (newBlock.lightLevel ?? 0.0) : 0.0;

            if (oldType !== newType || oldLightLevel !== newLightLevel) {
                const oldBlockDataForAnim = (typeof oldBlock === 'object' && oldBlock !== null) ? { ...oldBlock } : createBlock(oldType, false);
                const newBlockDataForAnim = (typeof newBlock === 'object' && newBlock !== null) ? { ...newBlock } : createBlock(newType, false);

                transformAnimationQueue.push({
                    c, r,
                    oldBlockData: oldBlockDataForAnim,
                    newBlockData: newBlockDataForAnim
                });
            }
        }
    }
    DebugLogger.log(`[WorldManager] Queued ${transformAnimationQueue.length} transform animations after diff.`);
    DebugLogger.timeEnd("diffGridAndQueueTransformAnimations");
}

function updateTransformAnimations(dt) {
    if (dt <= 0) return;

    newTransformAnimationStartTimer -= dt;
    const blocksAtOnce = Config.AGING_ANIMATION_BLOCKS_AT_ONCE;
    
    const currentNewBlockDelay = isDynamicAnimationPacingActive 
                               ? dynamicTransformAnimStartInterval 
                               : Config.AGING_ANIMATION_NEW_BLOCK_DELAY;

    if (newTransformAnimationStartTimer <= 0) {
        if (transformAnimationQueue.length > 0 && activeTransformAnimations.length < blocksAtOnce) {
            const change = transformAnimationQueue.shift();
            const existingAnimIndex = activeTransformAnimations.findIndex(anim => anim.c === change.c && anim.r === change.r);
            if (existingAnimIndex === -1) {
                activeTransformAnimations.push({
                    c: change.c, r: change.r,
                    oldBlockData: change.oldBlockData,
                    newBlockData: change.newBlockData,
                    timer: Config.AGING_ANIMATION_SWELL_DURATION,
                    phase: 'swell',
                    currentScale: 1.0,
                });
                const gridCtx = Renderer.getGridContext();
                if (gridCtx) {
                    gridCtx.clearRect(
                        Math.floor(change.c * Config.BLOCK_WIDTH), Math.floor(change.r * Config.BLOCK_HEIGHT),
                        Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT)
                    );
                }
            }
            newTransformAnimationStartTimer = currentNewBlockDelay;
        } else if (transformAnimationQueue.length === 0 && activeTransformAnimations.length === 0) {
            newTransformAnimationStartTimer = 0;
        }
    }

    for (let i = activeTransformAnimations.length - 1; i >= 0; i--) {
        const anim = activeTransformAnimations[i];
        anim.timer -= dt;
        if (anim.phase === 'swell') {
            const swellDuration = Config.AGING_ANIMATION_SWELL_DURATION;
            const swellScale = Config.AGING_ANIMATION_SWELL_SCALE;
            const timeElapsed = swellDuration - anim.timer;
            const progress = Math.min(1.0, Math.max(0, timeElapsed / swellDuration));
            anim.currentScale = 1.0 + (swellScale - 1.0) * progress;
            if (anim.timer <= 0) {
                anim.phase = 'pop';
                anim.timer = Config.AGING_ANIMATION_POP_DURATION;
                anim.currentScale = 1.0;
            }
        } else if (anim.phase === 'pop') {
            if (anim.timer <= 0) {
                updateStaticWorldAt(anim.c, anim.r);
                queueWaterCandidatesAroundChange(anim.c, anim.r);
                activeTransformAnimations.splice(i, 1);
            }
        }
    }
}

function drawTransformAnimations(ctx) {
    activeTransformAnimations.forEach(anim => {
        const blockPixelX = anim.c * Config.BLOCK_WIDTH;
        const blockPixelY = anim.r * Config.BLOCK_HEIGHT;
        const blockWidth = Config.BLOCK_WIDTH;
        const blockHeight = Config.BLOCK_HEIGHT;

        ctx.save();
        if (anim.phase === 'swell') {
            ctx.translate(blockPixelX + blockWidth / 2, blockPixelY + blockHeight / 2);
            ctx.scale(anim.currentScale, anim.currentScale);
            ctx.translate(-(blockPixelX + blockWidth / 2), -(blockPixelY + blockHeight / 2));

            const oldBlockType = anim.oldBlockData.type;
            const oldBlockProps = Config.BLOCK_PROPERTIES[oldBlockType];
            if (oldBlockType !== Config.BLOCK_AIR && oldBlockProps && oldBlockProps.color) {
                let swellColor = oldBlockProps.color;
                if (typeof anim.oldBlockData.lightLevel === 'number') {
                    swellColor = adjustColorByLightLevel(swellColor, anim.oldBlockData.lightLevel);
                }
                ctx.fillStyle = swellColor;
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        } else if (anim.phase === 'pop') {
            const newBlockType = anim.newBlockData.type;
            const newBlockProps = Config.BLOCK_PROPERTIES[newBlockType];
            if (newBlockType !== Config.BLOCK_AIR && newBlockProps && newBlockProps.color) {
                const popDuration = Config.AGING_ANIMATION_POP_DURATION;
                const popProgress = Math.max(0, 1.0 - (anim.timer / popDuration));
                const alpha = 0.6 + 0.4 * Math.sin(popProgress * Math.PI);
                ctx.globalAlpha = alpha;

                let popColor = newBlockProps.color;
                if (typeof anim.newBlockData.lightLevel === 'number') {
                    popColor = adjustColorByLightLevel(popColor, anim.newBlockData.lightLevel);
                }
                ctx.fillStyle = popColor;
                ctx.fillRect(Math.floor(blockPixelX), Math.floor(blockPixelY), Math.ceil(blockWidth), Math.ceil(blockHeight));
            }
        }
        ctx.restore();
    });
}

export function areTransformAnimationsComplete() {
    return transformAnimationQueue.length === 0 && activeTransformAnimations.length === 0;
}

export function finalizeAllTransformAnimations() {
    DebugLogger.log("[WorldManager] Finalizing all transform animations...");
    DebugLogger.time("finalizeAllTransformAnimations");
    while (transformAnimationQueue.length > 0) {
        const change = transformAnimationQueue.shift();
        updateStaticWorldAt(change.c, change.r);
        queueWaterCandidatesAroundChange(change.c, change.r);
    }
    while (activeTransformAnimations.length > 0) {
        const anim = activeTransformAnimations.shift();
        updateStaticWorldAt(anim.c, anim.r);
        queueWaterCandidatesAroundChange(anim.c, anim.r);
    }
    transformAnimationQueue = [];
    activeTransformAnimations = [];
    DebugLogger.log("[WorldManager] All transform animations finalized.");
    DebugLogger.timeEnd("finalizeAllTransformAnimations");
}

// -----------------------------------------------------------------------------
// --- Rendering ---
// -----------------------------------------------------------------------------

function LCG(seed) {
    let state = seed;
    state = Math.abs(Math.floor(state)) % 2147483647;
    if (state === 0) state = 1;
    return function() {
        state = (1664525 * state + 1013904223) & 0x7FFFFFFF;
        return state / 0x7FFFFFFF;
    }
}

function drawAnimatedSunEffect(ctx, sunWorldX, sunWorldY) {
    if (!ctx || !Config.SUN_ANIMATION_ENABLED) return;
    const sunRadius = Config.SUN_ANIMATION_RADIUS_BLOCKS * Config.BLOCK_WIDTH;
    ctx.save();
    ctx.shadowColor = Config.SUN_ANIMATION_OUTLINE_COLOR;
    ctx.shadowBlur = Config.SUN_ANIMATION_OUTLINE_BLUR;
    ctx.strokeStyle = Config.SUN_ANIMATION_OUTLINE_COLOR;
    ctx.lineWidth = Config.SUN_ANIMATION_OUTLINE_WIDTH;
    ctx.beginPath();
    ctx.arc(sunWorldX, sunWorldY, sunRadius, 0, Math.PI * 2);
    // ctx.fill(); // Fill with shadow color for a glow effect before main sun
    ctx.stroke();
    ctx.restore(); // Restore before drawing main sun so shadow doesn't apply to it
    ctx.fillStyle = Config.SUN_ANIMATION_COLOR;
    ctx.beginPath();
    ctx.arc(sunWorldX, sunWorldY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    const sunGridCol = Math.floor(sunWorldX / Config.BLOCK_WIDTH);
    const sunGridRow = Math.floor(sunWorldY / Config.BLOCK_HEIGHT);
    const outerRayWidth = Config.SUN_ANIMATION_RAY_LINE_WIDTH * Config.SUN_ANIMATION_RAY_OUTER_WIDTH_FACTOR;
    for (let i = 0; i < Config.SUN_RAYS_PER_POSITION; i++) {
        const angle = (i / Config.SUN_RAYS_PER_POSITION) * 2 * Math.PI;
        let rayCurrentGridCol = sunGridCol;
        let rayCurrentGridRow = sunGridRow;
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
                const blockProps = Config.BLOCK_PROPERTIES[block?.type ?? Config.BLOCK_AIR];
                if (block !== Config.BLOCK_AIR && blockProps && blockProps.translucency === 0.0) {
                    break;
                }
            } else if (rayCurrentGridRow >= Config.GRID_ROWS || rayCurrentGridCol < 0 || rayCurrentGridCol >= Config.GRID_COLS) {
                break;
            }
            if (rayCurrentGridCol === rayEndGridColTarget && rayCurrentGridRow === rayEndGridRowTarget) break;
            let e2_ray = 2 * err_ray;
            if (e2_ray > -dy_ray) { err_ray -= dy_ray; rayCurrentGridCol += sx_ray; }
            if (e2_ray <  dx_ray) { err_ray += dx_ray; rayCurrentGridRow += sy_ray; }
            currentRayBlockLength++;
        }
        ctx.strokeStyle = Config.SUN_ANIMATION_RAY_COLOR_OUTER;
        ctx.lineWidth = outerRayWidth;
        ctx.beginPath();
        ctx.moveTo(sunWorldX, sunWorldY);
        ctx.lineTo(rayPixelEndX, rayPixelEndY);
        ctx.stroke();
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
    if (!gridCtx) return;

    const block = World.getBlock(col, row);
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH);
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);

    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);

    if (block !== Config.BLOCK_AIR && block !== null && block !== undefined) {
        const currentBlockType = typeof block === 'object' && block !== null ? block.type : block;
        const blockProps = Config.BLOCK_PROPERTIES[currentBlockType];

        if (currentBlockType === Config.BLOCK_AIR || !blockProps || !blockProps.color) return;

        let baseColor = blockProps.color;
        let finalColor = baseColor;

        if (typeof block === 'object' && block !== null && typeof block.lightLevel === 'number') {
            finalColor = adjustColorByLightLevel(baseColor, block.lightLevel);
        }

        if (blockProps.isRope) {
            gridCtx.fillStyle = finalColor || Config.BLOCK_PROPERTIES[Config.BLOCK_ROPE].color;
            const ropeWidth = Math.max(1, Math.floor(blockW * 0.2));
            const ropeX = Math.floor(blockX + (blockW - ropeWidth) / 2);
            gridCtx.fillRect(ropeX, Math.floor(blockY), ropeWidth, blockH);
        } else if (blockProps.isVegetation) {
            if (finalColor) {
                gridCtx.fillStyle = finalColor;
                let vegetationSeed = (row * 7919 + col * 3571);
                if (typeof block === 'object' && block !== null && block.isPlayerPlaced) {
                    vegetationSeed = (vegetationSeed + 12583) & 0x7FFFFFFF;
                }
                const vegetationRandom = LCG(vegetationSeed);
                for (let py = 0; py < blockH; py++) {
                    for (let px = 0; px < blockW; px++) {
                        if (vegetationRandom() < Config.VEGETATION_PIXEL_DENSITY) {
                            gridCtx.fillRect(Math.floor(blockX + px), Math.floor(blockY + py), 1, 1);
                        }
                    }
                }
            }
        } else {
            if (finalColor) {
                gridCtx.fillStyle = finalColor;
                gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
                if (blockProps.isWood && typeof block === 'object' && block !== null && !block.isPlayerPlaced) {
                    gridCtx.save();
                    gridCtx.strokeStyle = 'rgba(60, 40, 20, 0.7)';
                    gridCtx.lineWidth = 1;
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX) + 0.5, Math.floor(blockY));
                    gridCtx.lineTo(Math.floor(blockX) + 0.5, Math.floor(blockY + blockH));
                    gridCtx.stroke();
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX + blockW) - 0.5, Math.floor(blockY));
                    gridCtx.lineTo(Math.floor(blockX + blockW) - 0.5, Math.floor(blockY + blockH));
                    gridCtx.stroke();
                    gridCtx.restore();
                }
            }
        }

        const isPlayerPlaced = typeof block === 'object' && block !== null ? (block.isPlayerPlaced ?? false) : false;
        if (isPlayerPlaced) {
            gridCtx.save();
            gridCtx.strokeStyle = Config.PLAYER_BLOCK_OUTLINE_COLOR;
            gridCtx.lineWidth = Config.PLAYER_BLOCK_OUTLINE_THICKNESS;
            const outlineInset = Config.PLAYER_BLOCK_OUTLINE_THICKNESS / 2;
            if (blockProps.isRope) {
                 const ropeWidth = Math.max(1, Math.floor(blockW * 0.2));
                 const ropeX = Math.floor(blockX + (blockW - ropeWidth) / 2);
                 gridCtx.strokeRect(
                    ropeX + outlineInset / 2,
                    Math.floor(blockY) + outlineInset / 2,
                    ropeWidth - outlineInset,
                    blockH - outlineInset
                );
            } else {
                gridCtx.strokeRect(
                    Math.floor(blockX) + outlineInset, Math.floor(blockY) + outlineInset,
                    blockW - Config.PLAYER_BLOCK_OUTLINE_THICKNESS, blockH - Config.PLAYER_BLOCK_OUTLINE_THICKNESS
                );
            }
            gridCtx.restore();
        }
        if (typeof block === 'object' && block !== null && blockProps.hp > 0 && block.hp < blockProps.hp && typeof block.hp === 'number' && !isNaN(block.hp)) {
            const hpRatio = block.hp / blockProps.hp;
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
export function renderStaticWorldToGridCanvas() {
    console.log("WorldManager: Rendering static world to grid canvas...");
    DebugLogger.time("renderStaticWorldToGridCanvas");
    const gridCtx = Renderer.getGridContext();
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCtx || !gridCanvas) {
        console.error("WorldManager: Cannot render static world - grid canvas/context missing!");
        DebugLogger.timeEnd("renderStaticWorldToGridCanvas");
        return;
    }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    const worldGridData = World.getGrid();
    if (!worldGridData || !Array.isArray(worldGridData)) {
        console.error("WorldManager: Cannot render, worldGridData is invalid.");
        DebugLogger.timeEnd("renderStaticWorldToGridCanvas");
        return;
    }
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (!Array.isArray(worldGridData[r])) continue;
        for (let c = 0; c < Config.GRID_COLS; c++) {
            updateStaticWorldAt(c, r);
        }
    }
    console.log("WorldManager: Static world render complete.");
    DebugLogger.timeEnd("renderStaticWorldToGridCanvas");
}

export function draw(ctx) {
    if (!ctx) return;
    const gridCanvasToDraw = Renderer.getGridCanvas();
    if (gridCanvasToDraw) {
        ctx.drawImage(gridCanvasToDraw, 0, 0);
    }
    const animatedSunPos = WaveManager.getAnimatedSunPosition();
    if (animatedSunPos) {
        drawAnimatedSunEffect(ctx, animatedSunPos.x, animatedSunPos.y);
    }
    drawGravityAnimations(ctx);
    drawTransformAnimations(ctx);
}

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
                    const immediateNeighbors = [ {dc:0, dr:1}, {dc:0, dr:-1}, {dc:1, dr:0}, {dc:-1, dr:0} ];
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
    updateTransformAnimations(dt);
}