// js/worldGenerator.js

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import { setBlockData, getBlockType, setBlock } from './worldData.js';

// --- Helper functions ---
function lerp(t, a, b) {
    return a + t * (b - a);
}

// --- Module State ---
let noiseGenerator = null; // Generator instance

/**
 * Generates the initial landmass (Stone/Dirt/Grass) and fills the rest with Air.
 * Modifies the grid directly using imported functions from world-data.
 * Uses a multi-pass approach with boundary smoothing.
 */
function generateLandmass() {
    console.log("Generating landmass with boundary smoothing...");
    noiseGenerator = new PerlinNoise();

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;
    const islandTaperWidth = 80; // Taper from island edge towards center

    // --- Ensure these constants are correctly defined and exported in config.js ---
    // Ocean level constants (derive or define directly in Config)
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5;
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;
    // Using direct calculation here for clarity, assuming config might not export intermediate _deep... values
    const deepOceanBaseRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1);
    const deepOceanMaxRow = Config.GRID_ROWS - 3;
    const deepOceanFloorStartRow = Math.min(deepOceanMaxRow, deepOceanBaseRow);
    const deepOceanStoneStartRow = deepOceanFloorStartRow + 8;

    // Edge taper constants
    const edgeTaperWidth = Math.floor(Config.GRID_COLS * 0.15);
    const edgeStoneLevelTarget = Config.GRID_ROWS + 5; // Target stone level AT THE EDGE (below map)
    const edgeFloorLevelTarget = deepOceanFloorStartRow + 10; // Target floor level AT THE EDGE
    // --- End Config Constant Dependencies ---


    // Intermediate storage for calculated levels per column
    let worldLevels = Array(Config.GRID_COLS).fill(null);

    // --- Pass 1: Calculate all levels (Island or Ocean) without placing blocks ---
    console.log("Pass 1: Calculating initial levels...");
    for (let c = 0; c < Config.GRID_COLS; c++) {
        // Calculate base island levels (used inside island logic)
        const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
        const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
        let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;

        const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
        // Ensure WORLD_STONE_LEVEL_MEAN is based on ground level in Config!
        let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
        // Clamp base stone relative to base surface
        baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow);

        let calcSurfaceRow, calcStoneRow;
        let isOceanColumn = !(c >= islandStartCol && c < islandEndCol);

        if (!isOceanColumn) {
            // --- Inside Island Calculation ---
            const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);
            calcSurfaceRow = baseSurfaceRow; // Start with base levels
            calcStoneRow = baseStoneRow;

            // Apply island taper if within the taper zone
            if (distToIslandEdge < islandTaperWidth && islandTaperWidth > 0) {
                // Use linear blend for simplicity first
                const islandBlend = Math.max(0, distToIslandEdge) / islandTaperWidth;
                // Blend from Ocean levels (at edge, blend=0) towards Base levels (inland, blend=1)
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }
            // Clamp final island levels after taper
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
            // Keep island stone on map (important!)
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcStoneRow));
            calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow); // Ensure stone below surface

        } else {
            // --- Outside Island (Ocean) Calculation ---
            let currentOceanFloorLevel = deepOceanFloorStartRow;
            let currentOceanStoneLevel = deepOceanStoneStartRow;
            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            // Transition from near-island ocean levels to deep ocean levels
            const deepOceanTransitionWidth = islandStartCol / 2; // How far out the transition to deep ocean takes

            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 // Blend from Near Island levels (blend=0) towards Deep Ocean levels (blend=1)
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) { // Closest to island edge
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }

            // Apply absolute edge taper (blends towards off-map/deep edge targets)
            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
            let finalOceanStoneLevel = currentOceanStoneLevel; // Start with level from deep/near blend
            let finalOceanFloorLevel = currentOceanFloorLevel;

            if (distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5); // Example easing
                // Blend from Edge Target levels (blend=0) towards Current Ocean levels (blend=1)
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel));
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }

            // Assign final calculated ocean levels
            // Ocean surface is sand/floor
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel));
            // Ocean stone can be off map (use GRID_ROWS for clamp max)
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel));
            // Ensure stone is below surface *if* stone is on the map
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
            }
        }

        // Store calculated levels for this column
        worldLevels[c] = { surface: calcSurfaceRow, stone: calcStoneRow, isOcean: isOceanColumn };

    } // End Pass 1

    // --- Pass 2: Smooth the boundary between ocean and island levels ---
    console.log("Pass 2: Smoothing boundaries...");
    // How many columns INTO the island to blend with the adjacent ocean column's values
    const smoothingWidth = 5; // Adjust this for a wider/narrower smoothed beach transition

    for (let i = 0; i < smoothingWidth; i++) {
        // --- Left Boundary Smoothing ---
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1; // Index of the closest ocean column

        // Check if columns are valid and have data
        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            // Blend factor: 0 = pure ocean, 1 = pure island original calc.
            // Increases as 'i' increases (moves further into the island).
            const blendFactor = (i + 1) / (smoothingWidth + 1); // Simple linear blend

            // Get original calculated island levels and the reference ocean level
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface; // The target to blend from
            const refOceanStone = worldLevels[oceanCol].stone;

            // Apply blend: Lerp from ocean reference towards original island calc
            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));

            // Re-apply clamps after smoothing
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].stone)); // Island stone stays on map
            worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
        }

        // --- Right Boundary Smoothing ---
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol; // Index of the closest ocean column

         // Check if columns are valid and have data
         if (islandColR >= islandStartCol && oceanColR < Config.GRID_COLS && worldLevels[islandColR] && worldLevels[oceanColR]) {
            // Blend factor is the same as for the left side
            const blendFactor = (i + 1) / (smoothingWidth + 1);

            const originalIslandSurfaceR = worldLevels[islandColR].surface;
            const originalIslandStoneR = worldLevels[islandColR].stone;
            const refOceanSurfaceR = worldLevels[oceanColR].surface; // The target to blend from
            const refOceanStoneR = worldLevels[oceanColR].stone;

            // Apply blend: Lerp from ocean reference towards original island calc
            worldLevels[islandColR].surface = Math.round(lerp(blendFactor, refOceanSurfaceR, originalIslandSurfaceR));
            worldLevels[islandColR].stone = Math.round(lerp(blendFactor, refOceanStoneR, originalIslandStoneR));

            // Re-apply clamps after smoothing
            worldLevels[islandColR].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].surface));
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].stone)); // Island stone stays on map
            worldLevels[islandColR].stone = Math.max(worldLevels[islandColR].surface + 1, worldLevels[islandColR].stone);
        }
    } // End Pass 2

    // --- Pass 3: Place blocks based on final (smoothed) levels ---
    console.log("Pass 3: Placing blocks...");
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
             let blockData = Config.BLOCK_AIR; // Default to AIR
             const levels = worldLevels[c];
             if (!levels) {
                 console.warn(`Missing level data for column ${c} during block placement.`);
                 setBlockData(c, r, Config.BLOCK_AIR); // Place air as fallback
                 continue;
             }

             const finalSurfaceRow = levels.surface;
             const finalStoneRow = levels.stone;

             if (levels.isOcean) {
                 // Ocean Block Placement (Sand surface)
                 // Check stone first
                 if (r >= finalStoneRow && finalStoneRow < Config.GRID_ROWS) {
                     // Place stone IF we are at/below the final stone line AND that line is on the map.
                     blockData = createBlock(Config.BLOCK_STONE);
                 } else if (r >= finalSurfaceRow) {
                      // Place sand if we are at/below the surface level AND not stone
                      // This correctly handles cases where stone is off-map (finalStoneRow >= GRID_ROWS)
                      blockData = createBlock(Config.BLOCK_SAND);
                 }
                 // If r < finalSurfaceRow, it remains AIR (to be filled by water)

             } else {
                 // Island Block Placement (Grass/Dirt surface)
                 if (r >= finalStoneRow) {
                     blockData = createBlock(Config.BLOCK_STONE);
                 } else if (r > finalSurfaceRow) {
                     blockData = createBlock(Config.BLOCK_DIRT);
                 } else if (r === finalSurfaceRow) {
                     blockData = createBlock(Config.BLOCK_GRASS);
                 }
                 // If r < finalSurfaceRow, it remains AIR
             }
             // Set the block data using the direct, faster method
             setBlockData(c, r, blockData);
        }
    } // End Pass 3
    console.log("Landmass generation complete.");
} // End generateLandmass


