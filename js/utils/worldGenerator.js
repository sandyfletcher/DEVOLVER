// -----------------------------------------------------------------------------
// root/js/utils/worldGenerator.js - Semi-random world generation to start game
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import * as WorldData from './worldData.js';

function lerp(t, a, b) {
    return a + t * (b - a);
}

let generationNoiseGenerator = null;

function generateLandmass() { // generates initial landmass and fills the rest with air by modifying grid directly
    generationNoiseGenerator = new PerlinNoise(56789); // using consistent fixed seed or can switch for initial terrain noise
    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH); // 200*0.8=160
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2); // 200-160=40/2=20
    const islandEndCol = islandStartCol + islandWidth; // 20+160=180
    // OCEAN_FLOOR_ROW_NEAR_ISLAND and OCEAN_STONE_ROW_NEAR_ISLAND now just define levels for the shape
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5; // ocean tapering +/- row 175
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8; // +/- row 183
    const deepOceanFloorStartRow = Math.min(Config.GRID_ROWS - 3, Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1));
    const deepOceanStoneStartRow = deepOceanFloorStartRow + 8;
    const edgeTaperWidth = Math.floor(Config.GRID_COLS * 0.15); // edge taper constants
    const edgeStoneLevelTarget = Config.GRID_ROWS + 5; // target stone level AT THE EDGE (below map)
    const edgeFloorLevelTarget = deepOceanFloorStartRow + 10; // target floor level below deep ocean floor at edge
    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH;
    let worldLevels = Array(Config.GRID_COLS).fill(null); // intermediate storage for calculated levels
    console.log("Pass 1: Calculating initial levels...");
    for (let c = 0; c < Config.GRID_COLS; c++) {
        const noiseVal = generationNoiseGenerator.noise(c * Config.WORLD_NOISE_SCALE); // calculate base island levels (used inside island logic)
        const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
        let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;
        const stoneNoiseVal = generationNoiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
        let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
        baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow); // clamp base stone relative to base surface
        let calcSurfaceRow, calcStoneRow;
        let isOceanColumn = !(c >= islandStartCol && c < islandEndCol);
        if (!isOceanColumn) {
            const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c); // inside island calculation
            calcSurfaceRow = baseSurfaceRow; // start with base levels
            calcStoneRow = baseStoneRow;
            if (distToIslandEdge < Config.islandTaperWidth && Config.islandTaperWidth > 0) { // apply island taper if within the taper zone
                const islandBlend = Math.max(0, distToIslandEdge) / Config.islandTaperWidth; // use linear blend for simplicity, pow(0.75) can be added back later if needed
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow)); // blend from ocean levels (blend=0 at edge) towards base levels (blend=1 inland)
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow)); // clamp final island levels after taper
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcStoneRow)); // keep island stone on map
            calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow); // ensure stone below surface
        } else {
            let currentOceanFloorLevel = deepOceanFloorStartRow; // outside island calculation
            let currentOceanStoneLevel = deepOceanStoneStartRow;
            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            const deepOceanTransitionWidth = islandStartCol / 2; // transition from near-island ocean levels to deep ocean levels
            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow)); // blend from Near Island level (0) towards Deep Ocean level (1)
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) { // closest to island
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }
            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c); // apply absolute edge taper (blends towards off-map/deep edge targets)
            let finalOceanStoneLevel = currentOceanStoneLevel; // start with level from deep/near blend
            let finalOceanFloorLevel = currentOceanFloorLevel;
            if (distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5);
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel)); // blend from Edge Target levels (blend=0) towards Current Ocean levels (blend=1)
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel)); // assign final calculated ocean levels, surface is sand/floor
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel)); // ocean stone can be off map
             // Ensure stone is below the deepest possible surface level in the column if stone is on map
             const deepestPossibleSurface = Math.max(calcSurfaceRow, baseSurfaceRow); // consider both island and ocean surface levels in the column area
             if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(deepestPossibleSurface + 1, calcStoneRow);
             } else {
                  // If stone level is off-map, ensure we fill with dirt down to the map boundary
                  calcStoneRow = Config.GRID_ROWS;
             }
        }
        worldLevels[c] = { surface: calcSurfaceRow, stone: calcStoneRow, isOcean: isOceanColumn }; // store calculated levels for this column
    }
    console.log("Pass 2: Smoothing boundaries...");
    const smoothingWidth = 20; // how many columns INTO the island to blend with ocean values, adjust this for a wider/narrower smoothed beach transition
    for (let i = 0; i < smoothingWidth; i++) {
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1; // always reference the closest ocean column
        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1); // simple linear blend: 0 = pure ocean, 1 = pure island original calc
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface;
            const refOceanStone = worldLevels[oceanCol].stone;
            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface)); // re-apply clamps after smoothing
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandCol].stone)); // ensure stone is on map or exactly at edge
            if (worldLevels[islandCol].stone < Config.GRID_ROWS) { // ensure stone is below surface if stone is on map
                 worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
            }
        }
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol; // reference closest ocean column
         if (islandColR >= islandStartCol && oceanColR < Config.GRID_COLS && worldLevels[islandColR] && worldLevels[oceanColR]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1);
            const originalIslandSurfaceR = worldLevels[islandColR].surface;
            const originalIslandStoneR = worldLevels[islandColR].stone;
            const refOceanSurfaceR = worldLevels[oceanColR].surface;
            const refOceanStoneR = worldLevels[oceanColR].stone;
            worldLevels[islandColR].surface = Math.round(lerp(blendFactor, refOceanSurfaceR, originalIslandSurfaceR));
            worldLevels[islandColR].stone = Math.round(lerp(blendFactor, refOceanStoneR, originalIslandStoneR));
            worldLevels[islandColR].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].surface)); // re-apply clamps after smoothing
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandColR].stone)); // ensure stone is on map or exactly at edge
            if (worldLevels[islandColR].stone < Config.GRID_ROWS) { // ensure stone is below surface if stone is on map
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
                continue;
            }
            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;

            if (r >= finalStoneRow) {
                 // Below or at the calculated stone level - place STONE
                 blockTypeToPlace = Config.BLOCK_STONE;
            } else if (r > finalSurfaceRow) {
                // Between the surface level and the stone level - place DIRT
                 blockTypeToPlace = Config.BLOCK_DIRT;
            } else if (r === finalSurfaceRow) {
                // At the calculated surface level - place DIRT
                 // GRASS and SAND will be created by aging
                 blockTypeToPlace = Config.BLOCK_DIRT;
            }
            // If r < finalSurfaceRow, it remains AIR (above the initial terrain)

            // Set the block data using the direct method for initial generation
            WorldData.setBlockData(c, r, createBlock(blockTypeToPlace, false)); // Ensure createBlock is used to get proper object/constant
        }
    }
}

