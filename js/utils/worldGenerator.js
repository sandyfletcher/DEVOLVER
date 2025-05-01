// -----------------------------------------------------------------------------
// root/js/utils/worldGenerator.js - Semi-random world generation to start game
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import { setBlockData, getBlockType, setBlock } from './worldData.js';

// --- Helper ---
function lerp(t, a, b) {
    return a + t * (b - a);
}

// --- Module State ---
let noiseGenerator = null; // Generator instance

// --- Generates initial landmass (Stone/Dirt/Grass) and fills the rest with Air by modifying grid directly ---
function generateLandmass() {
    // console.log("Generating landmass with boundary smoothing...");
    noiseGenerator = new PerlinNoise();
    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH); // 200*0.8=160
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);              // 200-160=40/2=20
    const islandEndCol = islandStartCol + islandWidth;                                    // 20+160=180
    const islandTaperWidth = 80; // Taper from island edge towards center
    // Ocean level constants from Config (ensure they are defined there)
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5;
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;
    const deepOceanFloorStartRow = Math.min(Config.GRID_ROWS - 3, Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1));
    const deepOceanStoneStartRow = deepOceanFloorStartRow + 8;

    // Edge taper constants
    const edgeTaperWidth = Math.floor(Config.GRID_COLS * 0.15);
    const edgeStoneLevelTarget = Config.GRID_ROWS + 5; // Target stone level AT THE EDGE (below map)
    const edgeFloorLevelTarget = deepOceanFloorStartRow + 10; // Target floor level below deep ocean floor at edge
    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH; // Use config value

    // Intermediate storage for calculated levels
    let worldLevels = Array(Config.GRID_COLS).fill(null);

    // --- Pass 1: Calculate all levels (Island or Ocean) ---
    console.log("Pass 1: Calculating initial levels...");
    for (let c = 0; c < Config.GRID_COLS; c++) {
        // Calculate base island levels (used inside island logic)
        const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
        const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
        let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;

        const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
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
                // Use linear blend for simplicity first, pow(0.75) can be added back later if needed
                const islandBlend = Math.max(0, distToIslandEdge) / islandTaperWidth;
                // Blend from Ocean levels (at edge, blend=0) towards Base levels (inland, blend=1)
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }
            // Clamp final island levels after taper
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcStoneRow)); // Keep island stone on map
            calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow); // Ensure stone below surface

        } else {
            // --- Outside Island Calculation ---
            let currentOceanFloorLevel = deepOceanFloorStartRow;
            let currentOceanStoneLevel = deepOceanStoneStartRow;
            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            // Transition from near-island ocean levels to deep ocean levels
            const deepOceanTransitionWidth = islandStartCol / 2; // Or some other value

            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 // Blend from Near Island levels (blend=0) towards Deep Ocean levels (blend=1)
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) { // Closest to island
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }

            // Apply absolute edge taper (blends towards off-map/deep edge targets)
            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
            let finalOceanStoneLevel = currentOceanStoneLevel; // Start with level from deep/near blend
            let finalOceanFloorLevel = currentOceanFloorLevel;

            if (distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5);
                // Blend from Edge Target levels (blend=0) towards Current Ocean levels (blend=1)
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel));
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }

            // Assign final calculated ocean levels
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel)); // Ocean surface is sand/floor
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel)); // Ocean stone can be off map
            // Ensure stone is below surface if stone is on the map
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
            }
        }

        // Store calculated levels for this column
        worldLevels[c] = { surface: calcSurfaceRow, stone: calcStoneRow, isOcean: isOceanColumn };

    } // End Pass 1

    // --- Pass 2: Smooth the boundary ---
    console.log("Pass 2: Smoothing boundaries...");
    const smoothingWidth = 20; // How many columns INTO the island to blend with ocean values, Adjust this for a wider/narrower smoothed beach transition
    for (let i = 0; i < smoothingWidth; i++) {
        // --- Left Boundary ---
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1; // Always reference the closest ocean column

        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            // Blend factor: 0 = pure ocean, 1 = pure island original calc
            // We want less ocean influence as we go deeper into the island
            const blendFactor = (i + 1) / (smoothingWidth + 1); // Simple linear blend for now

            // Get original calculated island levels and the reference ocean level
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface;
            const refOceanStone = worldLevels[oceanCol].stone;

            // Apply blend: Lerp from ocean reference towards original island calc
            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));

            // Re-apply clamps after smoothing
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].stone)); // Keep stone on map
            worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
        }

        // --- Right Boundary ---
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol; // Always reference the closest ocean column

         if (islandColR >= islandStartCol && oceanColR < Config.GRID_COLS && worldLevels[islandColR] && worldLevels[oceanColR]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1);

            const originalIslandSurfaceR = worldLevels[islandColR].surface;
            const originalIslandStoneR = worldLevels[islandColR].stone;
            const refOceanSurfaceR = worldLevels[oceanColR].surface;
            const refOceanStoneR = worldLevels[oceanColR].stone;

            worldLevels[islandColR].surface = Math.round(lerp(blendFactor, refOceanSurfaceR, originalIslandSurfaceR));
            worldLevels[islandColR].stone = Math.round(lerp(blendFactor, refOceanStoneR, originalIslandStoneR));

            // Re-apply clamps after smoothing
            worldLevels[islandColR].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].surface));
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].stone)); // Keep stone on map
            worldLevels[islandColR].stone = Math.max(worldLevels[islandColR].surface + 1, worldLevels[islandColR].stone);
        }
    } // End Pass 2

    // --- Pass 3: Place blocks based on final levels ---