// --- Flood Fill Function ---
/**
 * Fills connected air blocks below the target water level with water using Flood Fill (BFS).
 * Uses getBlockType and setBlock from world-data.
 * @param {number} targetWaterRow - The highest row index (inclusive) that water should reach.
 */
function applyFloodFill(targetWaterRow) {
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // Track visited cells: "c,r"

    // --- Optimized Start Points for Flood Fill ---
    // Start from the bottom row and the sides *at or below* the water level.
    // This assumes the generator leaves AIR where water should be.

    // Bottom Row
    for (let c = 0; c < Config.GRID_COLS; c++) {
        const r = Config.GRID_ROWS - 1;
        const key = `${c},${r}`;
        // Check if it's AIR and below the target water level (it always will be if r=GRID_ROWS-1)
        // Ensure it's actually AIR before starting
        if (getBlockType(c, r) === Config.BLOCK_AIR && r >= targetWaterRow && !visited.has(key)) {
             queue.push({ c, r });
             visited.add(key);
        }
    }

    // Sides (at or below water level)
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
        // Check bounds for r just in case targetWaterRow is calculated strangely
        if (r < 0 || r >= Config.GRID_ROWS) continue;

        // Left Side (c=0)
        const keyLeft = `0,${r}`;
        if (getBlockType(0, r) === Config.BLOCK_AIR && !visited.has(keyLeft)) {
            queue.push({ c: 0, r });
            visited.add(keyLeft);
        }
        // Right Side (c = max col)
        const rightCol = Config.GRID_COLS - 1;
        const keyRight = `${rightCol},${r}`;
        if (getBlockType(rightCol, r) === Config.BLOCK_AIR && !visited.has(keyRight)) {
            queue.push({ c: rightCol, r });
            visited.add(keyRight);
        }
    }

    // Standard BFS
    let processed = 0;
    while (queue.length > 0) {
        // Optimization: Log progress occasionally for large fills
        if (queue.length > 5000 && processed % 5000 === 0) {
            console.log(`Flood fill queue size: ${queue.length}, Processed: ${processed}`);
        }

        const { c, r } = queue.shift();

        // Get current block type at {c, r} *inside* the loop
        const currentBlockType = getBlockType(c, r);

        // Check bounds AND if it's still AIR (important: might have been visited but not filled yet,
        // or filled by another path) AND ensure we only fill AT or BELOW target level
        if (currentBlockType === null || // Out of bounds check via getBlockType
            currentBlockType !== Config.BLOCK_AIR ||
            r < targetWaterRow) // Don't fill above the target water level
        {
             continue;
        }

        // Fill with water: Use setBlock to create the water block object correctly
        // This also handles the boundary check again, just in case.
        const didSet = setBlock(c, r, Config.BLOCK_WATER);
        if(didSet) {
            processed++;
        } else {
            // This shouldn't happen if bounds checks above are correct, but log if it does
            console.warn(`Flood fill failed to set water at ${c}, ${r} despite passing checks.`);
            continue; // Don't process neighbors if block couldn't be set
        }

        // Add valid AIR neighbors (at or below targetWaterRow) to the queue
        const neighborCoords = [
            { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, // Up, Down
            { nc: c - 1, nr: r }, { nc: c + 1, nr: r }  // Left, Right
        ];

        for (const { nc, nr } of neighborCoords) {
            // Check neighbor bounds AND ensure it's at or below water level
            if (nr >= targetWaterRow && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                const nKey = `${nc},${nr}`;
                // Check if neighbor is AIR *and* not already visited/queued
                if (getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) {
                    visited.add(nKey);
                    queue.push({ c: nc, r: nr });
                }
            }
        }
    }
    console.log(`Flood fill complete. Filled ${processed} water blocks.`);
}


