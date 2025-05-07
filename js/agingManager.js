// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { PerlinNoise } from './utils/noise.js'; // Import noise utility
import * as WorldData from './utils/worldData.js'; // Import world data access
import * as GridCollision from './utils/gridCollision.js'; // Import solid checks, hasSolidNeighbor
import { createBlock } from './utils/block.js'; // Import createBlock
// NEW: Import WorldManager for water simulation interaction
import * as WorldManager from './worldManager.js'; // Import WorldManager


// --- Module State ---
let agingNoiseGenerator = null; // dedicated noise instance for aging

// --- Initialization ---
export function init() {
    // Initialize the dedicated noise generator for aging
    agingNoiseGenerator = new PerlinNoise(12345); // Using a fixed seed for consistent aging patterns
    console.log("AgingManager initialized.");
}


// --- Helper Functions ---

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

// Helper function to find the first solid block below a given coordinate (still useful for the OLD sedimentation rule)
// NOTE: This function is not strictly needed for the NEW Rule 1.5 logic as we iterate downwards from the source sand block
// function findFirstSolidBlockBelow(c, r) {
//     for (let checkR = r + 1; checkR < Config.GRID_ROWS; checkR++) {
//         if (GridCollision.isSolid(c, checkR)) {
//             return checkR;
//         }
//     }
//     return -1;
// }

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

