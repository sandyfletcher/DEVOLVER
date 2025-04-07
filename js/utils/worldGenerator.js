// js/world-generator.js

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
// Correct the import path if block.js is in utils directory relative to this file
// If worldGenerator.js is in js/ and block.js is in js/utils/, use:
// import { createBlock } from './utils/block.js';
// If both are in js/, use:
import { createBlock } from './block.js'; // Assuming flat structure or adjust path
import { setBlock, setBlockData, getBlockType } from './worldData.js'; // Assuming flat structure or adjust path

// --- Helper functions ---
function lerp(t, a, b) {
    return a + t * (b - a);
}

// --- Module State ---
let noiseGenerator = null; // Generator instance

/**
 * Generates the initial landmass (Stone/Dirt/Grass) and fills the rest with Air.
 * Modifies the grid directly using imported functions from world-data.
 */
function generateLandmass() {
    console.log("Generating landmass with unified taper and edge stone taper...");
    noiseGenerator = new PerlinNoise();

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;
    const islandTaperWidth = 80; // Taper from island edge towards ocean floor

    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5;
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;

    const deepOceanBaseRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1);
    const deepOceanMaxRow = Config.GRID_ROWS - 3; // Leave a few rows at the bottom
    const deepOceanFloorStartRow = Math.min(deepOceanMaxRow, deepOceanBaseRow);
    const deepOceanStoneStartRow = deepOceanFloorStartRow + 5; // Base stone level under deep floor

    const edgeTaperWidth = Math.floor(Config.GRID_COLS * 0.15); // Taper stone over ~15% of width from each edge
    const edgeStoneLevelTarget = Config.GRID_ROWS + 5; // Target stone level AT THE EDGE (below the map = no stone)


    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let blockData = Config.BLOCK_AIR; // Default to AIR

            // Calculate base island heights (only needed if potentially inside island)
            const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
            const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
            let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;

            const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
            const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
            let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
            baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow);


            if (c >= islandStartCol && c < islandEndCol) {
                // --- Inside Island Area (Includes Taper Zone) ---
                const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);
                let finalSurfaceRow = baseSurfaceRow;
                let finalStoneRow = baseStoneRow;

                if (distToIslandEdge < islandTaperWidth && islandTaperWidth > 0) {
                    const islandBlend = Math.pow(Math.max(0, distToIslandEdge) / islandTaperWidth, 0.75);
                    finalSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                    finalStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
                    finalStoneRow = Math.max(finalSurfaceRow + 2, finalStoneRow);
                }

                finalSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalSurfaceRow));
                finalStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalStoneRow));
                finalStoneRow = Math.max(finalSurfaceRow + 1, finalStoneRow);


                // Determine Block Type for the ISLAND
                if (r >= finalStoneRow) blockData = createBlock(Config.BLOCK_STONE);
                else if (r > finalSurfaceRow) blockData = createBlock(Config.BLOCK_DIRT);
                else if (r === finalSurfaceRow) blockData = createBlock(Config.BLOCK_GRASS);
                // If r < finalSurfaceRow, remains BLOCK_AIR

            } else {
                // --- Outside Island Area (Ocean) ---

                // 1. Calculate base ocean floor/stone levels (tapering away from island)
                let baseOceanFloorLevel = deepOceanFloorStartRow;
                let baseOceanStoneLevel = deepOceanStoneStartRow;
                const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
                const deepOceanTransitionWidth = islandStartCol / 2;

                if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                     const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                     baseOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                     baseOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
                } else if (distFromIslandEdge <= 0) {
                     baseOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                     baseOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
                }

                // 2. Apply edge taper to STONE level
                const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
                let finalOceanStoneLevel = baseOceanStoneLevel; // Start with level from step 1

                if (distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                    const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5);
                    finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, baseOceanStoneLevel));
                }

                // 3. Set final floor level (sand) - APPLY EDGE TAPER HERE TOO
                let finalOceanFloorLevel = baseOceanFloorLevel; // Start with level from step 1

                // Define a target floor level AT THE EDGE (deeper than normal floor)
                // Make it somewhat relative to the deep floor, e.g., 10 blocks deeper
                const edgeFloorLevelTarget = deepOceanFloorStartRow + 10; // Adjust '10' as needed

                // Use the SAME edgeBlend calculated in Step 2 for stone
                if (distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                    const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5);
                    // Interpolate between the deep edge target and the normal base floor level
                    finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, baseOceanFloorLevel));
                }

                // 4. Clamp levels
                finalOceanFloorLevel = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel));
                // Clamp stone AFTER interpolation, ensuring it's below the map if needed
                finalOceanStoneLevel = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel)); // Allow >= GRID_ROWS
                // Ensure stone is below sand *if* stone is actually placed
                if (finalOceanStoneLevel < Config.GRID_ROWS) {
                     finalOceanStoneLevel = Math.max(finalOceanFloorLevel + 1, finalOceanStoneLevel);
                }


                // 5. ******** CORRECTED BLOCK PLACEMENT LOGIC FOR OCEAN ********
                // Order matters: Check stone first, then sand, otherwise default to air.

                if (r >= finalOceanStoneLevel && finalOceanStoneLevel < Config.GRID_ROWS) {
                    // Place stone IF we are at/below the final stone line AND that line is on the map.
                    blockData = createBlock(Config.BLOCK_STONE);
                } else if (r >= finalOceanFloorLevel && r < finalOceanStoneLevel) {
                    // Place sand IF we are at/below the sand line BUT *above* the final stone line.
                    // This prevents sand from filling the area where stone has been tapered away.
                    blockData = createBlock(Config.BLOCK_SAND);
                }
                // If neither of the above conditions are met (i.e., r < finalOceanFloorLevel),
                // blockData remains the default Config.BLOCK_AIR, ready for flood fill.

            }

            // Set the block data in the grid
            setBlockData(c, r, blockData);
        }
    }
    console.log("Landmass generation complete.");
}

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
        if (getBlockType(c, r) === Config.BLOCK_AIR && r >= targetWaterRow && !visited.has(key)) {
             queue.push({ c, r });
             visited.add(key);
        }
    }

    // Sides (at or below water level)
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
        // Left Side
        const keyLeft = `0,${r}`;
        if (getBlockType(0, r) === Config.BLOCK_AIR && !visited.has(keyLeft)) {
            queue.push({ c: 0, r });
            visited.add(keyLeft);
        }
        // Right Side
        const keyRight = `${Config.GRID_COLS - 1},${r}`;
        if (getBlockType(Config.GRID_COLS - 1, r) === Config.BLOCK_AIR && !visited.has(keyRight)) {
            queue.push({ c: Config.GRID_COLS - 1, r });
            visited.add(keyRight);
        }
    }

    // Standard BFS
    let processed = 0;
    while (queue.length > 0) {
        // Optimization: Check queue length before potentially long operations
        if (queue.length > 10000 && queue.length % 1000 === 0) { // Log progress occasionally for large fills
            console.log(`Flood fill queue size: ${queue.length}`);
        }

        const { c, r } = queue.shift();

        // Double check bounds and if it's still AIR (might have been filled by another path)
        // Also ensure we only fill AT or BELOW target level
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || getBlockType(c,r) !== Config.BLOCK_AIR) {
             continue;
        }

        // Fill with water
        setBlock(c, r, Config.BLOCK_WATER); // Use imported setter
        processed++;


        // Add valid AIR neighbors (below targetWaterRow) to the queue
        const neighborCoords = [
            { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 },
            { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
        ];

        for (const { nc, nr } of neighborCoords) {
            // Ensure neighbor is within bounds AND at or below water level
            if (nr >= targetWaterRow && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                const nKey = `${nc},${nr}`;
                // Check if it's AIR and not visited
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
    const changes = []; // Store {r, c, type: Config.BLOCK_SAND}
    const maxDepth = 3; // How many blocks deep sand replaces dirt/stone below the surface sand
    const maxRaise = 1; // How far above water level sand can generate on slopes
    const minCheckRow = Math.max(0, Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise - 2);
    const maxCheckRow = Math.min(Config.GRID_ROWS, Config.WORLD_WATER_LEVEL_ROW_TARGET + maxDepth + 5);

    // Find initial sand candidates (Dirt/Stone/Grass next to Water)
    for (let r = minCheckRow; r < maxCheckRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockType(c, r);
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE || blockType === Config.BLOCK_GRASS) {
                // Check 8 neighbors for water
                let adjacentWater = false;
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];
                for (const { nc, nr } of neighborCoords) {
                    // Important: Check bounds for neighbors too!
                    if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                        if (getBlockType(nc, nr) === Config.BLOCK_WATER) {
                            adjacentWater = true;
                            break;
                        }
                    }
                }
                // Only place if adjacent to water AND not too high above nominal water level
                if (adjacentWater && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise) {
                    changes.push({ r, c, type: Config.BLOCK_SAND });
                }
            }
        }
    }

    // Make changes unique and apply downward sand generation
    const finalChanges = [];
    const changedCoords = new Set(); // Keep track of coords already marked for sand: "r,c"

    // Process initial candidates first to ensure surface sand is prioritized
    for (const change of changes) {
         const key = `${change.r},${change.c}`;
         if (!changedCoords.has(key)) {
              finalChanges.push(change);
              changedCoords.add(key);
         }
    }

    // Now iterate through the surface sand blocks and generate downwards
    // Create a copy because we might add to finalChanges inside the loop
    const surfaceSand = [...finalChanges];
    for (const sandBlock of surfaceSand) {
        for (let depth = 1; depth <= maxDepth; depth++) {
            const below_r = sandBlock.r + depth;
            const below_c = sandBlock.c;
            const key = `${below_r},${below_c}`;

            // Stop if already sand or out of bounds
            if (changedCoords.has(key) || below_r >= Config.GRID_ROWS) continue;

            const belowType = getBlockType(below_c, below_r);
            // Only replace Dirt or Stone below
            if (belowType === Config.BLOCK_DIRT || belowType === Config.BLOCK_STONE) {
                 // Check if the block directly *above* this one is going to be sand (or already is)
                 // This prevents sand forming under overhangs where water isn't directly above.
                 const aboveKey = `${below_r - 1},${below_c}`;
                 if (changedCoords.has(aboveKey)) {
                     finalChanges.push({ r: below_r, c: below_c, type: Config.BLOCK_SAND });
                     changedCoords.add(key);
                 } else {
                     break; // Stop going deeper if the block above isn't sand
                 }
            } else {
                break; // Stop going deeper if it hits Air, Water, or something else
            }
        }
    }

    // Apply all collected changes
    finalChanges.forEach(change => {
        // Double check bounds just in case, though logic should prevent OOB
        if (change.r >= 0 && change.r < Config.GRID_ROWS && change.c >= 0 && change.c < Config.GRID_COLS) {
           setBlock(change.c, change.r, change.type);
        }
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
    generateLandmass();
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    applySandPass();
    console.timeEnd("WorldGen");
    console.log("Initial world generation finished.");
}