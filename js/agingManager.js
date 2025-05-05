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
 * Aging is probabilistic and influenced by intensity, environment, and a protected radius around the portal.
 * Does NOT update visuals or water queue directly, but returns list of changed cells.
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
        portalX = Config.CANVAS_WIDTH / 2;
        portalY = Config.CANVAS_HEIGHT / 2;
        protectedRadiusSq = Config.PORTAL_SAFETY_RADIUS * Config.PORTAL_SAFETY_RADIUS; // Use initial config value as fallback
        // console.warn(`No Portal Ref: Using Screen Center for Protected Zone: Center (${portalX.toFixed(1)}, ${portalY.toFixed(1)}), Radius ${Math.sqrt(protectedRadiusSq).toFixed(1)}`); // Too noisy
    }

    const changedCells = []; // Array to store {c, r} of changed cells

    // Iterate through ALL cells
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {

            // --- Protected Zone Check ---
            const blockCenterX = c * Config.BLOCK_WIDTH + Config.BLOCK_WIDTH / 2;
            const blockCenterY = r * Config.BLOCK_HEIGHT + Config.BLOCK_HEIGHT / 2;
            const dx = blockCenterX - portalX;
            const dy = blockCenterY - portalY;
            const distSqToPortal = dx * dx + dy * dy;

            // If the block center is strictly within the protected zone, skip aging logic for this block.
            if (distSqToPortal < protectedRadiusSq) {
                 continue; // Skip aging for this block
            }
            // --- End Protected Zone Check ---


            // --- Aging Logic (Only applies to blocks OUTSIDE or ON the protected zone boundary) ---

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
            const hasSolidBelow_rPlus1 = GridCollision.isSolid(c, r + 1) || r + 1 >= Config.GRID_ROWS;


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
                 // If Rule 1 applied, we stop processing rules for this block.
                 // If newType !== originalType after this block, the change will be applied below and we continue to the next cell.
            }

            // NEW Rule 1.5: SAND Sedimentation Below (MODIFIED FOR EQUAL CHANCE PER CONVERTIBLE MATERIAL)
            // Apply only if the block wasn't changed by Rule 1 and is SAND.
            if (newType === originalType && originalType === Config.BLOCK_SAND) {

                // Get the block immediately below (c, r+1)
                const blockBelow = WorldData.getBlock(c, r + 1);

                // Skip if out of bounds below OR if the block below is already SAND or AIR or WATER
                // Use a more explicit check: is it a block that exists and is NOT sand, air, or water?
                if (blockBelow !== null &&
                    (typeof blockBelow === 'object' ?
                         (blockBelow.type !== Config.BLOCK_SAND && blockBelow.type !== Config.BLOCK_AIR && blockBelow.type !== Config.BLOCK_WATER) :
                         (blockBelow !== Config.BLOCK_AIR && blockBelow !== Config.BLOCK_WATER) // Case where it's the AIR constant
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
                        const waterInfluenceMultiplier = Math.min(waterDepth, maxInfluenceDepth) / maxInfluenceDepth;


                        // Calculate the final probability for this SAND block to convert the block below
                        // Removed multiplication by materialFactor for equal chance
                        const sedimentationBelowProb = Config.AGING_PROB_SAND_SEDIMENTATION_BELOW * clampedIntensity * waterInfluenceMultiplier;

                        // Apply random chance
                        if (Math.random() < sedimentationBelowProb) {
                            // Change the block below to SAND
                            const newBlockBelowType = Config.BLOCK_SAND;
                            const success = WorldData.setBlock(c, r + 1, newBlockBelowType, false); // New sand is not player-placed

                            if (success) {
                                // Add the changed cell (r+1) to the list, avoiding duplicates
                                // The main.js loop or WorldManager.renderStaticWorldToGridCanvas will handle unique updates.
                                // Just add to the list here.
                                changedCells.push({ c, r: r + 1 });
                                // console.log(`[${c},${r+1}] ${Config.BLOCK_COLORS[blockBelowType]} converted to SAND by SAND above (Water Depth: ${waterDepth}, Prob: ${sedimentationBelowProb.toFixed(5)}).`);
                            } else {
                                console.error(`Aging failed to set block data at [${c}, ${r+1}] to SAND during sedimentation below rule.`);
                            }
                        }
                    } // End if isConvertibleMaterial
                } // End if blockBelow is valid and potentially convertible
            } // End NEW Rule 1.5


            // Rule 2: DIRT/GRASS Water Erosion -> SAND
            // Apply only if the block wasn't changed by previous rules (including Rule 1) and is DIRT/GRASS.
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
                 const blockBelowType = WorldData.getBlockType(c, r + 1);
                 const isBelowSolidAndWithinBounds = blockBelowType !== null && GridCollision.isSolid(c, r + 1);

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
            // Apply only if the block wasn't changed by previous rules and is DIRT, GRASS, or SAND (if sand exists)
            if (newType === originalType && (originalType === Config.BLOCK_DIRT || originalType === Config.BLOCK_GRASS || originalType === Config.BLOCK_SAND)) {
                if (depth > Config.AGING_STONEIFICATION_DEPTH_THRESHOLD) { // Only happens at sufficient depth
                    const stoneProb = Config.AGING_PROB_STONEIFICATION_DEEP * clampedIntensity;
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
            // Apply only if the block wasn't changed and is currently AIR or WATER AND below the waterline threshold.
            if (newType === originalType && originalType === Config.BLOCK_AIR && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET) { //changed this from water and air to just air FYI
                 // This rule relies on finding a solid block below, but doesn't need the distance calculation.
                 // Let's simplify this - it just needs *some* solid block below or at the bottom of the map.
                 // Re-use findFirstSolidBlockBelow, but just check if it returns -1 or the bottom row index.
                 const firstSolidRowBelow = findFirstSolidBlockBelow(c, r); // Finds solid below or -1
                 const hasSolidBelowOrIsBottom = (firstSolidRowBelow !== -1) || (r === Config.GRID_ROWS - 1);

                 if (hasSolidBelowOrIsBottom) {
                     // If there's solid ground below or this is the bottom row, apply sedimentation chance
                     // This probability is now separate from the NEW sand-below rule.
                     // Use AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER constant.
                     const sedimentationProb = Config.AGING_PROB_SEDIMENTATION_UNDERWATER_AIR_WATER * clampedIntensity;
                     if (Math.random() < sedimentationProb) {
                         newType = Config.BLOCK_SAND; // AIR/WATER becomes SAND
                         // console.log(`[${c},${r}] ${originalType === Config.BLOCK_AIR ? 'AIR' : 'WATER'} sedimented into SAND.`);
                     }
                 }
             }
            // TODO: Add rules for other block types (Wood, Metal, Bone, etc.) aging here


            // --- Apply Change and Record ---
            // If the aging rule decided to change the block type
            // Note: The NEW Rule 1.5 modifies the block at (c, r+1), which is handled and added to changedCells there.
            // This final block checks if the block at (c, r) changed type due to rules 1, 2, 3, 4, 5, or 6.
            if (newType !== originalType) {
                // Create the new block data object, preserving playerPlaced status if changing type
                const newBlockData = createBlock(newType, isPlayerPlaced);

                // Update the block data in the grid using the direct setter as we already have the block data object
                const success = WorldData.setBlockData(c, r, newBlockData);

                if (success) {
                    // We just record that this cell changed.
                    // Check if it's already in the list before adding
                     const changedKey = `${c},${r}`;
                     // The main.js loop or WorldManager.renderStaticWorldToGridCanvas will handle unique updates.
                     // Just add to the list here.
                     changedCells.push({ c, r });
                    // console.log(`Aging changed [${c}, ${r}] from ${originalType} to ${newType}.`); // Debug log
                } else {
                     console.error(`Aging failed to set block data at [${c}, ${r}] to type ${newType}.`);
                }
            }
        }
    }
    console.log(`Aging pass complete. ${changedCells.length} blocks changed.`);
    // After all cells have been processed, sort the changedCells list by row (descending)
    // This helps WorldManager/Renderer update the static canvas more efficiently for cascading changes
    changedCells.sort((a, b) => b.r - a.r);

    return changedCells; // Return the list of unique changed cells
}