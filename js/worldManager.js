// -----------------------------------------------------------------------------
// root/js/worldManager.js - Manages world state, drawing, and interactions
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import * as Renderer from './renderer.js';
import * as WorldData from './utils/worldData.js';
import * as ItemManager from './itemManager.js';
import { generateInitialWorld } from './utils/worldGenerator.js';
import * as GridCollision from './utils/gridCollision.js';
import { PerlinNoise } from './utils/noise.js';

let waterUpdateQueue = new Map(); // map: "col,row" -> {c, r}
let waterPropagationTimer = 0; // timer to control spread speed
let agingNoiseGenerator = null; // dedicated noise instance for aging

export function init(portalRef) {
    WorldData.initializeGrid();
    generateInitialWorld(); // world generator now handles landmass + flood fill
    const gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        console.error("FATAL: Grid Canvas not found! Ensure Renderer.createGridCanvas() runs before World.init().");
        console.warn("Attempting fallback grid canvas creation.");
        Renderer.createGridCanvas();
        if (!Renderer.getGridCanvas()) {
            throw new Error("Fallback grid canvas creation failed.");
        }
    }
    renderStaticWorldToGridCanvas(); // initial rendering *before* aging is useful for debugging generation results
    agingNoiseGenerator = new PerlinNoise(12345); // currently using a fixed seed for aging calculation
    console.log("Applying initial world aging...");
    applyAging(portalRef, Config.AGING_BASE_INTENSITY); // apply aging with base intensity
    console.log("Initial world aging complete.");
    renderStaticWorldToGridCanvas(); // re-render static world after aging
    seedWaterUpdateQueue(); // seed the water simulation after world generation AND initial aging
}
function addWaterUpdateCandidate(col, row) { // add to update queue if within bounds, within waterline threshold, not already queued, and are AIR or WATER
    if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) { // check if within bounds and at or below the water line threshold
        const key = `${col},${row}`;
        if (!waterUpdateQueue.has(key)) { // check if the cell is already in the queue to avoid duplicates
            const blockType = WorldData.getBlockType(col, row); // get the block type to check if it's a type that participates in water simulation
            if (blockType !== null && (blockType === Config.BLOCK_AIR || blockType === Config.BLOCK_WATER)) { // add to queue only if it's BLOCK_AIR or BLOCK_WATER
                waterUpdateQueue.set(key, {c: col, r: row});
            }
        }
    }
}
function internalSetBlock(col, row, blockType, isPlayerPlaced = false) { // creates a block in grid data and trigger redraw
    const success = WorldData.setBlock(col, row, blockType, isPlayerPlaced); // use setBlock from WorldData to update the underlying data structure
    if (success) {
        updateStaticWorldAt(col, row); // update the static visual cache on block data change.
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // trigger water simulation if below waterline
            let addedToQueue = false;
            const tryAddCandidate = (c, r) => { // helper to add candidate and track if anything was actually added
                const initialSize = waterUpdateQueue.size;
                addWaterUpdateCandidate(c, r); // handle bound, type, and existence checks
                if (waterUpdateQueue.size > initialSize) {
                    addedToQueue = true; // flag if queue size increased
                }
            };
            tryAddCandidate(col, row); // add changed cell
            const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // propagate water away from new solid block, or into/away from a new AIR/WATER block
            neighbors.forEach(neighbor => tryAddCandidate(col + neighbor.dc, row + neighbor.dr));
            if (addedToQueue) { // reset the propagation timer IF any candidates were added
                waterPropagationTimer = 0; // force timer to zero
            }
        }
    } else {
        console.log(`[WaterMgr] Failed to set block data at [${col}, ${row}].`);
    }
    return success;
}
function renderStaticWorldToGridCanvas() { // draw entire static world to off-screen canvas
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
            const block = worldGrid[r][c];
            if (!block || typeof block === 'number' && block === Config.BLOCK_AIR) continue; // check for BLOCK_AIR (number 0) or null/undefined
            const blockType = typeof block === 'object' ? block.type : block; // get type property or use block value
            const blockColor = Config.BLOCK_COLORS[blockType];
            if (!blockColor) {
                console.error(`No color defined for block type ${blockType} at [${c}, ${r}]`);
                continue;
            }
            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const blockW = Math.ceil(Config.BLOCK_WIDTH);
            const blockH = Math.ceil(Config.BLOCK_HEIGHT);
            gridCtx.fillStyle = blockColor; // draw block body onto grid canvas using gridCtx
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // draw outline if player placed
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
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) { // draw damage indicators if block object exists and has HP properties, 
                const hpRatio = block.hp / block.maxHp;             
                gridCtx.save(); // save context state before drawing lines
                gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                gridCtx.lineCap = 'square'; // use square cap
                const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // draw slash (\) if HP is <= 70%
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                    gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();
                }
                if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_X) { // draw second line (/) if HP is <= 30% (creating an 'X')
                    gridCtx.beginPath();
                    gridCtx.moveTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY) + pathInset); // move to inset top-right, draw to inset bottom-left
                    gridCtx.lineTo(Math.floor(blockX) + pathInset, Math.floor(blockY + blockH) - pathInset);
                    gridCtx.stroke();
                }
                gridCtx.restore(); // restore context state
            }
        }
    }
}
export function updateStaticWorldAt(col, row) { // clear block's area and redraw it (if not air), including damage indicators
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx) {
        console.error(`WorldManager: Cannot update static world at [${col}, ${row}] - grid context missing!`);
        return;
    }
    const block = WorldData.getBlock(col, row); // get block data *after* it has been updated in WorldData
    const blockX = col * Config.BLOCK_WIDTH;
    const blockY = row * Config.BLOCK_HEIGHT;
    const blockW = Math.ceil(Config.BLOCK_WIDTH); // use Math.ceil for robustness
    const blockH = Math.ceil(Config.BLOCK_HEIGHT);
    gridCtx.clearRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH); // always clear exact block area before redrawing
    if (block !== Config.BLOCK_AIR && block !== null) { // if block is NOT air and NOT null (out of bounds), redraw it
        const currentBlockType = typeof block === 'object' ? block.type : block;
        const blockColor = Config.BLOCK_COLORS[currentBlockType];
        if (blockColor) {
            gridCtx.fillStyle = blockColor; // draw block body
            gridCtx.fillRect(Math.floor(blockX), Math.floor(blockY), blockW, blockH);
            const isPlayerPlaced = block && typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // draw outline if player placed
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
            if (block && typeof block === 'object' && block.maxHp > 0 && block.hp < block.maxHp) { // draw inset damage indicators
                 const hpRatio = block.hp / block.maxHp;
                 gridCtx.save(); // save context state before drawing lines
                 gridCtx.strokeStyle = Config.BLOCK_DAMAGE_INDICATOR_COLOR;
                 gridCtx.lineWidth = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH;
                 gridCtx.lineCap = 'square'; // use square cap
                 const pathInset = Config.BLOCK_DAMAGE_INDICATOR_LINE_WIDTH; // calculate effective inset for line path points
                 if (hpRatio <= Config.BLOCK_DAMAGE_THRESHOLD_SLASH) { // draw slash (\) if HP is <= 70%
                      gridCtx.beginPath();
                      gridCtx.moveTo(Math.floor(blockX) + pathInset, Math.floor(blockY) + pathInset); // move to inset top-left, draw to inset bottom-right
                      gridCtx.lineTo(Math.floor(blockX + blockW) - pathInset, Math.floor(blockY + blockH) - pathInset);
                      gridCtx.stroke();
                 }
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
function seedWaterUpdateQueue() { // seed queue with initial water blocks and adjacent air candidates below waterline
    waterUpdateQueue.clear(); // start fresh
    for (let r = Config.WORLD_WATER_LEVEL_ROW_TARGET; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) { // add any block AT or below the waterline threshold that is AIR or WATER
            addWaterUpdateCandidate(c, r); // handles bounds, queue.has check, and whether block type is valid for being in the queue
        }
    }
}
export function applyAging(portalRef, intensityFactor) {
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return;
    }

    const grid = WorldData.getGrid(); // Get grid array
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return;
    }

    const clampedIntensity = Math.max(0.0, intensityFactor); // Ensure non-negative intensity
    // If intensity is effectively zero, skip the whole process.
    if (clampedIntensity <= 0) {
        console.log("Aging intensity is zero, skipping aging pass.");
        return;
    }

    console.log(`Applying Aging (Intensity: ${clampedIntensity.toFixed(2)})`);

    // Get portal position and calculate protected radius
    let portalX = -Infinity, portalY = -Infinity;
    let protectedRadiusSq = 0; // Default to 0 radius if no portal
    if (portalRef) {
        const portalPos = portalRef.getPosition(); // Gets the center of the portal rectangle
        portalX = portalPos.x;
        portalY = portalPos.y;
        const currentSafetyRadius = portalRef.safetyRadius; // Use the dynamic safety radius from the portal instance
        protectedRadiusSq = currentSafetyRadius * currentSafetyRadius; // Square it for distance comparison
    } else {
        // Fallback to screen center and a default radius if no portal reference is provided.
        // This shouldn't happen in normal gameplay flow once portal is initialized,
        // but it's a safeguard.
        portalX = Config.CANVAS_WIDTH / 2;
        portalY = Config.CANVAS_HEIGHT / 2;
        protectedRadiusSq = Config.PORTAL_SAFETY_RADIUS * Config.PORTAL_SAFETY_RADIUS; // Use initial config value as fallback
        console.warn(`No Portal Ref: Using Screen Center for Protected Zone: Center (${portalX.toFixed(1)}, ${portalY.toFixed(1)}), Radius ${Math.sqrt(protectedRadiusSq).toFixed(1)}`);
    }

    let changesCount = 0; // track how many blocks change

    // Iterate through ALL cells - we still need to check every cell to see if it's outside the radius
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {

            // --- Protected Zone Check ---
            const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
            const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
            const dx = blockCenterX - portalX;
            const dy = blockCenterY - portalY;
            const distSqToPortal = dx * dx + dy * dy;

            // If the block is within the protected zone, skip it entirely.
            if (distSqToPortal <= protectedRadiusSq) {
                continue;
            }
            // --- End Protected Zone Check ---


            // --- Aging Logic (Only applies to blocks OUTSIDE the protected zone) ---

            const block = WorldData.getBlock(c, r); // Get block data (object or AIR constant)
            // If it's null (out of bounds) or already air, we generally don't change it *itself*.
            // However, other blocks changing can affect AIR blocks (e.g. erosion creates AIR, sedimentation fills AIR).
            // We still need to process rules that might CHANGE the block *into* AIR, or fill it *from* AIR.
            // The current structure handles this: the switch processes `originalType`, and if `newType` is different, it's set.
            // So, AIR itself doesn't age based on `case Config.BLOCK_AIR:`, but other blocks can become AIR.
            // We still need to check `block === null` for out of bounds safety.
            if (block === null) continue; // Skip out of bounds (getBlock returns null)


            const originalType = (typeof block === 'object') ? block.type : block;

            let newType = originalType; // Start assuming no change

            const depth = r * Config.BLOCK_HEIGHT; // Calculate depth in pixels

            // Use Perlin noise value to add local variation to probability *scaling*.
            // It makes aging more likely in some noisy patches than others, even outside the radius.
            const noiseVal = agingNoiseGenerator.noise(c * Config.AGING_NOISE_SCALE + r * Config.AGING_NOISE_SCALE * 0.1);
            const scaledNoise = (noiseVal + 1) / 2; // Scale noise to [0, 1]


            // Check if the block directly below is solid or if it's the bottom row.
            const hasSolidBelow = GridCollision.isSolid(c, r + 1) || r + 1 >= Config.GRID_ROWS;


            // --- Aging Rules Switch ---
            // These rules now use random chance again, scaled by noise, intensity, and local conditions.

            switch (originalType) {
                case Config.BLOCK_AIR:
                    // Rules for AIR blocks: Can become Dirt/Grass (growth) or Sand (sedimentation).
                    // Only happens if there's solid ground below
                    if (hasSolidBelow) {
                         if (r < Config.WORLD_WATER_LEVEL_ROW_TARGET) { // ABOVE the initial water line (Growth)
                            // Growth Probability: Base chance * noise (for patchiness) * intensity
                             const growthProb = Config.AGING_PROB_GROWTH_SURFACE_AIR * scaledNoise * clampedIntensity;
                              if (Math.random() < growthProb) { // Apply random chance
                                   // Grow Grass if neighbor below is Dirt/Grass, otherwise grow Dirt.
                                   const blockBelowType = WorldData.getBlockType(c, r+1);
                                    if(blockBelowType === Config.BLOCK_DIRT || blockBelowType === Config.BLOCK_GRASS) {
                                        newType = Config.BLOCK_GRASS;
                                    } else {
                                        newType = Config.BLOCK_DIRT;
                                    }
                              }
                         } else { // AT or BELOW the initial water line (Sedimentation)
                            // Sedimentation Probability: Happens if there's solid ground below.
                            // Influenced by noise and intensity, and slightly by adjacent solids.
                             const adjacentSolids = (GridCollision.isSolid(c, r - 1) ? 1 : 0) + (GridCollision.isSolid(c, r + 1) ? 1 : 0) + (GridCollision.isSolid(c - 1, r) ? 1 : 0) + (GridCollision.isSolid(c + 1, r) ? 1 : 0);
                            const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * scaledNoise * clampedIntensity * (1 + adjacentSolids * 0.2); // Include adjacent influence
                            if (Math.random() < sedimentationProb) { // Apply random chance
                                newType = Config.BLOCK_SAND; // Turns into Sand
                            }
                        }
                    }
                    break;

                case Config.BLOCK_WATER:
                    // Rules for WATER blocks: Can become Sand (sedimentation).
                    // Only apply aging to water below the initial water line.
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                        // Sedimentation Probability: Same logic as AIR sedimentation underwater.
                        if (hasSolidBelow) {
                            const adjacentSolids = (GridCollision.isSolid(c, r - 1) ? 1 : 0) + (GridCollision.isSolid(c, r + 1) ? 1 : 0) + (GridCollision.isSolid(c - 1, r) ? 1 : 0) + (GridCollision.isSolid(c + 1, r) ? 1 : 0);
                            const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * scaledNoise * clampedIntensity * (1 + adjacentSolids * 0.2); // Include adjacent influence
                            if (Math.random() < sedimentationProb) { // Apply random chance
                                newType = Config.BLOCK_SAND; // Turns into Sand
                            }
                        }
                    }
                    break;

                case Config.BLOCK_DIRT: // Intentional fall-through to handle GRASS similarly for deep aging
                case Config.BLOCK_GRASS:
                    // Rules for DIRT/GRASS: Can erode (if exposed) or stoneify (if deep).
                    // Check if exposed to AIR or WATER (any cardinal neighbor).
                    const isExposedDirtGrass = WorldData.getBlockType(c, r - 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r - 1) === Config.BLOCK_WATER ||
                                      WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r + 1) === Config.BLOCK_WATER ||
                                      WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c - 1, r) === Config.BLOCK_WATER ||
                                      WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c + 1, r) === Config.BLOCK_WATER;

                    // Erosion: Primarily above water.
                    if (isExposedDirtGrass && r < Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                         // Erosion Probability: Base chance * noise * intensity
                         const erosionProb = Config.AGING_PROB_EROSION_EXPOSED_DIRT * scaledNoise * clampedIntensity;
                          if (Math.random() < erosionProb) { // Apply random chance
                              newType = Config.BLOCK_AIR; // Erodes to Air
                          }
                    }
                    // Stoneification: Happens only at sufficient depth.
                    else if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                        // Stoneification Probability: Base chance * noise * intensity
                        const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP_DIRT_SAND * scaledNoise * clampedIntensity;
                         if (Math.random() < stoneProb) { // Apply random chance
                             newType = Config.BLOCK_STONE; // Turns to Stone
                         }
                    }
                    // TODO: Underwater dirt/grass could erode into Sand or turn to Sand?
                    break;

                case Config.BLOCK_SAND:
                    // Rules for SAND: Can erode (if exposed) or stoneify (if deep).
                    // Check if exposed to AIR or WATER (any cardinal neighbor).
                    const isExposedSand =   WorldData.getBlockType(c, r - 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r - 1) === Config.BLOCK_WATER ||
                                            WorldData.getBlockType(c, r + 1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r + 1) === Config.BLOCK_WATER ||
                                            WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c - 1, r) === Config.BLOCK_WATER ||
                                            WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR || WorldData.getBlockType(c + 1, r) === Config.BLOCK_WATER;

                    // Erosion: Sand erodes more easily than dirt.
                    if (isExposedSand) {
                        // Erosion Probability: Higher base chance * noise * intensity
                        const erosionProb = Config.AGING_PROB_EROSION_EXPOSED_SAND * scaledNoise * clampedIntensity;
                        if (Math.random() < erosionProb) { // Apply random chance
                            // Erodes to Water if underwater, Air if above water.
                            newType = r >= Config.WORLD_WATER_LEVEL_ROW_TARGET ? Config.BLOCK_WATER : Config.BLOCK_AIR;
                        }
                    }
                    // Stoneification: Same depth conditions as Dirt/Grass.
                    else if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                        // Stoneification Probability: Base chance * noise * intensity
                        const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP_DIRT_SAND * scaledNoise * clampedIntensity;
                        if (Math.random() < stoneProb) { // Apply random chance
                            newType = Config.BLOCK_STONE; // Turns to Stone
                        }
                    }
                    break;

                // TODO: Add rules for other block types (Wood, Metal, Bone, etc.)
                // Example: Stone surface erosion (rare)
                case Config.BLOCK_STONE:
                     const isSurfaceStone = WorldData.getBlockType(c, r-1) === Config.BLOCK_AIR || WorldData.getBlockType(c, r-1) === Config.BLOCK_WATER;
                     if (isSurfaceStone) {
                          const stoneErosionProb = Config.AGING_PROB_EROSION_SURFACE_STONE * scaledNoise * clampedIntensity;
                          if (Math.random() < stoneErosionProb) { // Apply random chance
                              newType = Config.BLOCK_AIR; // Or maybe turn to Sand?
                          }
                     }
                    break;
                // Add cases for WOOD, METAL, BONE aging here, using similar patterns (check exposure/depth, apply probability scaled by noise/intensity)

                default:
                    // Block types that currently have no specific aging rules remain unchanged.
                    // This includes player-placed blocks *outside* the radius if they don't have a specific rule defined here.
                    break;
            }

            // --- Apply Change and Update Visuals/Water ---
            // If the aging rule decided to change the block type
            if (newType !== originalType) {
                // Preserve the playerPlaced status of the original block if it existed and was player-placed
                const isPlayerPlaced = typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false;

                // Update the block data in the grid. setBlock handles creating the block object structure and HP.
                const success = WorldData.setBlock(c, r, newType, isPlayerPlaced);

                if (success) {
                    updateStaticWorldAt(c, r); // Redraw this single block on the static canvas

                    // If the change is below the water line, queue it and its neighbors for water simulation updates
                    // Water propagation is still needed even with probabilistic aging, as changes can create new spaces for water.
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                        addWaterUpdateCandidate(c, r); // Queue the changed cell itself
                        // Queue adjacent cells as they might now border the water simulation area or need updates
                        addWaterUpdateCandidate(c, r - 1);
                        addWaterUpdateCandidate(c, r + 1);
                        addWaterUpdateCandidate(c - 1, r);
                        addWaterUpdateCandidate(c + 1, r);
                        // Reset the water propagation timer to force an immediate update cycle
                        waterPropagationTimer = 0;
                    }
                    changesCount++; // Increment the count of changes
                }
            }
        }
    }
    console.log(`Aging pass complete. ${changesCount} blocks changed.`);
}

