// -----------------------------------------------------------------------------
// root/js/utils/worldGenerator.js - Semi-random world generation to start game
// -----------------------------------------------------------------------------

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import * as World from './world.js';

function lerp(t, a, b) {
    return a + t * (b - a);
}
let terrainNoiseGenerator = null; // Renamed for clarity
let caveNoiseGenerator = null;    // New generator for caves
// Helper function for 1D multi-octave Perlin noise
function getOctaveNoise1D(x, octaves, persistence, lacunarity, baseScale, noiseGeneratorInstance) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0; // Used for normalizing to [-1,1]
    for (let i = 0; i < octaves; i++) {
        total += noiseGeneratorInstance.noise1D(x * frequency * baseScale) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue; // Normalize
}

function generateLandmass() {
    terrainNoiseGenerator = new PerlinNoise(Math.random());
    const islandWidthFactor = Math.random() * (Config.ISLAND_WIDTH_MAX - Config.ISLAND_WIDTH_MIN) + Config.ISLAND_WIDTH_MIN;
    const islandWidth = Math.floor(Config.GRID_COLS * islandWidthFactor);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WATER_LEVEL + 5;
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;
    const deepOceanFloorStartRow = Config.DEEP_OCEAN_FLOOR_START_ROW;
    const deepOceanStoneStartRow = Config.DEEP_OCEAN_STONE_START_ROW;

    const edgeTaperWidth = Math.floor(Config.GRID_COLS * Config.EDGE_TAPER_WIDTH_FACTOR);
    const edgeStoneLevelTarget = Config.GRID_ROWS + Config.EDGE_STONE_LEVEL_TARGET_ROW_OFFSET;
    const edgeFloorLevelTarget = deepOceanFloorStartRow + Config.EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET;

    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH_COLS;

    let worldLevels = Array(Config.GRID_COLS).fill(null);

    console.log(`Pass 1: Calculating initial levels (in rows) with island width factor: ${islandWidthFactor.toFixed(3)}...`);

    for (let c = 0; c < Config.GRID_COLS; c++) {
        const groundNoiseVal = getOctaveNoise1D(
            c, Config.GROUND_NOISE_OCTAVES, Config.GROUND_NOISE_PERSISTENCE,
            Config.GROUND_NOISE_LACUNARITY, Config.WORLD_NOISE_SCALE, terrainNoiseGenerator
        );
        const heightVariation = Math.round(groundNoiseVal * Config.WORLD_GROUND_VARIATION);
        let baseSurfaceRow = Config.MEAN_GROUND_LEVEL + heightVariation;

        const stoneNoiseVal = getOctaveNoise1D(
            c + 100, Config.STONE_NOISE_OCTAVES, Config.STONE_NOISE_PERSISTENCE,
            Config.STONE_NOISE_LACUNARITY, Config.WORLD_NOISE_SCALE * 0.5, terrainNoiseGenerator
        );
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
        let baseStoneRow = Config.MEAN_STONE_LEVEL + stoneVariation;

        baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow);
        let calcSurfaceRow, calcStoneRow;
        let isOceanColumn = !(c >= islandStartCol && c < islandEndCol);

        if (!isOceanColumn) {
            const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);
            calcSurfaceRow = baseSurfaceRow;
            calcStoneRow = baseStoneRow;
            if (distToIslandEdge >= 0 && distToIslandEdge < islandCenterTaperWidth && islandCenterTaperWidth > 0) {
                const islandBlend = Math.min(1.0, distToIslandEdge / islandCenterTaperWidth);
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, calcStoneRow));
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
            }
        } else {
            let currentOceanFloorLevel = deepOceanFloorStartRow;
            let currentOceanStoneLevel = deepOceanStoneStartRow;
            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            const deepOceanTransitionWidth = islandStartCol / 2;
            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) {
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }
            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
            let finalOceanStoneLevel = currentOceanStoneLevel;
            let finalOceanFloorLevel = currentOceanFloorLevel;
            if (distFromAbsoluteEdge >= 0 && distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5);
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel));
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }
            calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalOceanFloorLevel));
            calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, finalOceanStoneLevel));
            const deepestPossibleSurface = Math.max(calcSurfaceRow, baseSurfaceRow);
            if (calcStoneRow < Config.GRID_ROWS) {
                 calcStoneRow = Math.max(deepestPossibleSurface + 1, calcStoneRow);
             } else {
                  calcStoneRow = Math.min(Config.GRID_ROWS, calcStoneRow);
             }
        }
        worldLevels[c] = { surface: calcSurfaceRow, stone: calcStoneRow, isOcean: isOceanColumn };
    }

    console.log("Pass 2: Smoothing boundaries (in rows)...");
    const smoothingWidth = 20;
    for (let i = 0; i < smoothingWidth; i++) {
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1;
        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1);
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface;
            const refOceanStone = worldLevels[oceanCol].stone;
            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandCol].stone));
             if (worldLevels[islandCol].stone < Config.GRID_ROWS) {
                  worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
             }
        }
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol;
         if (islandColR >= islandStartCol && oceanColR < Config.GRID_COLS && worldLevels[islandColR] && worldLevels[oceanColR]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1);
            const originalIslandSurfaceR = worldLevels[islandColR].surface;
            const originalIslandStoneR = worldLevels[islandColR].stone;
            const refOceanSurfaceR = worldLevels[oceanColR].surface;
            const refOceanStoneR = worldLevels[oceanColR].stone;
            worldLevels[islandColR].surface = Math.round(lerp(blendFactor, refOceanSurfaceR, originalIslandSurfaceR));
            worldLevels[islandColR].stone = Math.round(lerp(blendFactor, refOceanStoneR, originalIslandStoneR));
            worldLevels[islandColR].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].surface));
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandColR].stone));
             if (worldLevels[islandColR].stone < Config.GRID_ROWS) {
                  worldLevels[islandColR].stone = Math.max(worldLevels[islandColR].surface + 1, worldLevels[islandColR].stone);
             }
        }
    }

    console.log("Pass 3: Placing blocks (Dirt and Stone only)...");
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let blockTypeToPlace = Config.BLOCK_AIR;
            const levels = worldLevels[c];
            if (!levels) {
                World.setBlockData(c, r, createBlock(Config.BLOCK_AIR, false));
                continue;
            }
            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;

            if (r >= finalStoneRow) {
                 blockTypeToPlace = Config.BLOCK_STONE;
            } else if (r > finalSurfaceRow) {
                 blockTypeToPlace = Config.BLOCK_DIRT;
            } else if (r === finalSurfaceRow) {
                 blockTypeToPlace = Config.BLOCK_DIRT;
            }
            World.setBlockData(c, r, createBlock(blockTypeToPlace, false));
        }
    }
    return worldLevels; // Ensure worldLevels is returned
}


