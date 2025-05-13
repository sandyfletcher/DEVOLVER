// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './utils/config.js';
import { PerlinNoise } from './utils/noise.js'; // Import noise utility
import * as World from './utils/world.js'; // Import world data access
import * as GridCollision from './utils/gridCollision.js'; // Import solid checks, hasSolidNeighbor
import { createBlock } from './utils/block.js'; // Import createBlock

let agingNoiseGenerator = null; // dedicated noise instance for aging
let allGravityChangesFromAgingThisPass = []; // This will store gravity changes from aging, to be returned by applyAging

export function init() { // initialize the dedicated noise generator for aging
    agingNoiseGenerator = new PerlinNoise(Math.random()); // different seed each time
}

// Helper function to get neighbor block types
function getNeighborTypes(c, r) {
     const neighborTypes = {};
     // Cardinal directions
     neighborTypes.above = World.getBlockType(c, r - 1);
     neighborTypes.below = World.getBlockType(c, r + 1);
     neighborTypes.left = World.getBlockType(c - 1, r);
     neighborTypes.right = World.getBlockType(c + 1, r);
     // Diagonal for canopy checks if needed later
     // neighborTypes.aboveLeft = World.getBlockType(c - 1, r - 1);
     // neighborTypes.aboveRight = World.getBlockType(c + 1, r - 1);
     // neighborTypes.belowLeft = World.getBlockType(c - 1, r + 1);
     // neighborTypes.belowRight = World.getBlockType(c + 1, r + 1);
     return neighborTypes;
}

// Helper function to check exposure to a specific type (AIR or WATER)
// Optimization: Pass neighborTypes to avoid redundant calls to World.getBlockType
function isExposedTo(neighborTypes, exposedType) {
    return neighborTypes.above === exposedType ||
           neighborTypes.below === exposedType ||
           neighborTypes.left === exposedType ||
           neighborTypes.right === exposedType;
}

// Helper function to calculate the number of contiguous WATER blocks directly above a cell
function getWaterDepthAbove(c, r) {
    let depth = 0;
    // Start checking from the row directly *above* the current cell (r - 1)
    for (let checkR = r - 1; checkR >= 0; checkR--) {
        const blockType = World.getBlockType(c, checkR); // Handles out of bounds above
        if (blockType === Config.BLOCK_WATER) {
            depth++; // Count this water block
        } else {
            // Stop counting when we hit a non-water block (AIR, SOLID, or out of bounds)
            break;
        }
    }
    return depth;
}

// --- MODIFIED HELPER: Calculate *natural* vertical wood pillar height downwards ---
/**
 * Calculates the height of a contiguous vertical pillar of natural (not player-placed) WOOD blocks
 * starting from (c, r_start) and going downwards.
 * @param {number} c Column index.
 * @param {number} r_start Starting row index.
 * @returns {number} The height of the natural wood pillar.
 */
function getNaturalWoodPillarHeightDownwards(c, r_start) {
    let height = 0;
    for (let checkR = r_start; checkR < Config.GRID_ROWS; checkR++) {
        const blockData = World.getBlock(c, checkR);
        // Check if it's a WOOD block AND not player-placed
        if (blockData && typeof blockData === 'object' && blockData.type === Config.BLOCK_WOOD && !blockData.isPlayerPlaced) {
            height++;
        } else {
            break; // Stop if not natural wood, or it's air, water, or end of grid
        }
    }
    return height;
}


// --- NEW HELPER: Place tree canopy (remains mostly the same) ---
/**
 * Places the initial tree canopy around a given trunk top position.
 * @param {number} trunkC Column of the trunk top.
 * @param {number} trunkTopR Row of the trunk top.
 * @param {number} radius Radius of the canopy (0 = 1x1, 1 = 3x3, 2 = 5x5).
 * @param {Array} changedCellsArray Array to push changes into.
 */