// --- Pass 3: Place blocks based on final levels ---
console.log("Pass 3: Placing blocks with controlled sand depth...");
for (let r = 0; r < Config.GRID_ROWS; r++) {
    for (let c = 0; c < Config.GRID_COLS; c++) {
        // Use createBlock
        let blockData = createBlock(Config.BLOCK_AIR, false); // Default to AIR, NOT player placed
        const levels = worldLevels[c];
        if (!levels) {
            console.warn(`Missing level data for column ${c}`);
            continue;
        }

        const finalSurfaceRow = levels.surface;
        const finalStoneRow = levels.stone;
        const surfaceIsBelowWater = finalSurfaceRow >= Config.WORLD_WATER_LEVEL_ROW_TARGET;

        if (r >= finalStoneRow && finalStoneRow < Config.GRID_ROWS) {
            // Place Stone below the calculated stone level
            blockData = createBlock(Config.BLOCK_STONE, false); // Stone not player placed

        } else if (r > finalSurfaceRow && r < finalStoneRow) {
            // --- Between stone and surface level ---
             if (surfaceIsBelowWater) {
                const distSurfaceBelowWater = finalSurfaceRow - Config.WORLD_WATER_LEVEL_ROW_TARGET;
                let maxAllowedSandDepth = Math.max(1, Math.min(4, 1 + Math.floor(distSurfaceBelowWater / 1)));
                const currentDepth = r - finalSurfaceRow;

                if (currentDepth <= maxAllowedSandDepth) {
                    blockData = createBlock(Config.BLOCK_SAND, false); // Sand not player placed
                } else {
                    // Exceeded allowed sand depth, place what would normally be here
                    blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_DIRT, false); // Sand/Dirt not player placed
                }
            } else {
                // Surface is above water - standard logic (Dirt for island, Sand for ocean floor)
                blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_DIRT, false); // Sand/Dirt not player placed
            }

        } else if (r === finalSurfaceRow) {
            // --- At the calculated surface level ---
            if (surfaceIsBelowWater) {
                // Surface itself is underwater, place Sand (minimum 1 layer)
                 if (finalStoneRow > finalSurfaceRow) {
                    blockData = createBlock(Config.BLOCK_SAND, false); // Sand not player placed
                 } else {
                     blockData = createBlock(Config.BLOCK_STONE, false); // Stone not player placed
                 }
            } else {
                // Surface is above water - standard logic (Grass for island, Sand for ocean floor)
                blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_GRASS, false); // Grass/Sand not player placed
            }
        }

        // Set the block data using the direct method for initial generation
        setBlockData(c, r, blockData);
    }
}
    console.log("Landmass generation complete.");
} // End generateLandmass

