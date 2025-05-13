// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { PerlinNoise } from './utils/noise.js'; // Import noise utility
import * as World from './utils/world.js'; // Import world data access
import * as GridCollision from './utils/gridCollision.js'; // Import solid checks, hasSolidNeighbor
import { createBlock } from './utils/block.js'; // Import createBlock

let agingNoiseGenerator = null; // dedicated noise instance for aging

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

// --- NEW HELPER: Calculate vertical pillar height downwards ---
/**
 * Calculates the height of a contiguous vertical pillar of a specific block type starting from (c, r) and going downwards.
 * @param {number} c Column index.
 * @param {number} r Starting row index.
 * @param {number} pillarType The block type ID to count.
 * @returns {number} The height of the pillar (including the starting block).
 */
function getPillarHeightDownwards(c, r, pillarType) {
    let height = 0;
    for (let checkR = r; checkR < Config.GRID_ROWS; checkR++) {
        if (World.getBlockType(c, checkR) === pillarType) {
            height++;
        } else {
            break; // Stop counting when the type changes or hits AIR/WATER/OutOfBounds
        }
    }
    return height;
}

// --- NEW HELPER: Place tree canopy ---
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

// --- NEW HELPER: Check if a WOOD block is likely part of a tree trunk ---
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

// --- NEW HELPER: Expand tree canopy ---
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
 * Returns list of coordinates {c, r} that were changed by aging (for static world visual updates).
 * @param {Portal | null} portalRef - Reference to the Portal instance (or null if none).
 * @returns {Array<{c: number, r: number, oldBlockType: number, newBlockType: number, finalBlockData: object | number}>} - An array of detailed changes.
 */
