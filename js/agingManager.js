// root/js/agingManager.js

// -----------------------------------------------------------------------------
// root/js/agingManager.js - Handles World Aging Effects (erosion, growth, etc.)
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { PerlinNoise } from './utils/noise.js'; // Import noise utility
import * as WorldData from './utils/worldData.js'; // Import world data access
import * as GridCollision from './utils/gridCollision.js'; // Import solid checks, hasSolidNeighbor
import { createBlock } from './utils/block.js'; // Import createBlock

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
function findFirstSolidBlockBelow(c, r) {
    for (let checkR = r + 1; checkR < Config.GRID_ROWS; checkR++) {
        if (GridCollision.isSolid(c, checkR)) {
            return checkR;
        }
    }
    return -1;
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
 * Does NOT update visuals or water queue directly, but returns list of changed cells.
 * @param {Portal | null} portalRef - Reference to the Portal instance (or null if none).
 * @param {number} intensityFactor - Multiplier for aging probabilities.
 * @returns {Array<{c: number, r: number}>} - An array of grid coordinates {c, r} that were changed by aging.
 */
export function applyAging(portalRef, intensityFactor) { // MODIFIED: portalRef can be null
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
    if (portalRef) { // MODIFIED: Only use portal ref if it's provided
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
            // The check is now ONLY performed if portalRef exists. If portalRef is null,
            // the `if (distSqToPortal < protectedRadiusSq)` check will evaluate to false
            // because protectedRadiusSq is 0, and the condition `distSqToPortal < 0` is never true
            // (unless distSqToPortal is negative, which is impossible for a squared distance).
            // However, a more explicit check is safer and clearer:
            if (portalRef) { // MODIFIED: Wrap the protected zone check inside this if
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
            let newType = originalType; // Start assuming no change
            const isPlayerPlaced = typeof block === 'object' ? (block.isPlayerPlaced ?? false) : false; // Preserve playerPlaced status

            const depth = r * Config.BLOCK_HEIGHT; // Calculate depth in pixels

            // Get neighbor types for exposure checks
            const neighborTypes = getNeighborTypes(c, r);
            const isExposedToAir = isExposedTo(c, r, Config.BLOCK_AIR);
            const isExposedToWater = isExposedTo(c, r, Config.BLOCK_WATER);
            // Needs solid below check including boundary
            // const hasSolidBelow_rPlus1 = GridCollision.isSolid(c, r + 1) || r + 1 >= Config.GRID_ROWS; // This was only used by OLD sand sed rule


            // --- Aging Rules Switch (Prioritized Order) ---
            // We apply rules sequentially based on priority. If a rule changes the block, we stop processing rules for this block.

            // Rule 1: SAND Erosion (Highest Priority)
            if (originalType === Config.BLOCK_SAND) {
                 if (isExposedToWater) {
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

            // Rule 1.5: SAND Sedimentation Below
            // Apply only if the block wasn't changed by Rule 1 and is SAND.
            if (newType === originalType && originalType === Config.BLOCK_SAND) {

                // Get the block immediately below (c, r+1)
                const blockBelow = WorldData.getBlock(c, r + 1);

                // Skip if out of bounds below OR if the block below is already SAND or AIR or WATER
                // Use a more explicit check: is it a block that exists and is NOT sand, air, or water?
                if (blockBelow !== null &&
                    (typeof blockBelow === 'object' ?
                         (blockBelow.type !== Config.BLOCK_SAND && blockBelow.type !== Config.BLOCK_AIR && blockBelow.type !== Config.BLOCK_WATER) :
                         (blockBelow !== Config.BLOCK_AIR && blockBelow !== Config.BLOCK_WATER) // Case where it's the AIR constant (0)
                    )
                   ) {

                    const blockBelowType = typeof blockBelow === 'object' ? blockBelow.type : blockBelow; // Get the actual type or AIR constant

                    // Check if this material type is included in the convertible factors map (implicitly checks if factor > 0)
                    // This check remains, but the VALUE is always 1.0 now in config for these types.
                    const isConvertibleMaterial = Config.AGING_MATERIAL_CONVERSION_FACTORS[blockBelowType] !== undefined;

                    // Only proceed if the material below is convertible
                    if (isConvertibleMaterial) {
                        // Get the contiguous water depth directly above this SAND block
                        const waterDepth = getWaterDepthAbove(c, r);

                        // Calculate the water influence multiplier
                        // Capped at max influence depth, then normalized between 0 and 1
                        const maxInfluenceDepth = Config.AGING_WATER_DEPTH_INFLUENCE_MAX_DEPTH;
                        // Multiplier is 0 if waterDepth is 0, 1/MAX if waterDepth is 1, ..., 1.0 if waterDepth >= MAX
                        const waterInfluenceMultiplier = maxInfluenceDepth > 0 ? Math.min(waterDepth, maxInfluenceDepth) / maxInfluenceDepth : 0;


                        // Calculate the final probability for this SAND block to convert the block below
                        // Removed multiplication by materialFactor for equal chance
                        const sedimentationBelowProb = Config.AGING_PROB_SAND_SEDIMENTATION_BELOW * clampedIntensity * waterInfluenceMultiplier;

                        // Apply random chance
                        if (Math.random() < sedimentationBelowProb) {
                            // Change the block below to SAND
                            const newBlockBelowType = Config.BLOCK_SAND;
                            // We need to preserve the isPlayerPlaced status of the block being *converted*, not the sand.
                            // However, the sand being *placed* by this rule is considered naturally occurring sediment, so it's not player-placed.
                            // Let's get the original block data below to check its player-placed status.
                             const originalBlockBelowData = WorldData.getBlock(c, r + 1); // Get the original block data object below
                             const originalBlockBelowIsPlayerPlaced = typeof originalBlockBelowData === 'object' ? (originalBlockBelowData.isPlayerPlaced ?? false) : false; // Check its player-placed status

                            // When converting, the NEW block at (c, r+1) is SAND and is *not* player-placed, regardless of the original block below.
                            const success = WorldData.setBlock(c, r + 1, newBlockBelowType, false); // New sand is NOT player-placed

                            if (success) {
                                // Add the changed cell (r+1) to the list, avoiding duplicates
                                const changedKey = `${c},${r+1}`;
                                if (!changedCells.has(changedKey)) {
                                    changedCells.set(changedKey, { c, r: r + 1 });
                                     // console.log(`[${c},${r+1}] ${Config.BLOCK_COLORS[blockBelowType]} converted to SAND by SAND above (Water Depth: ${waterDepth}, Prob: ${sedimentationBelowProb.toFixed(5)}).`);
                                }
                            } else {
                                console.error(`Aging failed to set block data at [${c}, ${r+1}] to SAND during sedimentation below rule.`);
                            }
                        }
                    } // End if isConvertibleMaterial
                } // End if blockBelow is valid and potentially convertible
            } // End NEW Rule 1.5


            // Rule 2: DIRT/GRASS Water Erosion -> SAND
            // Apply only if the block wasn't changed by previous rules (including Rule 1.5 modifications at r+1) and is DIRT/GRASS at (c, r).
            // IMPORTANT: This rule applies to the block at (c, r), not below it.
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS)) {
                 if (isExposedToWater) {
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
                 const firstSolidRowBelow = findFirstSolidBlockBelow(c, r); // Finds solid below or -1
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


            // --- Apply Change and Record ---
            // If the aging rule decided to change the block type at (c, r)
            // Note: Rule 1.5 modifies block at (c, r+1) and adds it to changedCells directly.
            // This section handles changes to the block at (c, r) by rules 1, 2, 3, 4, 5, or 6.
            if (newType !== originalType) {
                // Create the new block data object, preserving playerPlaced status if changing type
                // IMPORTANT: Player-placed status should generally NOT be preserved when a block *changes* type due to aging.
                // Aging represents natural processes. Only block placement should use the playerPlaced flag.
                // Remove the `isPlayerPlaced` preservation here. Aged blocks are natural.
                const newBlockData = createBlock(newType, false); // Always mark as not player-placed when aging changes type

                // Update the block data in the grid using the direct setter as we already have the block data object
                const success = WorldData.setBlockData(c, r, newBlockData);

                if (success) {
                    // Record that this cell changed. Use the Map to ensure uniqueness.
                     const changedKey = `${c},${r}`;
                     if (!changedCells.has(changedKey)) {
                         changedCells.set(changedKey, { c, r });
                         // console.log(`Aging changed [${c}, ${r}] from ${originalType} to ${newType}.`); // Debug log
                     } else {
                          // console.log(`Aging changed [${c}, ${r}] from ${originalType} to ${newType}, already in changed list.`); // Debug log - This shouldn't happen if rules are mutually exclusive for `newType !== originalType`
                     }
                } else {
                     console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                }
            }
        }
    }
    console.log(`Aging pass complete. ${changedCells.size} blocks changed.`);
    // Convert map values back to an array
    const changedCellsArray = Array.from(changedCells.values());

    // After all cells have been processed, sort the changedCells list by row (descending)
    // This helps WorldManager/Renderer update the static canvas more efficiently for cascading changes
    changedCellsArray.sort((a, b) => b.r - a.r);

    return changedCellsArray; // Return the array of unique changed cells
}