// --- Flood Fill Function (No Changes Needed) ---
function applyFloodFill(targetWaterRow) {
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // Track visited cells: "c,r"

    // --- MODIFIED SEEDING LOGIC ---
    // Iterate through all cells at or below the target water row.
    // Find AIR blocks that should initiate a fill (either at edge/bottom or bordering non-AIR).
    console.log("Seeding flood fill points...");
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Check only AIR blocks that haven't been visited/queued yet
            if (getBlockType(c, r) === Config.BLOCK_AIR) {
                const key = `${c},${r}`;
                if (visited.has(key)) continue;

                let isSeedPoint = false;

                // Condition 1: Is it at the boundary of the grid? (Bottom or Sides)
                if (r === Config.GRID_ROWS - 1 || c === 0 || c === Config.GRID_COLS - 1) {
                    isSeedPoint = true;
                } else {
                    // Condition 2: Check cardinal neighbors. If any neighbor is NOT AIR,
                    // this AIR block borders something solid (or already filled water)
                    // and should be a seed point for this pocket.
                    const neighborCoords = [
                        { nc: c, nr: r - 1 }, // Check above (even above water level)
                        { nc: c, nr: r + 1 }, // Check below
                        { nc: c - 1, nr: r }, // Check left
                        { nc: c + 1, nr: r }  // Check right
                    ];

                    for (const { nc, nr } of neighborCoords) {
                        // Ensure neighbor is within *overall grid bounds*
                        if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                            if (getBlockType(nc, nr) !== Config.BLOCK_AIR) {
                                isSeedPoint = true;
                                break; // Found a non-air neighbor, no need to check others
                            }
                        } else {
                             // Neighbor is out of bounds (meaning current cell IS at an edge), treat as non-air border
                             isSeedPoint = true;
                             break;
                        }
                    }
                }

                // If it qualifies as a seed point, add to queue and mark visited
                if (isSeedPoint) {
                    queue.push({ c, r });
                    visited.add(key);
                }
            }
        }
    }
    console.log(`Flood fill seeded with ${queue.length} points.`);
    // --- END MODIFIED SEEDING LOGIC ---


    // Standard BFS continues from here...
    let processed = 0;
    while (queue.length > 0) {
        // Optimization log
        if (queue.length > 10000 && queue.length % 5000 === 0) {
            console.log(`Flood fill queue size: ${queue.length}, Processed: ${processed}`);
        }

        const { c, r } = queue.shift();

        // Get current block type *again* inside the loop, as it might have been filled
        // by another path if queue contains duplicates briefly.
        const currentBlockType = getBlockType(c,r);

        // Check bounds, ensure it's BELOW target water level, and is STILL AIR
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || currentBlockType !== Config.BLOCK_AIR) {
            continue;
       }

       // Fill with water - Use the WorldData setter, which uses createBlock
       // Water is naturally occurring, so isPlayerPlaced is false
       setBlock(c, r, Config.BLOCK_WATER, false); // Use imported setter, set isPlayerPlaced false
       processed++;

        // Add valid AIR neighbors (must be below targetWaterRow) to the queue
        const neighborCoords = [
            // Only check neighbors that could potentially be filled (at or below water level)
            { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 },
            { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
        ];

        for (const { nc, nr } of neighborCoords) {
            // Ensure neighbor is within grid bounds AND at or below water level
            if (nr >= targetWaterRow && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                const nKey = `${nc},${nr}`;
                // Check if neighbor is AIR and not visited
                if (getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) {
                    visited.add(nKey);
                    queue.push({ c: nc, r: nr });
                }
            }
        }
    } // End while loop
    console.log(`Flood fill complete. Filled ${processed} water blocks.`);
}
/**
 * Runs the entire world generation process, step-by-step.
 * Assumes the grid has been initialized by world-data.initializeGrid().
 */
export function generateInitialWorld() {
    console.time("World generated in");
    generateLandmass(); // Uses the new multi-pass method
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    console.timeEnd("World generated in");
}