export function placePlayerBlock(col, row, blockType) { // sets player-placed block - assumes validity checks (range, clear, neighbor) are done by the Player class
    const success = WorldData.setBlock(col, row, blockType, true);
    if (success) {
        updateStaticWorldAt(col, row); // update visual cache
        if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // trigger water sim if below waterline
             addWaterUpdateCandidate(col, row); // queue changed block
             addWaterUpdateCandidate(col, row - 1); // queue neighbours
             addWaterUpdateCandidate(col, row + 1);
             addWaterUpdateCandidate(col - 1, row);
             addWaterUpdateCandidate(col + 1, row);
             waterPropagationTimer = 0; // reset timer
        }
    }
    return success;
}
export function damageBlock(col, row, damageAmount) { // applies damage to block at given coordinates - if block drops to 0 HP, replace with AIR and drop material
    if (damageAmount <= 0) return false; // zero damage dealt
    const block = WorldData.getBlock(col, row);
    if (!block || typeof block !== 'object' || block.type === Config.BLOCK_AIR || block.type === Config.BLOCK_WATER || !block.hasOwnProperty('hp') || block.hp === Infinity) {
        return false; // check if block is a valid object and breakable
    }
    block.hp -= damageAmount; // apply damage
    updateStaticWorldAt(col, row); // redraw the block on the static canvas with updated damage indicator
    let wasDestroyed = false;
    if (block.hp <= 0) { // check for destruction
        wasDestroyed = true;
        block.hp = 0; // ensure health doesn't go below zero in data
        let dropType = null; // determine drop type
        switch (block.type) { // use current type from object
            case Config.BLOCK_GRASS: dropType = 'dirt'; break;
            case Config.BLOCK_DIRT:  dropType = 'dirt'; break;
            case Config.BLOCK_STONE: dropType = 'stone'; break;
            case Config.BLOCK_SAND:  dropType = 'sand'; break;
            case Config.BLOCK_WOOD: dropType = 'wood'; break;
             case Config.BLOCK_BONE: dropType = 'bone'; break;
             case Config.BLOCK_METAL: dropType = 'metal'; break;
             // TODO: add other block types and their drops
        }
        if (dropType) { // spawn drop (if any)
            const dropX = col * Config.BLOCK_WIDTH + (Config.BLOCK_WIDTH / 2); // position slightly off-center and random within the block bounds
            const dropY = row * Config.BLOCK_HEIGHT + (Config.BLOCK_HEIGHT / 2);
            const offsetX = (Math.random() - 0.5) * Config.BLOCK_WIDTH * 0.4; // random offset
            const offsetY = (Math.random() - 0.5) * Config.BLOCK_HEIGHT * 0.4;
             if (!isNaN(dropX) && !isNaN(dropY) && typeof dropX === 'number' && typeof dropY === 'number') { // ensure coordinates are valid before spawning
                 ItemManager.spawnItem(dropX + offsetX, dropY + offsetY, dropType);
             } else {
                 console.error(`ITESPAWN FAILED: Invalid drop coordinates [${dropX}, ${dropY}] for ${dropType} from destroyed block at [${col}, ${row}].`);
             }
        }
        const isPlayerPlaced = typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // replace block with air
        const success = WorldData.setBlock(col, row, Config.BLOCK_AIR, isPlayerPlaced); // keep playerPlaced status
        if (success) { // WorldData.setBlock returned true
            updateStaticWorldAt(col, row); // update/ clear block area static visual cache
             if (row >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // trigger water simulation
                 addWaterUpdateCandidate(col, row); // queue changed block itself
                 addWaterUpdateCandidate(col, row - 1); // and neighbors
                 addWaterUpdateCandidate(col, row + 1);
                 addWaterUpdateCandidate(col - 1, row);
                 addWaterUpdateCandidate(col + 1, row);
                 waterPropagationTimer = 0; // reset timer
             }
        }
    }
    return true; // damage applied, regardless of destruction
}
export function draw(ctx) { // draw pre-rendered static world onto main canvas
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
        if (waterPropagationTimer <= 0 && waterUpdateQueue.size > 0) { // only process water flow if there are candidates and a timer ready
            waterPropagationTimer = Config.WATER_PROPAGATION_DELAY; // reset timer
            const candidatesToProcess = Array.from(waterUpdateQueue.values()).slice(0, Config.WATER_UPDATES_PER_FRAME); // process candidates from queue in a slicable array
            candidatesToProcess.sort((a, b) => b.r - a.r); // sort candidates to process cells in lower rows (higher 'r' value) first
            candidatesToProcess.forEach(({c, r}) => { // remove processed candidates from queue before processing batch to prevent infinite re-queuing
                const key = `${c},${r}`;
                waterUpdateQueue.delete(key);
            });
            candidatesToProcess.forEach(({c, r}) => { // process batch of candidates
                if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) return; // recheck bounds, as blocks may've been changed since queueing
                const currentBlockType = WorldData.getBlockType(c, r); // add neighbours below waterline to the queue
                const neighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // cardinal neighbours
                neighbors.forEach(neighbor => {
                     const nc = c + neighbor.dc;
                     const nr = r + neighbor.dr;
                     addWaterUpdateCandidate(nc, nr);
                });
                if (currentBlockType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { // only process filling if current cell is still AIR
                    let adjacentToWater = false; // check current neighbours for water
                    const immediateNeighbors = [{dc: 0, dr: 1}, {dc: 0, dr: -1}, {dc: 1, dr: 0}, {dc: -1, dr: 0}]; // cardinal neighbours again
                     for (const neighbor of immediateNeighbors) {
                        const nc = c + neighbor.dc;
                        const nr = r + neighbor.dr;
                        if (nc >= 0 && nc < Config.GRID_COLS && nr >= 0 && nr < Config.GRID_ROWS && WorldData.getBlockType(nc, nr) === Config.BLOCK_WATER) { // check if neighbour is WATER within bounds
                            adjacentToWater = true;
                            break; // found water neighbour
                        }
                    }
                    if (adjacentToWater) {
                        const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false); // water flows; not player-placed
                        if (success) {
                            updateStaticWorldAt(c, r); // queue neighbours for water spread
                            addWaterUpdateCandidate(c, r-1); // above
                            addWaterUpdateCandidate(c, r+1); // below
                            addWaterUpdateCandidate(c-1, r); // left
                            addWaterUpdateCandidate(c+1, r); // right
                            waterPropagationTimer = 0; // reset timer
                        }
                    }
                }
                if (currentBlockType === Config.BLOCK_WATER) { // logic for WATER to propagate
                    const blockBelowType = WorldData.getBlockType(c, r + 1); // if there is AIR directly below this water block, queue that AIR block.
                    if (blockBelowType === Config.BLOCK_AIR) {
                        addWaterUpdateCandidate(c, r + 1); // queue air block below
                    }
                    const blockBelow = WorldData.getBlock(c, r + 1); // check for sideways flow over solid ground: if block below is solid OR water AND side block is air
                    const blockBelowResolvedType = blockBelow?.type ?? Config.BLOCK_AIR; // use resolved type, handle null/0
                    const isBelowSolidOrWater = blockBelow !== null && (blockBelowResolvedType !== Config.BLOCK_AIR); // is block below something that would act as a "floor"?
                    if (isBelowSolidOrWater) { // if there's solid ground or water directly below, water can try to flow sideways
                        if (WorldData.getBlockType(c - 1, r) === Config.BLOCK_AIR) { // check left
                            addWaterUpdateCandidate(c - 1, r); // queue air block to left
                        }
                        if (WorldData.getBlockType(c + 1, r) === Config.BLOCK_AIR) { // check right
                            addWaterUpdateCandidate(c + 1, r); // queue air block to right
                        }
                    }
                }
            });
        } else if (waterPropagationTimer <= 0 && waterUpdateQueue.size === 0) {
           // console.log("[WaterMgr] Water update timer ready, but queue is empty.");
        } else if (waterPropagationTimer > 0) {
           // console.log(`[WaterMgr] Water update timer active: ${waterPropagationTimer.toFixed(2)}s remaining.`);
        }
    }