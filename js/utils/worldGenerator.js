// -----------------------------------------------------------------------------
// root/js/utils/worldGenerator.js - Semi-random world generation to start game
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import * as World from './world.js'; // Corrected import path

function lerp(t, a, b) {
    return a + t * (b - a);
}

let generationNoiseGenerator = null;

function generateLandmass() { // generates initial landmass and fills the rest with air by modifying grid directly
    generationNoiseGenerator = new PerlinNoise(Math.random()); // Use a different seed each time instead of using consistent fixed seed

    // Randomize island width factor
    const islandWidthFactor = Math.random() * (Config.WORLD_ISLAND_WIDTH_MAX - Config.WORLD_ISLAND_WIDTH_MIN) + Config.WORLD_ISLAND_WIDTH_MIN;
    const islandWidth = Math.floor(Config.GRID_COLS * islandWidthFactor);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    // Ocean tapering and deep ocean levels defined in rows (relative to grid height, no scaling needed here)
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5;
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;
    const deepOceanFloorStartRow = Config.DEEP_OCEAN_FLOOR_START_ROW; // Use constants directly
    const deepOceanStoneStartRow = Config.DEEP_OCEAN_STONE_START_ROW; // Use constants directly

    const edgeTaperWidth = Math.floor(Config.GRID_COLS * Config.EDGE_TAPER_WIDTH_FACTOR); // Edge taper width in columns
    const edgeStoneLevelTarget = Config.GRID_ROWS + Config.EDGE_STONE_LEVEL_TARGET_ROW_OFFSET; // Target stone level AT THE EDGE (below map, in rows)
    const edgeFloorLevelTarget = deepOceanFloorStartRow + Config.EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET; // Target floor level below deep ocean floor at edge (in rows)

    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH_COLS; // Taper width inside island edge (in columns)

    let worldLevels = Array(Config.GRID_COLS).fill(null); // intermediate storage for calculated levels

    console.log(`Pass 1: Calculating initial levels (in rows) with island width factor: ${islandWidthFactor.toFixed(3)}...`);

    for (let c = 0; c < Config.GRID_COLS; c++) {
        // Base island levels determined by noise and row-based config constants
        const noiseVal = generationNoiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
        const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION); // Variation in rows
        let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN_ROW + heightVariation; // Use new row constant

        const stoneNoiseVal = generationNoiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION); // Variation in rows
        let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN_ROW + stoneVariation;

        baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow); // clamp base stone relative to base surface (in rows)

        let calcSurfaceRow, calcStoneRow;
        let isOceanColumn = !(c >= islandStartCol && c < islandEndCol);

        if (!isOceanColumn) {
            // Inside island calculation
            const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);

            calcSurfaceRow = baseSurfaceRow; // start with base levels
            calcStoneRow = baseStoneRow;

            // Apply island taper if within the taper zone
            if (distToIslandEdge >= 0 && distToIslandEdge < islandCenterTaperWidth && islandCenterTaperWidth > 0) { // Use islandCenterTaperWidth
                const islandBlend = Math.min(1.0, distToIslandEdge / islandCenterTaperWidth); // blend=0 at edge, blend=1 inland

                // Blend from near-island ocean levels (in rows) towards base island levels (in rows)
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }

            // Clamp final island levels after taper to grid boundaries (in rows)
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, calcStoneRow)); // Stone can be exactly at bottom edge

            // Ensure stone is below surface level (in rows)
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
            }


        } else {
            // Outside island (ocean) calculation
            let currentOceanFloorLevel = deepOceanFloorStartRow;
            let currentOceanStoneLevel = deepOceanStoneStartRow;

            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            const deepOceanTransitionWidth = islandStartCol / 2; // Transition width in columns

            // Transition from near-island ocean levels to deep ocean levels if within the transition zone
            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) { // closest to island edge (but still ocean column)
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }


            // Apply absolute edge taper (blends towards off-map/deep edge targets)
            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
            let finalOceanStoneLevel = currentOceanStoneLevel; // start with level from deep/near blend
            let finalOceanFloorLevel = currentOceanFloorLevel;

            if (distFromAbsoluteEdge >= 0 && distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5); // Use power for smoother transition
                // Blend from Edge Target levels (blend=0) towards Current Ocean levels (blend=1) (in rows)
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel));
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }

            // Assign final calculated ocean levels, clamped to grid boundaries (in rows)
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel)); // surface is sand/floor
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel)); // ocean stone can be off map

            // Ensure stone is below the deepest possible surface level in the column if stone is on map
            const deepestPossibleSurface = Math.max(calcSurfaceRow, baseSurfaceRow); // consider both island and ocean surface levels in the column area
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(deepestPossibleSurface + 1, calcStoneRow);
             } else {
                  // If stone level is off-map (>= GRID_ROWS), ensure we fill with dirt down to the map boundary (GRID_ROWS - 1)
                  // The loop below will handle this by filling dirt up to GRID_ROWS - 1 if calcStoneRow is GRID_ROWS
                  calcStoneRow = Math.min(Config.GRID_ROWS, calcStoneRow); // Clamp stone row to be at most GRID_ROWS
             }
        }

        worldLevels[c] = { surface: calcSurfaceRow, stone: calcStoneRow, isOcean: isOceanColumn }; // store calculated levels for this column
    }

    console.log("Pass 2: Smoothing boundaries (in rows)...");
    const smoothingWidth = 20; // how many columns INTO the island to blend with ocean values, adjust this for a wider/narrower smoothed beach transition
    for (let i = 0; i < smoothingWidth; i++) {
        // Left side blending (ocean columns blend into island columns near islandStartCol)
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1; // Reference the closest ocean column to the left
        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1); // simple linear blend: 0 = pure ocean, 1 = pure island original calc
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface;
            const refOceanStone = worldLevels[oceanCol].stone;

            // Blend surface and stone levels using the calculated blend factor (in rows)
            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));

            // Re-apply clamps after smoothing to ensure levels stay within valid row ranges
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandCol].stone)); // Stone can be exactly at bottom edge

             // Re-ensure stone is below surface if stone is on map
             if (worldLevels[islandCol].stone < Config.GRID_ROWS) {
                  worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
             }
        }

        // Right side blending (ocean columns blend into island columns near islandEndCol)
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol; // Reference the closest ocean column to the right
         if (islandColR >= islandStartCol && oceanColR < Config.GRID_COLS && worldLevels[islandColR] && worldLevels[oceanColR]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1);
            const originalIslandSurfaceR = worldLevels[islandColR].surface;
            const originalIslandStoneR = worldLevels[islandColR].stone;
            const refOceanSurfaceR = worldLevels[oceanColR].surface;
            const refOceanStoneR = worldLevels[oceanColR].stone;

             // Blend surface and stone levels using the calculated blend factor (in rows)
            worldLevels[islandColR].surface = Math.round(lerp(blendFactor, refOceanSurfaceR, originalIslandSurfaceR));
            worldLevels[islandColR].stone = Math.round(lerp(blendFactor, refOceanStoneR, originalIslandStoneR));

            // Re-apply clamps after smoothing to ensure levels stay within valid row ranges
            worldLevels[islandColR].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].surface));
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandColR].stone)); // Stone can be exactly at bottom edge

             // Re-ensure stone is below surface if stone is on map
             if (worldLevels[islandColR].stone < Config.GRID_ROWS) {
                  worldLevels[islandColR].stone = Math.max(worldLevels[islandColR].surface + 1, worldLevels[islandColR].stone);
             }
        }
    }

    console.log("Pass 3: Placing blocks (Dirt and Stone only)...");
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let blockTypeToPlace = Config.BLOCK_AIR; // default to AIR
            const levels = worldLevels[c];
            if (!levels) {
                console.warn(`Missing level data for column ${c}`);
                // Default to AIR for columns with no level data
                World.setBlockData(c, r, createBlock(Config.BLOCK_AIR, false));
                continue;
            }
            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;

            if (r >= finalStoneRow) {
                 // Below or at the calculated stone level - place STONE
                 blockTypeToPlace = Config.BLOCK_STONE;
            } else if (r > finalSurfaceRow) {
                // Between the surface level (exclusive) and the stone level (exclusive) - place DIRT
                 blockTypeToPlace = Config.BLOCK_DIRT;
            } else if (r === finalSurfaceRow) {
                // At the calculated surface level - place DIRT
                 // GRASS and SAND will be created by aging
                 blockTypeToPlace = Config.BLOCK_DIRT;
            }
            // If r < finalSurfaceRow, it remains AIR (above the initial terrain)

            // Set the block data using the direct method for initial generation
            World.setBlockData(c, r, createBlock(blockTypeToPlace, false)); // Ensure createBlock is used to get proper object/constant
        }
    }
}