function placeInitialCanopy(trunkC, trunkTopR, radius, changedCellsArray) {
    if (radius < 0) return; // No canopy if radius is negative

    const centerR = trunkTopR - 1; // Canopy center is typically one block above the trunk top

    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            // Skip the very center if radius > 0? Maybe keep it simple and fill center too.
            // Optional: Create a more rounded shape by checking distance: if (dc*dc + dr*dr > radius*radius) continue;

            const c = trunkC + dc;
            const r = centerR + dr;

            // Check bounds
            if (r < 0 || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS) {
                continue;
            }

            const currentBlockType = World.getBlockType(c, r);
            // Place canopy only in AIR blocks
            if (currentBlockType === Config.BLOCK_AIR) {
                const success = World.setBlock(c, r, Config.BLOCK_VEGETATION, false); // Trees are not player placed
                if (success) {
                    const blockAfterChange = World.getBlock(c, r);
                    changedCellsArray.push({
                        c, r,
                        oldBlockType: Config.BLOCK_AIR,
                        newBlockType: Config.BLOCK_VEGETATION,
                        finalBlockData: blockAfterChange
                    });
                }
            }
        }
    }
}

// --- NEW HELPER: Check if a WOOD block is likely part of a tree trunk (remains the same) ---
/**
 * Heuristic check if a wood block is part of a tree trunk.
 * Checks for wood below and vegetation/air above.
 * @param {number} c Column index.
 * @param {number} r Row index.
 * @returns {boolean} True if likely part of a tree trunk.
 */
function isLikelyTreeTrunk(c, r) {
    const blockType = World.getBlockType(c, r);
    if (blockType !== Config.BLOCK_WOOD) return false;

    const typeBelow = World.getBlockType(c, r + 1);
    const typeAbove = World.getBlockType(c, r - 1);

    // It's wood, has wood or solid ground below, and has vegetation or air above
    const hasSupport = (typeBelow === Config.BLOCK_WOOD || GridCollision.isSolid(c, r + 1)); // Check solid for base
    const hasCanopyOrAirAbove = (typeAbove === Config.BLOCK_VEGETATION || typeAbove === Config.BLOCK_AIR || typeAbove === null); // null means top of world

    return hasSupport && hasCanopyOrAirAbove;
}

// --- NEW HELPER: Expand tree canopy (remains the same) ---
/**
 * Tries to expand the canopy around a given vegetation block.
 * @param {number} canopyC Column of the canopy block.
 * @param {number} canopyR Row of the canopy block.
 * @param {Array} changedCellsArray Array to push changes into.
 * @returns {boolean} True if expansion occurred.
 */
