// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { PerlinNoise } from './utils/noise.js'; // Import noise utility
import * as WorldData from './utils/worldData.js'; // Import world data access
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
     neighborTypes.above = WorldData.getBlockType(c, r - 1);
     neighborTypes.below = WorldData.getBlockType(c, r + 1);
     neighborTypes.left = WorldData.getBlockType(c - 1, r);
     neighborTypes.right = WorldData.getBlockType(c + 1, r);
     return neighborTypes;
}

// Helper function to check exposure to a specific type (AIR or WATER)
function isExposedTo(c, r, exposedType) {
    const neighborTypes = getNeighborTypes(c, r);
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
        const blockType = WorldData.getBlockType(c, checkR); // Handles out of bounds above
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
 * @returns {Array<{c: number, r: number}>} - An array of grid coordinates {c, r} that were changed by aging.
 */
export function applyAging(portalRef, intensityFactor) {
    if (!agingNoiseGenerator) {
         console.error("Aging noise generator not initialized!");
         return [];
    }
    const grid = WorldData.getGrid();
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return [];
    }
    const clampedIntensity = Math.max(0.0, intensityFactor);
    if (clampedIntensity <= 0) {
        return [];
    }
    let changedCellsThisPass = []; // initialize array to store changes
    for (let r = 0; r < Config.GRID_ROWS; r++) { // iterate through ALL cells
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (portalRef) {
                 const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                 const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;

                 // --- FIXED: Get portal center and safety radius from portalRef ---
                 const portalCenter = portalRef.getPosition(); // portalRef.getPosition() returns {x, y} of the portal's center
                 const portalX = portalCenter.x;
                 const portalY = portalCenter.y;
                 const protectedRadiusSq = portalRef.safetyRadius * portalRef.safetyRadius; // portalRef.safetyRadius is a property

                 const dx = blockCenterX - portalX;
                 const dy = blockCenterY - portalY;
                 const distSqToPortal = dx * dx + dy * dy;
                 if (distSqToPortal < protectedRadiusSq) {
                      continue;
                 }
            }

            const block = WorldData.getBlock(c, r);
            if (block === null) continue;

            const originalType = (typeof block === 'object' && block !== null) ? block.type : block; // Ensure block is not null before accessing type
            let newType = originalType;

            const neighborTypes = getNeighborTypes(c, r);
            const isExposedToAir = isExposedTo(c, r, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(c, r, Config.BLOCK_WATER);
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

            // Rule 2: DIRT/GRASS Water Erosion -> SAND
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS)) {
                 if (waterDepthAbove > 0) {
                      const erosionProb = Config.AGING_PROB_WATER_EROSION_DIRT_GRASS * clampedIntensity;
                      if (Math.random() < erosionProb) {
                           newType = Config.BLOCK_SAND;
                      }
                 }
            }

            // Rule 3: DIRT Grass Growth -> GRASS
             if (newType === originalType && originalType === Config.BLOCK_DIRT) {
                 const isBelowSolidAndWithinBounds = GridCollision.isSolid(c, r + 1);
                 if (isExposedToAir && !isExposedToWater && isBelowSolidAndWithinBounds) {
                      const growthProb = Config.AGING_PROB_GRASS_GROWTH * clampedIntensity;
                      if (Math.random() < growthProb) {
                           newType = Config.BLOCK_GRASS;
                      }
                 }
             }

            // Rule 4: Deep Stoneification
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS || originalType === Config.BLOCK_SAND)) {
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
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
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

            // --- Apply Change to WorldData ---
            if (newType !== originalType) {
                const success = WorldData.setBlock(c, r, newType, false);
                if (!success) {
                     console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                } else {
                    changedCellsThisPass.push({ c, r }); // add to changed cells
                }
            }

            // --- Rule 1.5: SAND Sedimentation Downwards from (c, r) ---
            // This rule might change blocks at (c, nr) which is different from (c,r)
            if (originalType === Config.BLOCK_SAND) {
                if (waterDepthAbove > 0) {
                    const maxSandDepthBelowInBlocks = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);
                    for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelowInBlocks; potentialDepth++) {
                        const nr = r + potentialDepth;
                        if (nr >= Config.GRID_ROWS) break;
                        const targetBlockTypeBeforeChange = WorldData.getBlockType(c, nr); // Get type *before* this rule might change it
                        const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockTypeBeforeChange] !== undefined;

                        if (isConvertibleMaterial) {
                            const sedimentationProb = Config.AGING_PROB_SAND_SEDIMENTATION_BELOW * clampedIntensity;
                            if (Math.random() < sedimentationProb) {
                                // Only record change if the type is actually different
                                if (targetBlockTypeBeforeChange !== Config.BLOCK_SAND) {
                                    const success = WorldData.setBlock(c, nr, Config.BLOCK_SAND, false);
                                    if (success) {
                                        // Check if this cell was already added in this pass to avoid duplicates if main.js doesn't dedupe
                                        // For simplicity, let's assume main.js handles deduping or this specific call site doesn't mind.
                                        changedCellsThisPass.push({ c, r: nr }); // add this changed cell
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
    console.log(`Aging pass complete (intensity: ${clampedIntensity.toFixed(2)}). WorldData modified.`);
    return changedCellsThisPass; // return the array of changes
}