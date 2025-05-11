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


// --- Main Aging Function ---
/**
 * Applies aging effects (erosion, growth, stoneification, etc.) to the world grid.
 * Aging is probabilistic and influenced by intensity, environment.
 * Protected radius around the portal is applied *only if* portalRef is provided.
 * Returns list of coordinates {c, r} that were changed by aging (for static world visual updates).
 * @param {Portal | null} portalRef - Reference to the Portal instance (or null if none).
 * @param {number} intensityFactor - Multiplier for aging probabilities.
 * @returns {Array<{c: number, r: number, oldBlockType: number, newBlockType: number, finalBlockData: object | number}>} - An array of detailed changes.
 */
export function applyAging(portalRef, intensityFactor) {
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return [];
    }
    const grid = World.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return [];
    }
    const clampedIntensity = Math.max(0.0, intensityFactor);
    if (clampedIntensity <= 0) {
        return [];
    }
    let changedCellsAndTypes = []; // MODIFIED: Store detailed changes

    for (let r = 0; r < Config.GRID_ROWS; r++) { // iterate through ALL cells
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (portalRef) {
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
                      continue;
                 }
            }

            const blockBeforeChange = World.getBlock(c, r); // Get block object or AIR
            if (blockBeforeChange === null) continue; // Should not happen in a valid grid

            const originalType = (typeof blockBeforeChange === 'object' && blockBeforeChange !== null) ? blockBeforeChange.type : blockBeforeChange;
            let newType = originalType;

            const neighborTypes = getNeighborTypes(c, r);
            const isExposedToAir = isExposedTo(neighborTypes, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(neighborTypes, Config.BLOCK_WATER);
            const waterDepthAbove = getWaterDepthAbove(c, r);

            // Rule 1: SAND Erosion (Highest Priority)
            if (originalType === Config.BLOCK_SAND) {
                 if (waterDepthAbove > 0) {
                      const erosionProb = Config.AGING_PROB_WATER_EROSION_SAND * clampedIntensity;
                      if (Math.random() < erosionProb) {
                           newType = Config.BLOCK_WATER;
                      }
                 } else if (isExposedToAir) {
                      const erosionProb = Config.AGING_PROB_AIR_EROSION_SAND * clampedIntensity;
                       if (Math.random() < erosionProb) {
                            newType = Config.BLOCK_AIR;
                       }
                 }
            }

            // Rule 2: DIRT/VEGETATION Water Erosion -> SAND
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION)) {
                 if (waterDepthAbove > 0) {
                      const erosionProb = Config.AGING_PROB_WATER_EROSION_DIRT_VEGETATION * clampedIntensity;
                      if (Math.random() < erosionProb) {
                           newType = Config.BLOCK_SAND;
                      }
                 }
            }

            // Rule 3: DIRT VEGETATION Growth -> VEGETATION
             if (newType === originalType && originalType === Config.BLOCK_DIRT) {
                 const isBelowSolidAndWithinBounds = GridCollision.isSolid(c, r + 1);
                 if (isExposedToAir && !isExposedToWater && isBelowSolidAndWithinBounds) {
                      let airSidesCount = 0;
                      if (neighborTypes.above === Config.BLOCK_AIR) airSidesCount++;
                      if (neighborTypes.left === Config.BLOCK_AIR) airSidesCount++;
                      if (neighborTypes.right === Config.BLOCK_AIR) airSidesCount++;
                      let growthProb = Config.AGING_PROB_VEGETATION_GROWTH_BASE;
                      growthProb += Math.min(airSidesCount, Config.AGING_MAX_AIR_SIDES_FOR_VEGETATION_BONUS) * Config.AGING_PROB_VEGETATION_GROWTH_PER_AIR_SIDE;
                      growthProb *= clampedIntensity;
                      if (Math.random() < growthProb) {
                           newType = Config.BLOCK_VEGETATION;
                      }
                 }
             }

            // Rule 4: Deep Stoneification
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_VEGETATION || originalType === Config.BLOCK_SAND)) {
                const depthInPixels = r * Config.BLOCK_HEIGHT;
                if (depthInPixels > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) {
                    const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP * clampedIntensity;
                     if (Math.random() < stoneProb) {
                         newType = Config.BLOCK_STONE;
                     }
                }
            }

            // Rule 5: Surface Stone Erosion
             if (newType === originalType && originalType === Config.BLOCK_STONE) {
                 const isSurfaceStone = neighborTypes.above === Config.BLOCK_AIR || neighborTypes.above === Config.BLOCK_WATER;
                  if (isSurfaceStone) {
                       const stoneErosionProb = Config.AGING_PROB_EROSION_SURFACE_STONE * clampedIntensity;
                       if (Math.random() < stoneErosionProb) {
                           newType = Config.BLOCK_AIR;
                       }
                  }
             }

            // Rule 6: Underwater AIR/WATER Sedimentation -> SAND
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WATER_LEVEL) {
                 let firstSolidRowBelow = -1;
                 for (let checkR = r + 1; checkR < Config.GRID_ROWS; checkR++) {
                     if (GridCollision.isSolid(c, checkR)) {
                         firstSolidRowBelow = checkR;
                         break;
                     }
                 }
                 const hasSolidBelowOrIsBottom = (firstSolidRowBelow !== -1) || (r === Config.GRID_ROWS - 1);
                 if (hasSolidBelowOrIsBottom) {
                     const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * clampedIntensity;
                     if (Math.random() < sedimentationProb) {
                         newType = Config.BLOCK_SAND;
                     }
                 }
             }

            // --- Apply Change to World ---
            if (newType !== originalType) {
                const success = World.setBlock(c, r, newType, false); // setBlock creates the new block object
                if (!success) {
                     console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                } else {
                    const blockAfterChange = World.getBlock(c, r); // Get the new block object or AIR
                    changedCellsAndTypes.push({
                        c,
                        r,
                        oldBlockType: originalType,
                        newBlockType: newType,
                        finalBlockData: blockAfterChange // The actual block object/value after change
                    });
                }
            }

            // --- Rule 1.5: SAND Sedimentation Downwards from (c, r) ---
            // This rule might change blocks at (c, nr) which is different from (c,r)
            // Important: Get `originalType` again for this specific rule, as `newType` might have changed above.
            //            However, this rule is specific to `BLOCK_SAND` at `c,r`.
            //            The `blockBeforeChange` and `originalType` fetched at the start of the (c,r) loop are still relevant for this.
            if (originalType === Config.BLOCK_SAND) { // Use the original type of the (c,r) block for this rule's condition
                if (waterDepthAbove > 0) { // `waterDepthAbove` is relative to (c,r)
                    const maxSandDepthBelowInBlocks = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);
                    for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelowInBlocks; potentialDepth++) {
                        const nr = r + potentialDepth; // Target row for sedimentation
                        if (nr >= Config.GRID_ROWS) break;

                        const targetBlockBeforeSedimentation = World.getBlock(c, nr); // Get block object or AIR
                        const targetBlockTypeBeforeChange = (typeof targetBlockBeforeSedimentation === 'object' && targetBlockBeforeSedimentation !== null)
                            ? targetBlockBeforeSedimentation.type
                            : targetBlockBeforeSedimentation;

                        const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockTypeBeforeChange] !== undefined;

                        if (isConvertibleMaterial) {
                            const sedimentationProb = Config.AGING_PROB_SAND_SEDIMENTATION_BELOW * clampedIntensity;
                            if (Math.random() < sedimentationProb) {
                                if (targetBlockTypeBeforeChange !== Config.BLOCK_SAND) {
                                    const success = World.setBlock(c, nr, Config.BLOCK_SAND, false);
                                    if (success) {
                                        const blockAfterSedimentation = World.getBlock(c, nr);
                                        changedCellsAndTypes.push({
                                            c: c,
                                            r: nr,
                                            oldBlockType: targetBlockTypeBeforeChange,
                                            newBlockType: Config.BLOCK_SAND,
                                            finalBlockData: blockAfterSedimentation
                                        });
                                    } else {
                                        console.error(`Aging failed to set block data at [${c}, ${nr}] to SAND during sedimentation below rule.`);
                                    }
                                }
                            }
                        } else {
                            break; // Stop sedimentation if non-convertible block is hit
                        }
                    }
                }
            }
        }
    }
    return changedCellsAndTypes;
}