function expandCanopy(canopyC, canopyR, changedCellsArray) {
    const neighbors = [
        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
        { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
        // Optional: Add diagonals for faster/bushier growth
        { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
        { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
    ];

    let expansionOccurred = false;

    for (const offset of neighbors) {
        const nc = canopyC + offset.dc;
        const nr = canopyR + offset.dr;

        // Basic bounds check
        if (nr < 0 || nr >= Config.GRID_ROWS || nc < 0 || nc >= Config.GRID_COLS) {
            continue;
        }

        // TODO: Implement max radius check - more complex, needs tree origin
        // For now, just expand into adjacent air

        if (World.getBlockType(nc, nr) === Config.BLOCK_AIR) {
            if (Math.random() < Config.AGING_PROB_TREE_CANOPY_GROW) {
                const success = World.setBlock(nc, nr, Config.BLOCK_VEGETATION, false);
                if (success) {
                    const blockAfterChange = World.getBlock(nc, nr);
                    changedCellsArray.push({
                        c: nc, r: nr,
                        oldBlockType: Config.BLOCK_AIR,
                        newBlockType: Config.BLOCK_VEGETATION,
                        finalBlockData: blockAfterChange
                    });
                    expansionOccurred = true;
                    // Maybe only expand one block per tick per original canopy block?
                    // break; // Uncomment to limit growth to one new block per original block per aging pass
                }
            }
        }
    }
    return expansionOccurred;
}


// --- Main Aging Function ---
/**
 * Applies aging effects (erosion, growth, stoneification, etc.) to the world grid.
 * Aging is probabilistic and influenced by environment.
 * Protected radius around the portal is applied *only if* portalRef is provided.
 * @param {Portal | null} portalRef - Reference to the Portal instance (or null if none).
 * @returns {{visualChanges: Array<{c: number, r: number, oldBlockType: number, newBlockType: number, finalBlockData: object | number}>, gravityChanges: Array<{c: number, r_start: number, r_end: number, blockData: object}>}} - Object containing arrays of detailed visual changes and gravity changes.
 */
export function applyAging(portalRef) {
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return { visualChanges: [], gravityChanges: [] }; // Return structure
    }
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return { visualChanges: [], gravityChanges: [] }; // Return structure
    }

    let changedCellsAndTypes = []; // This will be part of the return
    allGravityChangesFromAgingThisPass = []; // Reset for this pass

    for (let r = 0; r < Config.GRID_ROWS; r++) { // iterate through ALL cells
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (portalRef) { // Portal protection check
                 const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                 const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                 const portalCenter = portalRef.getPosition();
                 const portalX = portalCenter.x;
                 const portalY = portalCenter.y;
                 const protectedRadiusSq = portalRef.safetyRadius * portalRef.safetyRadius;
                 const dx = blockCenterX - portalX;
                 const dy = blockCenterY - portalY;
                 const distSqToPortal = dx * dx + dy * dy;
                 if (distSqToPortal < protectedRadiusSq) {
                      continue; // Skip aging within portal safety radius
                 }
            }

            // Get the state of the block *at the start* of considering this cell (c, r)
            const blockBeforeChange = World.getBlock(c, r); // Get full block data
             // Skip if block is null (shouldn't happen with initialization)
            if (blockBeforeChange === null) continue;
            const originalType = (typeof blockBeforeChange === 'object') ? blockBeforeChange.type : blockBeforeChange;

            // Determine environmental factors based on the *current* world state
            const neighborTypes = getNeighborTypes(c, r);
            const isExposedToAir = isExposedTo(neighborTypes, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(neighborTypes, Config.BLOCK_WATER);
            const waterDepthAbove = getWaterDepthAbove(c, r);

            let newType = originalType; // Start with the original type
            let blockPlacedThisTurn = null; // Store data of block placed by a rule in this iteration

            // ==============================================================
            // --- START OF AGING RULES ---
            // Rules are evaluated based on the block's `originalType`.
            // Changes are applied to `newType` and then committed at the end.
            // ==============================================================

            // Rule 1: SAND Erosion (Highest Priority)
            if (originalType === Config.BLOCK_SAND) {
                 if (waterDepthAbove > 0) { // Water erosion takes precedence
                      if (Math.random() < Config.AGING_PROB_WATER_EROSION_SAND) {
                           newType = Config.BLOCK_WATER;
                      }
                 } else if (isExposedToAir) { // Air erosion only if not eroded by water
                      if (Math.random() < Config.AGING_PROB_AIR_EROSION_SAND) {
                            newType = Config.BLOCK_AIR;
                       }
                 }
            }

            // Rule 1.5: DIRT/VEGETATION Water Erosion -> SAND
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION)) {
                 if (waterDepthAbove > 0) {
                      if (Math.random() < Config.AGING_PROB_WATER_EROSION_DIRT_VEGETATION) {
                           newType = Config.BLOCK_SAND;
                      }
                 }
            }

            // Rule 2.1: DIRT -> VEGETATION Growth
            if (newType === originalType && originalType === Config.BLOCK_DIRT) {
                 const isBelowSolidAndWithinBounds = GridCollision.isSolid(c, r + 1);
                 if (isExposedToAir && !isExposedToWater && isBelowSolidAndWithinBounds) {
                      let airSidesCount = 0;
                      if (neighborTypes.above === Config.BLOCK_AIR) airSidesCount++;
                      if (neighborTypes.left === Config.BLOCK_AIR) airSidesCount++;
                      if (neighborTypes.right === Config.BLOCK_AIR) airSidesCount++;
                      let growthProb = Config.AGING_PROB_VEGETATION_GROWTH_BASE;
                      growthProb += Math.min(airSidesCount, Config.AGING_MAX_AIR_SIDES_FOR_VEGETATION_BONUS) * Config.AGING_PROB_VEGETATION_GROWTH_PER_AIR_SIDE;
                      if (Math.random() < growthProb) {
                           newType = Config.BLOCK_VEGETATION;
                      }
                 }
            }

            // --- Rule 2.2: VEGETATION -> Grow Upwards / Form Tree (MODIFIED) ---
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                const blockAboveType = neighborTypes.above;
                const hasSolidBelow = GridCollision.isSolid(c, r + 1);

                if (blockAboveType === Config.BLOCK_AIR && hasSolidBelow) {
                    // Check probability for upward growth
                    if (Math.random() < Config.AGING_PROB_VEGETATION_GROW_UP) {
                        // Attempt to place vegetation above
                        const growUpR = r - 1;
                        if (growUpR >= 0) { // Ensure not growing off the top of the map
                            const successGrowUp = World.setBlock(c, growUpR, Config.BLOCK_VEGETATION, false);
                            if (successGrowUp) {
                                blockPlacedThisTurn = World.getBlock(c, growUpR); // Get the newly placed block data
                                changedCellsAndTypes.push({
                                    c: c, r: growUpR,
                                    oldBlockType: Config.BLOCK_AIR,
                                    newBlockType: Config.BLOCK_VEGETATION,
                                    finalBlockData: blockPlacedThisTurn
                                });

                                // --- NEW TREE FORMATION CONDITION ---
                                const treeFormationCheckTopR = growUpR; // Top of the potential 4-block trunk
                                let vegetationCountInArea = 0;
                                const TREE_FORMATION_CHECK_DEPTH = 4; // How many rows down to check (total 4 rows including start)
                                const TREE_FORMATION_VEGETATION_THRESHOLD = 10; // Min vegetation blocks in 3x4 area
                                const TRUNK_SEGMENT_ON_FORMATION_HEIGHT = 4; // Height of wood blocks to form

                                // Check 3-column wide, TREE_FORMATION_CHECK_DEPTH deep area
                                for (let dr_check = 0; dr_check < TREE_FORMATION_CHECK_DEPTH; dr_check++) {
                                    const check_r_area = treeFormationCheckTopR + dr_check;
                                    if (check_r_area >= Config.GRID_ROWS) break; // Don't check out of bounds

                                    for (let dc_check = -1; dc_check <= 1; dc_check++) { // Columns c-1, c, c+1
                                        const check_c_area = c + dc_check;
                                        if (check_c_area < 0 || check_c_area >= Config.GRID_COLS) continue; // Skip out of bounds columns

                                        if (World.getBlockType(check_c_area, check_r_area) === Config.BLOCK_VEGETATION) {
                                            vegetationCountInArea++;
                                        }
                                    }
                                }

                                if (vegetationCountInArea >= TREE_FORMATION_VEGETATION_THRESHOLD) {
                                    // Condition met, form 4 wood blocks in the central column
                                    let successfullyPlacedWoodBlocks = 0;
                                    for (let h = 0; h < TRUNK_SEGMENT_ON_FORMATION_HEIGHT; h++) {
                                        const trunkR = treeFormationCheckTopR + h;
                                        if (trunkR >= Config.GRID_ROWS) break; // Don't place wood out of bounds

                                        // Ensure the block is currently vegetation before converting
                                        const oldTrunkTypeAtLoc = World.getBlockType(c, trunkR);

                                        if (oldTrunkTypeAtLoc === Config.BLOCK_VEGETATION) {
                                            // Create wood block (not player placed)
                                            const setWoodSuccess = World.setBlock(c, trunkR, Config.BLOCK_WOOD, false);
                                            if (setWoodSuccess) {
                                                successfullyPlacedWoodBlocks++;
                                                const woodBlockData = World.getBlock(c, trunkR);
                                                // Update changedCellsAndTypes: If vegetation was just placed here (e.g. growUpR), modify that entry.
                                                // Otherwise, add a new entry.
                                                let existingChangeIndex = changedCellsAndTypes.findIndex(ch => ch.c === c && ch.r === trunkR);
                                                if (existingChangeIndex !== -1) {
                                                    changedCellsAndTypes[existingChangeIndex].newBlockType = Config.BLOCK_WOOD;
                                                    changedCellsAndTypes[existingChangeIndex].finalBlockData = woodBlockData;
                                                } else {
                                                    changedCellsAndTypes.push({
                                                        c: c, r: trunkR,
                                                        oldBlockType: Config.BLOCK_VEGETATION, // Original was vegetation
                                                        newBlockType: Config.BLOCK_WOOD,
                                                        finalBlockData: woodBlockData
                                                    });
                                                }
                                            }
                                        }
                                    }

                                    // --- CHECK FOR "TOO HIGH" TREE COLLAPSE ---
                                    if (successfullyPlacedWoodBlocks > 0) { // Only check if some wood was actually placed
                                        const MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE = 15;
                                        const totalNaturalWoodPillarHeight = getNaturalWoodPillarHeightDownwards(c, treeFormationCheckTopR);

                                        if (totalNaturalWoodPillarHeight > MAX_NATURAL_TRUNK_HEIGHT_BEFORE_COLLAPSE) {
                                            // console.log(`Tree at [${c}, ${treeFormationCheckTopR}] is too tall (${totalNaturalWoodPillarHeight}). Collapsing.`);
                                            let blocksToMakeFallThisCollapse = [];
                                            // Iterate through the *natural* part of the pillar that's collapsing
                                            for (let h_fall = 0; h_fall < totalNaturalWoodPillarHeight; h_fall++) {
                                                const fallR = treeFormationCheckTopR + h_fall;
                                                if (fallR >= Config.GRID_ROWS) break;

                                                const currentBlockDataForFall = World.getBlock(c, fallR);
                                                // Ensure it's still natural wood (should be, as getNatural.. checked)
                                                if (currentBlockDataForFall && currentBlockDataForFall.type === Config.BLOCK_WOOD && !currentBlockDataForFall.isPlayerPlaced) {
                                                    // Store the block's data *before* setting to air
                                                    const fallingBlockData = { ...currentBlockDataForFall }; // Shallow copy is fine

                                                    // Set the original location to AIR immediately (logical change)
                                                    World.setBlock(c, fallR, Config.BLOCK_AIR, false);

                                                    // Calculate where this block will land
                                                    let r_end_fall = Config.GRID_ROWS - 1; // Default to bottom of map
                                                    for (let check_r_fall = fallR + 1; check_r_fall < Config.GRID_ROWS; check_r_fall++) {
                                                        if (GridCollision.isSolid(c, check_r_fall)) {
                                                            r_end_fall = check_r_fall - 1;
                                                            break;
                                                        }
                                                    }
                                                    r_end_fall = Math.max(fallR, r_end_fall); // Ensure end is not above start

                                                    blocksToMakeFallThisCollapse.push({
                                                        c: c, r_start: fallR, r_end: r_end_fall, blockData: fallingBlockData
                                                    });

                                                    // Update changedCellsAndTypes for the block that is now AIR
                                                    let collapseChangeIndex = changedCellsAndTypes.findIndex(ch => ch.c === c && ch.r === fallR);
                                                    if (collapseChangeIndex !== -1) {
                                                        // If it was already in changedCells (e.g. VEG->WOOD), update its newType to AIR
                                                        changedCellsAndTypes[collapseChangeIndex].newBlockType = Config.BLOCK_AIR;
                                                        changedCellsAndTypes[collapseChangeIndex].finalBlockData = createBlock(Config.BLOCK_AIR, false);
                                                    } else {
                                                        // If it wasn't previously changed in this pass (unlikely for just-formed trunk), add new entry
                                                        changedCellsAndTypes.push({
                                                            c: c, r: fallR,
                                                            oldBlockType: Config.BLOCK_WOOD, // It was wood before collapsing
                                                            newBlockType: Config.BLOCK_AIR,
                                                            finalBlockData: createBlock(Config.BLOCK_AIR, false)
                                                        });
                                                    }
                                                } else {
                                                    // This shouldn't happen if getNaturalWoodPillarHeightDownwards is correct
                                                    break; 
                                                }
                                            }
                                            if (blocksToMakeFallThisCollapse.length > 0) {
                                                allGravityChangesFromAgingThisPass.push(...blocksToMakeFallThisCollapse);
                                            }
                                            // NO CANOPY IF COLLAPSED
                                        } else {
                                            // Tree formed and is not too tall, place initial canopy
                                            placeInitialCanopy(c, treeFormationCheckTopR, Config.TREE_INITIAL_CANOPY_RADIUS, changedCellsAndTypes);
                                        }
                                    }
                                } // End if vegetationCount >= threshold
                            } // End if successGrowUp
                        } // End if growUpR >= 0
                    } // End if random < prob
                } // End if blockAboveType === AIR && hasSolidBelow
            } // End Rule 2.2


            // --- Rule 3: Tree Canopy Growth & Decay ---

            // Rule 3.1: Tree Canopy Growth (applied to VEGETATION blocks likely part of a canopy)
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                let isNearTrunk = false;
                for (let dr_canopy = -1; dr_canopy <= 1; dr_canopy++) {
                    for (let dc_canopy = -1; dc_canopy <= 1; dc_canopy++) {
                        if (dr_canopy === 0 && dc_canopy === 0) continue;
                        if (isLikelyTreeTrunk(c + dc_canopy, r + dr_canopy)) {
                            isNearTrunk = true;
                            break;
                        }
                    }
                    if (isNearTrunk) break;
                }

                if (isNearTrunk) {
                    expandCanopy(c, r, changedCellsAndTypes);
                }
            }

            // Rule 3.2: Tree Canopy Decay (VEGETATION -> AIR)
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                 let isNearTrunkDecay = false;
                 for (let dr_decay = -1; dr_decay <= 1; dr_decay++) {
                     for (let dc_decay = -1; dc_decay <= 1; dc_decay++) {
                         if (dr_decay === 0 && dc_decay === 0) continue;
                         if (isLikelyTreeTrunk(c + dc_decay, r + dr_decay)) {
                             isNearTrunkDecay = true;
                             break;
                         }
                     }
                     if (isNearTrunkDecay) break;
                 }
                 if (isNearTrunkDecay && Math.random() < Config.AGING_PROB_TREE_CANOPY_DECAY) {
                      newType = Config.BLOCK_AIR;
                 }
            }

            // Rule 3.3: Tree Trunk Decay (WOOD -> AIR)
             if (newType === originalType && originalType === Config.BLOCK_WOOD) {
                  if (isLikelyTreeTrunk(c, r)) { // Check if it's part of a trunk
                       if (Math.random() < Config.AGING_PROB_TREE_TRUNK_DECAY) {
                            newType = Config.BLOCK_AIR;
                       }
                  }
             }


            // Rule 4: Deep Stoneification (Dirt/Veg/Sand -> Stone)
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION || originalType === Config.BLOCK_SAND)) {
                const depthInPixels = r * Config.BLOCK_HEIGHT;
                if (depthInPixels > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                     if (Math.random() < Config.AGING_PROB_STONEIFICATION_DEEP) {
                         newType = Config.BLOCK_STONE;
                     }
                }
            }

            // Rule 5: Surface Stone Erosion (Stone -> Air)
             if (newType === originalType && originalType === Config.BLOCK_STONE) {
                 const isSurfaceStone = neighborTypes.above === Config.BLOCK_AIR || neighborTypes.above === Config.BLOCK_WATER;
                  if (isSurfaceStone) {
                       if (Math.random() < Config.AGING_PROB_EROSION_SURFACE_STONE) {
                           newType = Config.BLOCK_AIR;
                       }
                  }
             }

            // Rule 6: Underwater AIR/WATER Sedimentation -> SAND
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                 let firstSolidRowBelow = -1;
                 for (let checkR_sed = r + 1; checkR_sed < Config.GRID_ROWS; checkR_sed++) {
                     if (GridCollision.isSolid(c, checkR_sed)) {
                         firstSolidRowBelow = checkR_sed;
                         break;
                     }
                 }
                 const hasSolidBelowOrIsBottom = (firstSolidRowBelow !== -1) || (r === Config.GRID_ROWS - 1);
                 if (hasSolidBelowOrIsBottom) {
                     if (Math.random() < Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER) {
                         newType = Config.BLOCK_SAND;
                     }
                 }
             }

            // ==============================================================
            // --- END OF AGING RULES ---
            // ==============================================================


            // --- Apply Change to World if `newType` is different from `originalType` ---
            if (newType !== originalType) {
                let applyChange = true;
                if(blockPlacedThisTurn && blockPlacedThisTurn.c === c && blockPlacedThisTurn.r === r) {
                    applyChange = false;
                }

                if (applyChange) {
                    const successSetBlock = World.setBlock(c, r, newType, false);
                    if (!successSetBlock) {
                         console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                    } else {
                        const blockAfterChangeMain = World.getBlock(c, r);
                        changedCellsAndTypes.push({
                            c,
                            r,
                            oldBlockType: originalType,
                            newBlockType: newType,
                            finalBlockData: blockAfterChangeMain
                        });
                    }
                }
            }


             // --- Rule 7: SAND Sedimentation Downwards from (c, r) ---
             if (originalType === Config.BLOCK_SAND) {
                 if (waterDepthAbove > 0) {
                     const maxSandDepthBelowInBlocks = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);

                     for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelowInBlocks; potentialDepth++) {
                         const nr_sand_sed = r + potentialDepth;
                         if (nr_sand_sed >= Config.GRID_ROWS) break;

                         const targetBlockBeforeSedimentation = World.getBlock(c, nr_sand_sed);
                         const targetBlockTypeBeforeChange = (typeof targetBlockBeforeSedimentation === 'object' && targetBlockBeforeSedimentation !== null)
                             ? targetBlockBeforeSedimentation.type
                             : targetBlockBeforeSedimentation;

                         const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockTypeBeforeChange] !== undefined;

                         if (isConvertibleMaterial) {
                             if (Math.random() < Config.AGING_PROB_SAND_SEDIMENTATION_BELOW) {
                                 if (targetBlockTypeBeforeChange !== Config.BLOCK_SAND) {
                                     const successSed = World.setBlock(c, nr_sand_sed, Config.BLOCK_SAND, false);
                                     if (successSed) {
                                         const blockAfterSedimentation = World.getBlock(c, nr_sand_sed);
                                         changedCellsAndTypes.push({
                                             c: c,
                                             r: nr_sand_sed,
                                             oldBlockType: targetBlockTypeBeforeChange,
                                             newBlockType: Config.BLOCK_SAND,
                                             finalBlockData: blockAfterSedimentation
                                         });
                                     }
                                 }
                             } else {
                                break;
                             }
                         } else {
                             break;
                         }
                     }
                 }
             } // End Rule 7

        } // End column loop (c)
    } // End row loop (r)

    // Return both visual changes and any gravity changes (like falling tree trunks)
    return {
        visualChanges: changedCellsAndTypes,
        gravityChanges: allGravityChangesFromAgingThisPass
    };
} // End applyAging function