export function applyAging(portalRef) { // intensityFactor removed
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return [];
    }
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return [];
    }

    let changedCellsAndTypes = [];
    // --- IMPORTANT: Create a copy of the grid state BEFORE this pass ---
    // This prevents rules applied early in the pass from affecting conditions for rules later in the same pass.
    // We'll read from the original state and write changes to the actual world grid.
    // For simplicity here, we'll read directly from World.getBlockType, which reads the current state.
    // A more robust implementation might snapshot the grid types first.

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

            // --- Skip processing AIR blocks unless needed for a specific rule (like sedimentation) ---
            // Most rules modify existing solid/vegetation blocks.
            if (originalType === Config.BLOCK_AIR && r < Config.WATER_LEVEL) { // Optimization: Skip AIR above water unless needed
                // Keep check for Underwater AIR Sedimentation (Rule 6) later
                // If other rules needed to target AIR, adjust this condition
                // continue; <-- Temporarily disabling this optimization to ensure tree growth works
            }

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

            // --- Rule Priorities ---
            // 1. Erosion (Sand -> Air/Water, Dirt/Veg -> Sand)
            // 2. Growth (Dirt -> Vegetation, Vegetation -> Upwards/Tree)
            // 3. Tree Canopy Growth / Decay
            // 4. Stoneification (Deep)
            // 5. Stone Erosion (Surface)
            // 6. Sedimentation (Underwater Air/Water -> Sand, Sand -> Deeper)


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
            // Only apply if the block wasn't already changed (e.g., from VEG to something else)
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION)) {
                 if (waterDepthAbove > 0) {
                      if (Math.random() < Config.AGING_PROB_WATER_EROSION_DIRT_VEGETATION) {
                           newType = Config.BLOCK_SAND;
                      }
                 }
            }

            // --- Rule 2: Growth ---

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

            // --- Rule 2.2: VEGETATION -> Grow Upwards / Form Tree ---
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                const blockAboveType = neighborTypes.above;
                const hasSolidBelow = GridCollision.isSolid(c, r + 1);

                if (blockAboveType === Config.BLOCK_AIR && hasSolidBelow) {
                    // Check probability for upward growth
                    if (Math.random() < Config.AGING_PROB_VEGETATION_GROW_UP) {
                        // Attempt to place vegetation above
                        const growUpR = r - 1;
                        if (growUpR >= 0) { // Ensure not growing off the top of the map
                            const success = World.setBlock(c, growUpR, Config.BLOCK_VEGETATION, false);
                            if (success) {
                                blockPlacedThisTurn = World.getBlock(c, growUpR); // Get the newly placed block data
                                changedCellsAndTypes.push({
                                    c: c, r: growUpR,
                                    oldBlockType: Config.BLOCK_AIR,
                                    newBlockType: Config.BLOCK_VEGETATION,
                                    finalBlockData: blockPlacedThisTurn
                                });

                                // --- CHECK FOR TREE FORMATION ---
                                // Calculate height starting from the newly grown block
                                const pillarHeight = getPillarHeightDownwards(c, growUpR, Config.BLOCK_VEGETATION);

                                if (pillarHeight >= Config.TREE_MIN_HEIGHT_TO_FORM) {
                                    // console.log(`Tree forming at [${c}, ${growUpR}] with height ${pillarHeight}`);
                                    // Convert pillar to wood
                                    for (let h = 0; h < pillarHeight; h++) {
                                        const trunkR = growUpR + h;
                                        const oldTrunkType = World.getBlockType(c, trunkR); // Should be VEGETATION
                                        if (oldTrunkType === Config.BLOCK_VEGETATION) {
                                            const setWoodSuccess = World.setBlock(c, trunkR, Config.BLOCK_WOOD, false);
                                            if (setWoodSuccess) {
                                                const woodBlockData = World.getBlock(c, trunkR);
                                                changedCellsAndTypes.push({
                                                    c: c, r: trunkR,
                                                    oldBlockType: Config.BLOCK_VEGETATION,
                                                    newBlockType: Config.BLOCK_WOOD,
                                                    finalBlockData: woodBlockData
                                                });
                                            }
                                        }
                                    }
                                    // Place initial canopy (around the top trunk block at growUpR)
                                    placeInitialCanopy(c, growUpR, Config.TREE_INITIAL_CANOPY_RADIUS, changedCellsAndTypes);
                                }
                            }
                        }
                    }
                }
            } // End Rule 2.2


            // --- Rule 3: Tree Canopy Growth & Decay ---

            // Rule 3.1: Tree Canopy Growth (applied to VEGETATION blocks likely part of a canopy)
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                // Heuristic: Is it adjacent (inc diagonals) to a WOOD block likely part of a trunk?
                let isNearTrunk = false;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        if (isLikelyTreeTrunk(c + dc, r + dr)) {
                            isNearTrunk = true;
                            break;
                        }
                    }
                    if (isNearTrunk) break;
                }

                if (isNearTrunk) {
                    // Try to expand the canopy from this vegetation block
                    expandCanopy(c, r, changedCellsAndTypes);
                    // Note: This might cause rapid expansion if multiple neighbors trigger it in one pass.
                    // Consider adding a check within expandCanopy to prevent expanding into a block
                    // that was *just* created in this same aging pass.
                }
            }

            // Rule 3.2: Tree Canopy Decay (VEGETATION -> AIR)
            if (newType === originalType && originalType === Config.BLOCK_VEGETATION) {
                 // Similar check as growth - is it likely part of a canopy?
                 let isNearTrunkDecay = false;
                 for (let dr = -1; dr <= 1; dr++) {
                     for (let dc = -1; dc <= 1; dc++) {
                         if (dr === 0 && dc === 0) continue;
                         if (isLikelyTreeTrunk(c + dc, r + dr)) {
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
                            // OPTIONAL TODO: When trunk decays, potentially trigger decay of adjacent canopy blocks too?
                            // Or drop WOOD items? Start simple: just turn trunk block to AIR.
                       }
                  }
             }


            // Rule 4: Deep Stoneification (Dirt/Veg/Sand -> Stone)
            // Check if block *wasn't* changed by previous rules (like erosion/growth)
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION || originalType === Config.BLOCK_SAND)) {
                const depthInPixels = r * Config.BLOCK_HEIGHT;
                if (depthInPixels > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                     if (Math.random() < Config.AGING_PROB_STONEIFICATION_DEEP) {
                         newType = Config.BLOCK_STONE;
                     }
                }
            }

            // Rule 5: Surface Stone Erosion (Stone -> Air)
            // Check if block *wasn't* changed by previous rules
             if (newType === originalType && originalType === Config.BLOCK_STONE) {
                 const isSurfaceStone = neighborTypes.above === Config.BLOCK_AIR || neighborTypes.above === Config.BLOCK_WATER;
                  if (isSurfaceStone) {
                       if (Math.random() < Config.AGING_PROB_EROSION_SURFACE_STONE) {
                           newType = Config.BLOCK_AIR;
                       }
                  }
             }

            // Rule 6: Underwater AIR/WATER Sedimentation -> SAND
            // Only apply if block wasn't changed (e.g. by tree growth above)
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                 let firstSolidRowBelow = -1;
                 for (let checkR = r + 1; checkR < Config.GRID_ROWS; checkR++) {
                     if (GridCollision.isSolid(c, checkR)) {
                         firstSolidRowBelow = checkR;
                         break;
                     }
                 }
                 // Sedimentation requires solid ground *somewhere* below it eventually, or being at the bottom row
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
                // Special case: If a block was placed *above* this one (like upward veg growth),
                // don't overwrite it with a change derived from the original block below.
                // Check if blockPlacedThisTurn exists and is at `(c, r)`. This is unlikely but a safeguard.
                let applyChange = true;
                if(blockPlacedThisTurn && blockPlacedThisTurn.c === c && blockPlacedThisTurn.r === r) {
                    applyChange = false;
                    // console.warn(`Aging conflict: Block placed at [${c},${r}] this turn, preventing overwrite by lower block's rule.`);
                }

                if (applyChange) {
                    const success = World.setBlock(c, r, newType, false); // `World.setBlock` creates the block object
                    if (!success) {
                         console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                    } else {
                        // Successfully changed the block type at (c, r)
                        const blockAfterChange = World.getBlock(c, r); // Get the new block data
                        // Record the change
                        changedCellsAndTypes.push({
                            c,
                            r,
                            oldBlockType: originalType,
                            newBlockType: newType,
                            finalBlockData: blockAfterChange // Store the actual data placed
                        });
                    }
                }
            }


             // --- Rule 7: SAND Sedimentation Downwards from (c, r) ---
             // This rule acts *based on* the original block type at (c, r) being SAND,
             // but modifies blocks *below* it. This should run even if (c, r) itself changed.
             if (originalType === Config.BLOCK_SAND) {
                 // Check if the original location was underwater
                 // We need to check the state *before* any changes this pass, ideally.
                 // Using waterDepthAbove calculated earlier based on current state is an approximation.
                 if (waterDepthAbove > 0) {
                     const maxSandDepthBelowInBlocks = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);

                     for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelowInBlocks; potentialDepth++) {
                         const nr = r + potentialDepth; // Row below
                         if (nr >= Config.GRID_ROWS) break; // Stop if out of bounds

                         // Check the block type at the target row *below* the original sand block
                         const targetBlockBeforeSedimentation = World.getBlock(c, nr); // Get current state
                         const targetBlockTypeBeforeChange = (typeof targetBlockBeforeSedimentation === 'object' && targetBlockBeforeSedimentation !== null)
                             ? targetBlockBeforeSedimentation.type
                             : targetBlockBeforeSedimentation;

                         // Check if the material below is something sand can convert
                         const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockTypeBeforeChange] !== undefined;

                         if (isConvertibleMaterial) {
                             // Check probability for sedimentation
                             if (Math.random() < Config.AGING_PROB_SAND_SEDIMENTATION_BELOW) {
                                 // Only apply change if it's not already sand
                                 if (targetBlockTypeBeforeChange !== Config.BLOCK_SAND) {
                                     // Attempt to set the block below to SAND
                                     const success = World.setBlock(c, nr, Config.BLOCK_SAND, false);
                                     if (success) {
                                         const blockAfterSedimentation = World.getBlock(c, nr); // Get the new sand block data
                                         // Record this change
                                         changedCellsAndTypes.push({
                                             c: c,
                                             r: nr, // Note the row is the one *below*
                                             oldBlockType: targetBlockTypeBeforeChange, // Original type of the block below
                                             newBlockType: Config.BLOCK_SAND,
                                             finalBlockData: blockAfterSedimentation
                                         });
                                     } else {
                                         console.error(`Aging failed to set block data at [${c}, ${nr}] to SAND during sedimentation below rule.`);
                                     }
                                 }
                                 // If it converted, continue checking deeper
                             } else {
                                // Probability check failed, stop trying to sediment deeper in this column
                                break;
                             }
                         } else {
                             // Hit a non-convertible block (like AIR, WATER, or maybe BEDROCK if added), stop sedimenting downwards
                             break;
                         }
                     } // End loop for potential depth
                 } // End if waterDepthAbove > 0
             } // End Rule 7

        } // End column loop (c)
    } // End row loop (r)

    // Return the list of all changes made in this pass
    return changedCellsAndTypes;
} // End applyAging function