function generateCavesConnected(worldLevels) {
    if (!Config.ENABLE_CAVES) {
        console.log("[CaveGen] Caves disabled in config.");
        return;
    }
    if (!worldLevels || worldLevels.length === 0) {
        console.error("[CaveGen] ERROR: worldLevels not provided or empty to generateCavesConnected. Cannot proceed.");
        return;
    }

    console.log("[CaveGen] Starting connected cave generation...");
    caveNoiseGenerator = new PerlinNoise(Math.random() + 0.5); // Seed with a slight offset if desired

    const queue = [];
    const visitedCandidates = new Set(); // Tracks {c,r} strings that have been added to the queue

    console.log("[CaveGen] Seeding cave generation queue...");
    let initialAirBlocksChecked = 0;
    let potentialSolidNeighborsFound = 0;
    let candidatesAddedToQueue = 0;

    for (let r_air = 0; r_air < Config.GRID_ROWS; r_air++) {
        for (let c_air = 0; c_air < Config.GRID_COLS; c_air++) {
            if (World.getBlockType(c_air, r_air) === Config.BLOCK_AIR) {
                initialAirBlocksChecked++;
                const neighbors = [
                    { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
                    { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
                ];
                for (const offset of neighbors) {
                    const nc = c_air + offset.dc;
                    const nr = r_air + offset.dr;
                    const candidateKey = `${nc},${nr}`;

                    if (nr >= 0 && nr < Config.GRID_ROWS &&
                        nc >= 0 && nc < Config.GRID_COLS &&
                        !visitedCandidates.has(candidateKey)) {

                        const neighborBlockType = World.getBlockType(nc, nr);
                        if (neighborBlockType === Config.BLOCK_DIRT || neighborBlockType === Config.BLOCK_STONE) {
                            potentialSolidNeighborsFound++;
                            const surfaceRowForColumn = worldLevels[nc]?.surface ?? Config.MEAN_GROUND_LEVEL;
                            // Use >= for the depth check with CAVE_MIN_ROWS_BELOW_SURFACE
                            if (nr >= surfaceRowForColumn + Config.CAVE_MIN_ROWS_BELOW_SURFACE &&
                                nr < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM) {
                                queue.push({ c: nc, r: nr });
                                visitedCandidates.add(candidateKey);
                                candidatesAddedToQueue++;
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`[CaveGen] Seeding complete. Initial Air Blocks Checked: ${initialAirBlocksChecked}`);
    console.log(`[CaveGen] Potential Solid Neighbors Found: ${potentialSolidNeighborsFound}`);
    console.log(`[CaveGen] Actual Candidates Added to Queue (passed depth checks): ${candidatesAddedToQueue}`);
    if (candidatesAddedToQueue === 0 && initialAirBlocksChecked > 0 && potentialSolidNeighborsFound > 0) {
        console.warn("[CaveGen] WARNING: Found solid neighbors to air, but NONE met depth constraints for seeding!");
        console.warn(`[CaveGen] Check CAVE_MIN_ROWS_BELOW_SURFACE (${Config.CAVE_MIN_ROWS_BELOW_SURFACE}) and CAVE_MIN_ROWS_ABOVE_BOTTOM (${Config.CAVE_MIN_ROWS_ABOVE_BOTTOM})`);
    }

    let initialCandidatesCountForLog = candidatesAddedToQueue; // Store for final log

    let cavesCarvedNoiseConditionMet = 0; // Counts how many times noise > threshold
    let actualBlockChanges = 0;      // Counts actual solid blocks changed to air

    while (queue.length > 0) {
        const current = queue.shift();
        const { c, r } = current;

        // Noise calculation
        const noiseValue = caveNoiseGenerator.noise2D(
            c * Config.CAVE_NOISE_SCALE_X,
            r * Config.CAVE_NOISE_SCALE_Y
        );

        if (noiseValue > Config.CAVE_THRESHOLD) {
            cavesCarvedNoiseConditionMet++; // Increment when noise condition is met

            const blockTypeBefore = World.getBlockType(c, r);

            if (blockTypeBefore === Config.BLOCK_DIRT || blockTypeBefore === Config.BLOCK_STONE) {
                // This is a solid block that can be carved
                const success = World.setBlockData(c, r, createBlock(Config.BLOCK_AIR, false));
                if (success) {
                    actualBlockChanges++; // Increment only if setBlockData was successful for a solid block
                    // console.log(`[CaveGen ACTION] Carved solid block at [${c},${r}] (was ${blockTypeBefore}) to AIR. Noise: ${noiseValue.toFixed(3)}`);

                    // Add solid neighbors of the newly carved air block to the queue
                    const neighbors = [
                        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
                        { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
                    ];
                    for (const offset of neighbors) {
                        const nc = c + offset.dc;
                        const nr = r + offset.dr;
                        const neighborKey = `${nc},${nr}`;

                        if (nr >= 0 && nr < Config.GRID_ROWS &&
                            nc >= 0 && nc < Config.GRID_COLS &&
                            !visitedCandidates.has(neighborKey)) {

                            const neighborBlockType = World.getBlockType(nc, nr);
                            if (neighborBlockType === Config.BLOCK_DIRT || neighborBlockType === Config.BLOCK_STONE) {
                                const surfaceRowForColumn = worldLevels[nc]?.surface ?? Config.MEAN_GROUND_LEVEL;
                                if (nr >= surfaceRowForColumn + Config.CAVE_MIN_ROWS_BELOW_SURFACE &&
                                    nr < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM) {
                                    queue.push({ c: nc, r: nr });
                                    visitedCandidates.add(neighborKey);
                                }
                            }
                        }
                    }
                } else {
                    console.warn(`[CaveGen WARN] setBlockData FAILED at [${c},${r}] even though noise condition met. Block before: ${blockTypeBefore}`);
                }
            } else if (blockTypeBefore === Config.BLOCK_AIR || blockTypeBefore === Config.BLOCK_WATER) {
                // This block met the noise criteria but was already AIR or WATER.
                // It wasn't "carved" in the sense of changing a solid, but it can still propagate cave generation to its solid neighbors.
                // console.log(`[CaveGen INFO] Noise condition met at [${c},${r}] but block was already ${blockTypeBefore === Config.BLOCK_AIR ? 'AIR' : 'WATER'}. Propagating.`);

                const neighbors = [
                    { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
                    { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
                ];
                for (const offset of neighbors) {
                    const nc = c + offset.dc;
                    const nr = r + offset.dr;
                    const neighborKey = `${nc},${nr}`;

                    if (nr >= 0 && nr < Config.GRID_ROWS &&
                        nc >= 0 && nc < Config.GRID_COLS &&
                        !visitedCandidates.has(neighborKey)) {

                        const neighborBlockType = World.getBlockType(nc, nr);
                        if (neighborBlockType === Config.BLOCK_DIRT || neighborBlockType === Config.BLOCK_STONE) {
                            const surfaceRowForColumn = worldLevels[nc]?.surface ?? Config.MEAN_GROUND_LEVEL;
                            if (nr >= surfaceRowForColumn + Config.CAVE_MIN_ROWS_BELOW_SURFACE &&
                                nr < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM) {
                                queue.push({ c: nc, r: nr });
                                visitedCandidates.add(neighborKey);
                            }
                        }
                    }
                }
            }
            // No else needed for other block types; if it's not DIRT/STONE/AIR/WATER, it's unusual and we wouldn't carve it.
        }
    }
    console.log(`[CaveGen] Connected cave generation complete. Initial Candidates: ${initialCandidatesCountForLog}. Noise Condition Met Count: ${cavesCarvedNoiseConditionMet}. Actual Solid Blocks Changed to Air: ${actualBlockChanges}.`);
}

function applyFloodFill(targetWaterRow) {
    // ... (applyFloodFill remains the same as in the previous response)
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set();

    console.log("Seeding flood fill points...");
    for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            if (r >= targetWaterRow && World.getBlockType(c, r) === Config.BLOCK_AIR) {
                const key = `${c},${r}`;
                if (visited.has(key)) continue;
                let isSeedPoint = false;
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 },
                    { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
                ];
                for (const { nc, nr } of neighborCoords) {
                    if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                        if (World.getBlockType(nc, nr) !== Config.BLOCK_AIR) {
                            isSeedPoint = true; break;
                        }
                    } else {
                        isSeedPoint = true; break;
                    }
                }
                if (isSeedPoint) {
                    queue.push({ c, r });
                    visited.add(key);
                }
            }
        }
    }

    console.log(`Flood fill seeded with ${queue.length} points.`);
    let processed = 0;

    while (queue.length > 0) {
        if (queue.length > 10000 && queue.length % 5000 === 0) {
            console.log(`Flood fill queue size: ${queue.length}, Processed: ${processed}`);
        }
        const { c, r } = queue.shift();
        const currentBlockType = World.getBlockType(c,r);
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || currentBlockType !== Config.BLOCK_AIR) {
            continue;
        }
       const success = World.setBlock(c, r, Config.BLOCK_WATER, false);
       if (success) {
            processed++;
            const neighborCoords = [
                { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 },
                { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
            ];
            for (const { nc, nr } of neighborCoords) {
                 if (nr >= targetWaterRow && nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                    const nKey = `${nc},${nr}`;
                    if (World.getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push({ c: nc, r: nr });
                    }
                }
            }
       }
    }
    console.log(`Flood fill complete. Filled ${processed} water blocks.`);
}

export function generateInitialWorld() {
    console.time("Initial World generated in");
    World.initializeGrid();
    const generatedWorldLevels = generateLandmass(); // ensure this is being returned
    if (generatedWorldLevels && generatedWorldLevels.length > 0) {
        console.log(`[WorldGenerator] generateLandmass returned ${generatedWorldLevels.length} column levels.`);
    } else {
        console.error("[WorldGenerator] ERROR: generateLandmass did NOT return valid worldLevels!");
    }
    generateCavesConnected(generatedWorldLevels);
    applyFloodFill(Config.WATER_LEVEL);
    console.timeEnd("Initial World generated in");
}