// NEW: Helper function to queue changed cells and their neighbors for water updates
function queueWaterCandidatesAroundChange(c, r) {
    let candidateAdded = false;
    // Add the changed cell itself
    candidateAdded = WorldManager.addWaterUpdateCandidate(c, r) || candidateAdded;
    // Add cardinal neighbors
    candidateAdded = WorldManager.addWaterUpdateCandidate(c, r - 1) || candidateAdded;
    candidateAdded = WorldManager.addWaterUpdateCandidate(c, r + 1) || candidateAdded;
    candidateAdded = WorldManager.addWaterUpdateCandidate(c - 1, r) || candidateAdded;
    candidateAdded = WorldManager.addWaterUpdateCandidate(c + 1, r) || candidateAdded;

    // If any candidate was added, reset the water timer to trigger an immediate update
    if (candidateAdded) {
        WorldManager.resetWaterPropagationTimer();
    }
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
         return []; // Return empty array on error
    }

    const grid = WorldData.getGrid(); // Get grid array
    if (!grid || grid.length === 0 || grid[0].length === 0) {
        console.error("World grid is not available or empty for aging.");
        return [];
    }

    const clampedIntensity = Math.max(0.0, intensityFactor); // Ensure non-negative intensity
    // If intensity is effectively zero, skip the whole process.
    if (clampedIntensity <= 0) {
        // console.log("Aging intensity is zero, skipping aging pass."); // Too noisy
        return []; // Return empty array as nothing changed
    }

    // console.log(`Applying Aging (Intensity: ${clampedIntensity.toFixed(2)}, Protected Zone: ${portalRef ? 'Active' : 'Inactive'})`); // Debug log

    // Get portal position and calculate protected radius *only if portalRef is provided*
    let portalX = -Infinity, portalY = -Infinity;
    let protectedRadiusSq = 0; // Default to 0 radius (effectively no protection) if no portal
    if (portalRef) { // Only use portal ref if it's provided
        const portalPos = portalRef.getPosition(); // Gets the center of the portal rectangle
        portalX = portalPos.x;
        portalY = portalPos.y;
        const currentSafetyRadius = portalRef.safetyRadius; // Use the dynamic safety radius from the portal instance
        protectedRadiusSq = currentSafetyRadius * currentSafetyRadius; // Square it for distance comparison
        // console.log(`Protected Zone Active: Center (${portalX.toFixed(1)}, ${portalY.toFixed(1)}), Radius ${Math.sqrt(protectedRadiusSq).toFixed(1)}`); // Debug log
    } else {
        // console.log("Protected Zone Inactive: No portal reference provided."); // Debug log
         // If no portalRef, protectedRadiusSq remains 0, so the check below is effectively skipped.
    }


    const changedCells = new Map(); // Use a Map to store unique {c, r} of changed cells


    // Iterate through ALL cells
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {

            // --- Protected Zone Check (Only if portalRef is provided) ---
            if (portalRef) { // Wrap the protected zone check inside this if
                 const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
                 const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
                 const dx = blockCenterX - portalX;
                 const dy = blockCenterY - portalY;
                 const distSqToPortal = dx * dx + dy * dy;

                 // If the block center is strictly within the protected zone, skip aging logic for this block.
                 if (distSqToPortal < protectedRadiusSq) {
                      continue; // Skip aging for this block
                 }
            }
            // --- End Protected Zone Check ---


            // --- Aging Logic (Applies to blocks OUTSIDE the protected zone, or ALL blocks if portalRef is null) ---

            const block = WorldData.getBlock(c, r); // Get block data (object or AIR constant)
            // If null (out of bounds), skip.
            if (block === null) continue;

            const originalType = (typeof block === 'object') ? block.type : block;
            let newType = originalType; // Start assuming no change at (c, r)

            // Get neighbor types for exposure checks
            const neighborTypes = getNeighborTypes(c, r);
            const isExposedToAir = isExposedTo(c, r, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(c, r, Config.BLOCK_WATER);
            const waterDepthAbove = getWaterDepthAbove(c, r); // Get water depth above (c, r)


            // --- Aging Rules Switch (Prioritized Order for changes AT (c, r)) ---
            // We apply rules sequentially based on priority. If a rule changes the block *at (c, r)*, we stop processing rules for *this block at (c, r)* in this pass.

            // Rule 1: SAND Erosion (Highest Priority)
            if (originalType === Config.BLOCK_SAND) {
                 if (waterDepthAbove > 0) { // Check for water directly above
                      const erosionProb = Config.AGING_PROB_WATER_EROSION_SAND * clampedIntensity;
                      if (Math.random() < erosionProb) {
                           newType = Config.BLOCK_WATER; // Sand exposed to water becomes Water
                           // console.log(`[${c},${r}] SAND eroded to WATER by WATER exposure.`);
                      }
                 } else if (isExposedToAir) { // Check for air exposure if not exposed to water
                      const erosionProb = Config.AGING_PROB_AIR_EROSION_SAND * clampedIntensity;
                       if (Math.random() < erosionProb) {
                            newType = Config.BLOCK_AIR; // Sand exposed to air becomes Air (wind erosion)
                            // console.log(`[${c},${r}] SAND eroded to AIR by AIR exposure.`);
                       }
                 }
                 // If Rule 1 applied, newType !== originalType, and we proceed to Apply Change below.
                 // If it didn't apply, newType === originalType, and we fall through to the next rule.
            }

            // Rule 2: DIRT/GRASS Water Erosion -> SAND
            // Apply only if the block wasn't changed by previous rules and is DIRT/GRASS at (c, r).
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS)) {
                 if (waterDepthAbove > 0) { // Check for water directly above
                      const erosionProb = Config.AGING_PROB_WATER_EROSION_DIRT_GRASS * clampedIntensity;
                      if (Math.random() < erosionProb) {
                           newType = Config.BLOCK_SAND; // DIRT/GRASS exposed to water becomes SAND
                           // console.log(`[${c},${r}] ${Config.BLOCK_COLORS[originalType]} eroded to SAND by WATER exposure.`);
                      }
                 }
                 // If Rule 2 applied, newType changes, and we continue to the Apply Change step.
            }


            // Rule 3: DIRT Grass Growth -> GRASS
            // Apply only if the block wasn't changed by previous rules and is DIRT
            // Condition: Exposed to AIR AND NOT exposed to WATER AND has solid below (for surface growth)
             if (newType === originalType && originalType === Config.BLOCK_DIRT) {
                 // Check if block below is solid within bounds
                 // This check is correct using GridCollision.isSolid which handles null/out of bounds.
                 const isBelowSolidAndWithinBounds = GridCollision.isSolid(c, r + 1);

                 if (isExposedToAir && !isExposedToWater && isBelowSolidAndWithinBounds) {
                      const growthProb = Config.AGING_PROB_GRASS_GROWTH * clampedIntensity;
                      if (Math.random() < growthProb) {
                           newType = Config.BLOCK_GRASS; // DIRT becomes GRASS
                           // console.log(`[${c},${r}] DIRT grew into GRASS.`);
                      }
                 }
                 // If Rule 3 applied, newType changes.
             }

            // Rule 4: Deep Stoneification (Lowest Priority for material types)
            // Apply only if the block wasn't changed by previous rules and is DIRT, GRASS, or SAND
            // AND it's below the configured depth threshold.
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS || originalType === Config.BLOCK_SAND)) {
                const depth = r * Config.BLOCK_HEIGHT; // Calculate depth in pixels
                if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) { // Only happens at sufficient depth
                    const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP * clampedIntensity; // Use the reduced probability from config
                     if (Math.random() < stoneProb) {
                         newType = Config.BLOCK_STONE; // Turns to Stone
                         // console.log(`[${c},${r}] ${Config.BLOCK_COLORS[originalType]} stoneified into STONE.`);
                     }
                }
            }

            // Rule 5: Surface Stone Erosion (Apply after other transformations on existing blocks)
             if (newType === originalType && originalType === Config.BLOCK_STONE) {
                 const isSurfaceStone = neighborTypes.above === Config.BLOCK_AIR || neighborTypes.above === Config.BLOCK_WATER; // Exposed to air or water from above
                  if (isSurfaceStone) {
                       const stoneErosionProb = Config.AGING_PROB_EROSION_SURFACE_STONE * clampedIntensity;
                       if (Math.random() < stoneErosionProb) { // Apply random chance
                           newType = Config.BLOCK_AIR; // Stone erodes to Air
                           // console.log(`[${c},${r}] STONE eroded to AIR.`);
                       }
                  }
             }

            // Rule 6: Underwater AIR/WATER Sedimentation -> SAND (OLD RULE)
            // Keep this rule - it fills empty spaces near solid ground with sand, which is different from sand pushing down.
            // Apply only if the block wasn't changed and is currently AIR AND below the waterline threshold.
            // CHANGED from AIR/WATER to just AIR based on a previous user request, but keeping the rule number.
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) {
                 // This rule needs *some* solid block below or at the bottom of the map to act as a base for sedimentation.
                 // Find first solid block below, handling out of bounds correctly
                 let firstSolidRowBelow = -1;
                 for (let checkR = r + 1; checkR < Config.GRID_ROWS; checkR++) {
                     if (GridCollision.isSolid(c, checkR)) {
                         firstSolidRowBelow = checkR;
                         break;
                     }
                 }
                 const hasSolidBelowOrIsBottom = (firstSolidRowBelow !== -1) || (r === Config.GRID_ROWS - 1);


                 if (hasSolidBelowOrIsBottom) {
                     // If there's solid ground below or this is the bottom row, apply sedimentation chance
                     const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * clampedIntensity;
                     if (Math.random() < sedimentationProb) {
                         newType = Config.BLOCK_SAND; // AIR becomes SAND
                         // console.log(`[${c},${r}] AIR sedimented into SAND.`);
                     }
                 }
             }
            // TODO: Add rules for other block types (Wood, Metal, Bone, etc.) aging here


            // --- Apply Change to (c, r) and Record ---
            // If any rule above decided to change the block type at (c, r)
            if (newType !== originalType) {
                // Create the new block data object, mark as not player-placed as aging is a natural process.
                const newBlockData = createBlock(newType, false);

                // Update the block data in the grid using the direct setter as we already have the block data object
                const success = WorldData.setBlockData(c, r, newBlockData);

                if (success) {
                    // Record that this cell changed. Use the Map to ensure uniqueness.
                     const changedKey = `${c},${r}`;
                     if (!changedCells.has(changedKey)) {
                         changedCells.set(changedKey, { c, r });
                         // console.log(`Aging changed [${c}, ${r}] from ${originalType} to ${newType}.`); // Debug log
                     }
                    // NEW: Queue this specific change location AND its neighbors for water updates
                    queueWaterCandidatesAroundChange(c, r);
                } else {
                     console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                }
            }

            // --- NEW Rule 1.5: SAND Sedimentation Downwards from (c, r) ---
            // This rule applies to blocks *below* (c, r), assuming the block at (c, r) is SAND
            // Check if the block at (c, r) is SAND (using original type as other rules might have changed it)
            if (originalType === Config.BLOCK_SAND) {
                // Check if there is contiguous water directly above this sand block
                // We already calculated waterDepthAbove earlier
                if (waterDepthAbove > 0) {
                    // Determine the maximum depth sand can sediment downwards from (c, r)
                    // This is limited by the water depth above and the config max depth
                    const maxSandDepthBelow = Math.min(waterDepthAbove, Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH);

                    // Iterate downwards from 1 layer below (c, r) up to the calculated max depth
                    for (let potentialDepth = 1; potentialDepth <= maxSandDepthBelow; potentialDepth++) {
                        const nr = r + potentialDepth; // Row index of the potential sand layer

                        // Check bounds for the target cell below
                        if (nr >= Config.GRID_ROWS) {
                            break; // Stop checking further down if out of bounds
                        }

                        // Get the block type at the target cell (c, nr)
                        const targetBlockType = WorldData.getBlockType(c, nr);

                        // Check if the target block type is a convertible material (exists in map)
                        const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[targetBlockType] !== undefined;

                        if (isConvertibleMaterial) {
                            // Apply the probabilistic chance for this layer to convert
                            const sedimentationProb = Config.AGING_PROB_SAND_SEDIMENTATION_BELOW * clampedIntensity;

                            if (Math.random() < sedimentationProb) {
                                // Convert the block at (c, nr) to SAND
                                const newBlockBelowType = Config.BLOCK_SAND;
                                const success = WorldData.setBlock(c, nr, newBlockBelowType, false); // New sand is NOT player-placed

                                if (success) {
                                    // Add the changed cell (c, nr) to the list, avoiding duplicates
                                    const changedKey = `${c},${nr}`;
                                    if (!changedCells.has(changedKey)) {
                                        changedCells.set(changedKey, { c, r: nr });
                                        // console.log(`[${c},${nr}] converted to SAND by SAND above (Depth: ${potentialDepth}, Water Depth: ${waterDepthAbove}, Prob: ${sedimentationProb.toFixed(5)}).`);
                                    }
                                    // Queue this specific change location AND its neighbors for water updates
                                    queueWaterCandidatesAroundChange(c, nr);
                                } else {
                                    console.error(`Aging failed to set block data at [${c}, ${nr}] to SAND during sedimentation below rule.`);
                                }
                            }
                            // Note: If the probability failed, we still continue checking deeper layers below (c, r) in this pass.
                            // The loop continues to the next potentialDepth <= maxSandDepthBelow.

                        } else {
                            // If the block at (c, nr) is NOT a convertible material (e.g., AIR, WATER, existing SAND,
                            // or a solid type not listed in the conversion factors map),
                            // stop checking further down *from this specific sand block at (c, r)* in this aging pass.
                            // Sand cannot sediment through non-convertible blocks.
                            // console.log(`Stopping sand sedimentation from [${c}, ${r}] at depth ${potentialDepth} due to non-convertible block type ${targetBlockType} at [${c}, ${nr}].`);
                            break; // Exit the potentialDepth loop for this (c, r) block
                        }
                    } // End loop over potentialDepth <= maxSandDepthBelow
                } // End if waterDepthAbove > 0
            } // End if originalType === BLOCK_SAND

        } // End inner loop over columns
    } // End outer loop over rows

    console.log(`Aging pass complete. ${changedCells.size} unique blocks changed.`);
    // Convert map values back to an array
    const changedCellsArray = Array.from(changedCells.values());

    // After all cells have been processed, sort the changedCells list by row (descending)
    // This helps WorldManager/Renderer update the static canvas more efficiently for cascading changes
    changedCellsArray.sort((a, b) => b.r - a.r);

    // Note: The waterPropagationTimer reset is handled by queueWaterCandidatesAroundChange,
    // which is called for *each* successful block change near water.
    // This ensures an immediate water update pass is triggered if *any* relevant block changed.

    return changedCellsArray; // Return the array of unique changed cells for static world visual updates
}