function applyFloodFill(targetWaterRow) { // flood fill function (uses grid coordinates, no pixel scaling needed)
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // track visited cells: "c,r"

    console.log("Seeding flood fill points...");
    // Iterate through all cells at or below target water row, find AIR blocks that should initiate a fill
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            // Check only AIR blocks that haven't been visited/queued yet and are below or at the water line target
            if (r >= targetWaterRow && World.getBlockType(c, r) === Config.BLOCK_AIR) {
                const key = `${c},${r}`;
                if (visited.has(key)) continue;

                let isSeedPoint = false;
                // Seed points are AIR blocks below the water line that are adjacent to a non-AIR block
                const neighborCoords = [
                    { nc: c, nr: r - 1 },
                    { nc: c, nr: r + 1 },
                    { nc: c - 1, nr: r },
                    { nc: c + 1, nr: r }
                ];
                for (const { nc, nr } of neighborCoords) {
                    // Check if the neighbor is within the overall grid bounds
                    if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                        // If the neighbor block type is NOT AIR (i.e., it's solid or existing water from gen/prev fills)
                        if (World.getBlockType(nc, nr) !== Config.BLOCK_AIR) {
                            isSeedPoint = true;
                            break; // Found a non-air neighbor, no need to check others
                        }
                    } else {
                        // Neighbor is out of bounds, which means the current cell IS at a grid boundary.
                        // Treat this as bordering a non-AIR area for the purpose of seeding the fill.
                        isSeedPoint = true;
                        break;
                    }
                }
                 // If adjacent to non-AIR and at or below the target water row, add to queue
                if (isSeedPoint) { // r >= targetWaterRow check already done at loop start
                    queue.push({ c, r });
                    visited.add(key);
                }
            }
        }
    }

    console.log(`Flood fill seeded with ${queue.length} points.`);
    let processed = 0; // standard BFS continues from here

    while (queue.length > 0) {
        // Optional: Log progress for large queues
        if (queue.length > 10000 && queue.length % 5000 === 0) {
            console.log(`Flood fill queue size: ${queue.length}, Processed: ${processed}`);
        }

        const { c, r } = queue.shift();
        const currentBlockType = World.getBlockType(c,r); // get current block type *again* inside the loop

        // Ensure we are within bounds AND still AIR, and at/below the target water row
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || currentBlockType !== Config.BLOCK_AIR) {
            continue; // Skip if out of bounds, above water line, or already filled
        }

       const success = World.setBlock(c, r, Config.BLOCK_WATER, false); // fill with water (not player-placed)

       if (success) {
            processed++;
            // Add valid AIR neighbours (must be at or below targetWaterRow) to the queue
            const neighborCoords = [
                { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 },
                { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
            ];
            for (const { nc, nr } of neighborCoords) {
                 // Ensure neighbor is within grid bounds AND at/below target water level
                 if (nr >= targetWaterRow && nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                    const nKey = `${nc},${nr}`;
                    if (World.getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) { // check if neighbor is AIR and not visited yet
                        visited.add(nKey);
                        queue.push({ c: nc, r: nr });
                    }
                }
            }
       }
    }
    console.log(`Flood fill complete. Filled ${processed} water blocks.`);
}

export function generateInitialWorld() { // run world generation process
    console.time("Initial World generated in");
    World.initializeGrid(); // initialize grid with clean slate of only AIR before generating landmass
    generateLandmass();
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    console.timeEnd("Initial World generated in");
}