// --- Sand Pass Function ---
/**
 * Applies sand generation along water edges after flood fill.
 * Uses getBlockType and setBlock from world-data.
 */
function applySandPass() {
    console.log("Applying sand generation pass (thicker beaches)...");
    const changes = []; // Store {r, c, type: Config.BLOCK_SAND} to apply later
    const maxDepth = 3; // How many blocks deep sand replaces dirt/stone below the surface sand
    const maxRaise = 1; // How far above nominal water level sand can generate on slopes/edges
    // Calculate check range slightly wider than just water level +/- depth/raise
    const minCheckRow = Math.max(0, Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise - 2);
    const maxCheckRow = Math.min(Config.GRID_ROWS, Config.WORLD_WATER_LEVEL_ROW_TARGET + maxDepth + 5);

    // --- Pass 1: Find initial sand candidates (Dirt/Stone/Grass next to Water) ---
    for (let r = minCheckRow; r < maxCheckRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockType(c, r);
            // Check if the block is replaceable by surface sand
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE || blockType === Config.BLOCK_GRASS) {
                // Check 8 neighbors for water
                let adjacentWater = false;
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];
                for (const { nc, nr } of neighborCoords) {
                    // Check neighbor bounds before getting type
                    if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                        if (getBlockType(nc, nr) === Config.BLOCK_WATER) {
                            adjacentWater = true;
                            break; // Found water neighbor, no need to check others
                        }
                    }
                }
                // Only mark for change if adjacent to water AND within the height range for surface sand
                if (adjacentWater && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise) {
                    // Store the coordinate and target type
                    changes.push({ r, c, type: Config.BLOCK_SAND });
                }
            }
        }
    }

    // --- Pass 2: Process candidates, apply downward generation, and collect final changes ---
    const finalChanges = []; // Holds blocks to actually change
    const changedCoords = new Set(); // Keep track of coords already marked for sand: "r,c"

    // Process initial candidates first to ensure surface sand is prioritized
    for (const change of changes) {
         const key = `${change.r},${change.c}`;
         if (!changedCoords.has(key)) {
              finalChanges.push(change); // Add this surface sand block to the final list
              changedCoords.add(key);     // Mark coordinate as becoming sand
         }
    }

    // Now iterate through the *initial* surface sand blocks found
    // Create a copy because we might add to finalChanges inside the loop, avoid infinite loops
    const surfaceSandCandidates = [...finalChanges]; // Contains only the surface blocks identified above
    for (const sandBlock of surfaceSandCandidates) {
        // Check blocks below this surface sand block
        for (let depth = 1; depth <= maxDepth; depth++) {
            const below_r = sandBlock.r + depth;
            const below_c = sandBlock.c; // Same column
            const key = `${below_r},${below_c}`;

            // Stop if already marked as sand or out of bounds
            if (changedCoords.has(key) || below_r >= Config.GRID_ROWS) continue;

            const belowType = getBlockType(below_c, below_r);
            // Only replace Dirt or Stone below the surface sand
            if (belowType === Config.BLOCK_DIRT || belowType === Config.BLOCK_STONE) {
                 // Check if the block directly *above* this one IS sand (or is marked to become sand)
                 // This prevents sand forming under overhangs where water isn't directly above.
                 const aboveKey = `${below_r - 1},${below_c}`;
                 if (changedCoords.has(aboveKey)) {
                     finalChanges.push({ r: below_r, c: below_c, type: Config.BLOCK_SAND });
                     changedCoords.add(key); // Mark this deeper block as sand now
                 } else {
                     // If the block above is not sand, stop going deeper in this column
                     break;
                 }
            } else {
                // Stop going deeper if it hits Air, Water, existing Sand, or something else unbreakable
                break;
            }
        }
    }

    // --- Pass 3: Apply all collected changes to the world grid ---
    finalChanges.forEach(change => {
        // Use setBlock to ensure correct block object creation and handle bounds check
        setBlock(change.c, change.r, change.type);
    });
    console.log(`Sand pass complete. ${finalChanges.length} blocks changed to sand.`);
}


// --- Public API ---

/**
 * Runs the entire world generation process, step-by-step.
 * Assumes the grid has been initialized by world-data.initializeGrid().
 */
export function generateInitialWorld() {
    console.time("WorldGen");
    console.log("Starting initial world generation...");

    // Step 1: Generate base landmass, calculate levels, smooth boundaries, place blocks
    generateLandmass(); // Uses the new multi-pass method

    // Step 2: Fill appropriate air pockets with water
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);

    // Step 3: Add sand layers near water edges
    applySandPass();

    console.timeEnd("WorldGen");
    console.log("Initial world generation finished.");
}