function applyFloodFill(targetWaterRow) { // flood fill function
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // track visited cells: "c,r"
    console.log("Seeding flood fill points...");
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) { // iterate through all cells at or below target water row, find AIR blocks that should initiate a fill (either at edge/bottom or bordering non-AIR)
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (WorldData.getBlockType(c, r) === Config.BLOCK_AIR) { // check only AIR blocks that haven't been visited/queued yet
                const key = `${c},${r}`;
                if (visited.has(key)) continue;
                let isSeedPoint = false;
                // Seed points can be AIR blocks at the grid boundaries below the water line
                if (r >= targetWaterRow && (r === Config.GRID_ROWS - 1 || c === 0 || c === Config.GRID_COLS - 1)) {
                    isSeedPoint = true;
                } else { // or, AIR blocks below the water line that are adjacent to a non-AIR block
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
                            if (WorldData.getBlockType(nc, nr) !== Config.BLOCK_AIR) {
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
                }
                // Ensure the seed point is at or below the target water row
                if (isSeedPoint && r >= targetWaterRow) {
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
        const currentBlockType = WorldData.getBlockType(c,r); // get current block type *again* inside the loop

        // Ensure we are within bounds AND still AIR, and at/below the target water row
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || currentBlockType !== Config.BLOCK_AIR) {
            continue; // Skip if out of bounds, above water line, or already filled
        }

        // Fill with water
       const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false); // water blocks are not player-placed
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
                    // Check if neighbor is AIR and not visited yet
                    if (WorldData.getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push({ c: nc, r: nr });
                    }
                }
            }
       }
    }
    console.log(`Flood fill complete. Filled ${processed} water blocks.`);
}

export function generateInitialWorld() { // runs and times the world generation process
    console.time("Initial World generated in");
    // Initialize grid with AIR first
    WorldData.initializeGrid(); // Ensure grid is clean slate before generating landmass
    generateLandmass();
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    console.timeEnd("Initial World generated in");
}