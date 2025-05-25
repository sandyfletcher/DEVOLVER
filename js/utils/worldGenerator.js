// -----------------------------------------------------------------------------
// root/js/utils/worldGenerator.js - Semi-random world generation to start game
// -----------------------------------------------------------------------------

import * as Config from './config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
import * as World from './world.js';
import * as DebugLogger from './debugLogger.js';

function lerp(t, a, b) {
    return a + t * (b - a);
}
let terrainNoiseGenerator = null;
let caveNoiseGenerator = null;

// Helper function for 1D multi-octave Perlin noise
function getOctaveNoise1D(x, octaves, persistence, lacunarity, baseScale, noiseGeneratorInstance) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        total += noiseGeneratorInstance.noise1D(x * frequency * baseScale) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}

function generateLandmass() {
    terrainNoiseGenerator = new PerlinNoise(Math.random());
    const islandWidthFactor = Math.random() * (Config.ISLAND_WIDTH_MAX - Config.ISLAND_WIDTH_MIN) + Config.ISLAND_WIDTH_MIN;
    const islandWidth = Math.floor(Config.GRID_COLS * islandWidthFactor);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.OCEAN_FLOOR_ROW_NEAR_ISLAND;
    const OCEAN_STONE_ROW_NEAR_ISLAND = Config.OCEAN_STONE_ROW_NEAR_ISLAND;
    const deepOceanFloorStartRow = Config.DEEP_OCEAN_FLOOR_START_ROW;
    const deepOceanStoneStartRow = Config.DEEP_OCEAN_STONE_START_ROW;

    const edgeTaperWidth = Math.floor(Config.GRID_COLS * Config.EDGE_TAPER_WIDTH_FACTOR);
    const edgeStoneLevelTarget = Config.GRID_ROWS + Config.EDGE_STONE_LEVEL_TARGET_ROW_OFFSET; // allow it to be below grid for lerp
    const edgeFloorLevelTarget = deepOceanFloorStartRow + Config.EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET;

    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH_COLS;

    let worldLevels = Array(Config.GRID_COLS).fill(null);

    DebugLogger.log(`Pass 1: Calculating initial levels (in rows) with island width factor: ${islandWidthFactor.toFixed(3)}...`);

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

        if (!isOceanColumn) { // ISLAND PART
            const distToIslandEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);
            calcSurfaceRow = baseSurfaceRow;
            calcStoneRow = baseStoneRow;

            if (distToIslandEdge >= 0 && distToIslandEdge < islandCenterTaperWidth && islandCenterTaperWidth > 0) {
                const islandBlend = Math.min(1.0, distToIslandEdge / islandCenterTaperWidth);
                calcSurfaceRow = Math.round(lerp(islandBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, baseSurfaceRow));
                calcStoneRow = Math.round(lerp(islandBlend, OCEAN_STONE_ROW_NEAR_ISLAND, baseStoneRow));
            }
        } else { // OCEAN PART
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
            calcSurfaceRow = finalOceanFloorLevel;
            calcStoneRow = finalOceanStoneLevel;
        }

        calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
        calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, calcStoneRow));
        if (calcStoneRow < Config.GRID_ROWS) {
            calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
        }

        let isCaveableColumn;
        if (isOceanColumn) {
            isCaveableColumn = false;
        } else {
            if (calcSurfaceRow >= Config.WATER_LEVEL) {
                isCaveableColumn = false;
            } else {
                isCaveableColumn = true;
            }
        }

        worldLevels[c] = {
            surface: calcSurfaceRow,
            stone: calcStoneRow,
            isOcean: isOceanColumn,
            isCaveable: isCaveableColumn
        };
    }

    DebugLogger.log("Pass 2: Smoothing boundaries (in rows)...");
    const smoothingWidth = 20;
    for (let i = 0; i < smoothingWidth; i++) {
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1 - i;

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
        const oceanColR = islandEndCol + i;

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

    DebugLogger.log("Pass 3: Placing blocks (Dirt and Stone only)...");
    for (let r_fill = 0; r_fill < Config.GRID_ROWS; r_fill++) {
        for (let c_fill = 0; c_fill < Config.GRID_COLS; c_fill++) {
            let blockTypeToPlace = Config.BLOCK_AIR;
            const levels = worldLevels[c_fill];

            if (!levels) {
                World.setBlockData(c_fill, r_fill, createBlock(Config.BLOCK_AIR, false));
                continue;
            }

            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;

            if (r_fill >= finalStoneRow) {
                blockTypeToPlace = Config.BLOCK_STONE;
            } else if (r_fill > finalSurfaceRow) {
                blockTypeToPlace = Config.BLOCK_DIRT;
            } else if (r_fill === finalSurfaceRow) {
                blockTypeToPlace = Config.BLOCK_DIRT;
            }

            if (blockTypeToPlace === Config.BLOCK_AIR && World.getBlockType(c_fill, r_fill) === Config.BLOCK_AIR) {
                continue;
            }
            World.setBlockData(c_fill, r_fill, createBlock(blockTypeToPlace, false));
        }
    }
    return worldLevels;
}

function generateCavesConnected(worldLevels) {
    if (!Config.ENABLE_CAVES) {
        DebugLogger.log("[CaveGen] Caves disabled in config.");
        return;
    }
    if (!worldLevels || worldLevels.length === 0) {
        DebugLogger.error("[CaveGen] ERROR: worldLevels not provided or empty to generateCavesConnected. Cannot proceed.");
        return;
    }

    DebugLogger.log("[CaveGen] Starting connected cave generation...");
    caveNoiseGenerator = new PerlinNoise(Math.random() + 0.5);

    const queue = [];
    const visitedCandidates = new Set();

    const edgeZonePercentage = Config.CAVE_EDGE_ZONE_PERCENTAGE ?? 0.20;
    const firstEdgeZoneEndCol = Math.floor(Config.GRID_COLS * edgeZonePercentage);
    const secondEdgeZoneStartCol = Config.GRID_COLS - firstEdgeZoneEndCol;
    const waterSurfaceRow = Config.WATER_LEVEL;
    const nearWaterSurfaceVerticalRange = Config.CAVE_EDGE_WATER_PROTECTION_DEPTH ?? 3;

    DebugLogger.log(`[CaveGen] Edge zone percentage: ${edgeZonePercentage * 100}%, Protection depth: ${nearWaterSurfaceVerticalRange} blocks.`);
    DebugLogger.log(`[CaveGen] Edge Zone 1: 0 to ${firstEdgeZoneEndCol-1}, Edge Zone 2: ${secondEdgeZoneStartCol} to ${Config.GRID_COLS-1}`);

    DebugLogger.log("[CaveGen] Seeding cave generation queue...");
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

                            const isCaveable = worldLevels[nc]?.isCaveable;
                            const surfaceRowForCol = worldLevels[nc]?.surface ?? Config.MEAN_GROUND_LEVEL;
                            const minDepthFromLandSurface = Config.CAVE_MIN_ROWS_BELOW_SURFACE ?? 0;
                            const depthCheck1 = nr >= surfaceRowForCol + minDepthFromLandSurface;
                            const depthCheck2 = nr < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM;

                            let allowSeed = true;
                            const isInEdgeZone = (nc < firstEdgeZoneEndCol) || (nc >= secondEdgeZoneStartCol);
                            if (isInEdgeZone) {
                                if (nr >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                    allowSeed = false;
                                }
                            }

                            if (isCaveable && depthCheck1 && depthCheck2 && allowSeed) {
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
    DebugLogger.log(`[CaveGen] Seeding complete. Initial Air Blocks Checked: ${initialAirBlocksChecked}`);
    DebugLogger.log(`[CaveGen] Potential Solid Neighbors Found: ${potentialSolidNeighborsFound}`);
    DebugLogger.log(`[CaveGen] Actual Candidates Added to Queue (passed all checks): ${candidatesAddedToQueue}`);

    let initialCandidatesCountForLog = candidatesAddedToQueue;
    let cavesCarvedNoiseConditionMet = 0;
    let actualBlockChanges = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        const { c, r } = current;

        const noiseValue = caveNoiseGenerator.noise2D(
            c * Config.CAVE_NOISE_SCALE_X,
            r * Config.CAVE_NOISE_SCALE_Y
        );

        if (noiseValue > Config.CAVE_THRESHOLD) {
            cavesCarvedNoiseConditionMet++;
            const blockTypeBefore = World.getBlockType(c, r);

            if (blockTypeBefore === Config.BLOCK_DIRT || blockTypeBefore === Config.BLOCK_STONE) {
                const isGenerallyCaveable = worldLevels[c]?.isCaveable;
                const surfaceRowForCol = worldLevels[c]?.surface ?? Config.MEAN_GROUND_LEVEL;
                const minDepthFromLandSurface = Config.CAVE_MIN_ROWS_BELOW_SURFACE ?? 0;
                const generalDepthCheck1 = r >= surfaceRowForCol + minDepthFromLandSurface;
                const generalDepthCheck2 = r < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM;

                let allowCarve = true;
                const isInEdgeZone = (c < firstEdgeZoneEndCol) || (c >= secondEdgeZoneStartCol);
                if (isInEdgeZone) {
                    if (r >= waterSurfaceRow - nearWaterSurfaceVerticalRange && r <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                        allowCarve = false;
                    }
                }

                if (isGenerallyCaveable && generalDepthCheck1 && generalDepthCheck2 && allowCarve) {
                    const success = World.setBlockData(c, r, createBlock(Config.BLOCK_AIR, false));
                    if (success) {
                        actualBlockChanges++;
                        const neighbors = [
                            { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
                            { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
                        ];
                        for (const offset of neighbors) {
                            const nc_new_neighbor = c + offset.dc;
                            const nr_new_neighbor = r + offset.dr;
                            const newNeighborKey = `${nc_new_neighbor},${nr_new_neighbor}`;

                            if (nr_new_neighbor >= 0 && nr_new_neighbor < Config.GRID_ROWS &&
                                nc_new_neighbor >= 0 && nc_new_neighbor < Config.GRID_COLS &&
                                !visitedCandidates.has(newNeighborKey)) {

                                const newNeighborBlockType = World.getBlockType(nc_new_neighbor, nr_new_neighbor);
                                if (newNeighborBlockType === Config.BLOCK_DIRT || newNeighborBlockType === Config.BLOCK_STONE) {
                                    if (worldLevels[nc_new_neighbor]?.isCaveable) {
                                        const surfaceRowForNewNeighborCol = worldLevels[nc_new_neighbor]?.surface ?? Config.MEAN_GROUND_LEVEL;
                                        const minDepthForNewNeighbor = Config.CAVE_MIN_ROWS_BELOW_SURFACE ?? 0;

                                        if (nr_new_neighbor >= surfaceRowForNewNeighborCol + minDepthForNewNeighbor &&
                                            nr_new_neighbor < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM) {

                                            let allowNeighborPropagation = true;
                                            const isInEdgeZoneProp = (nc_new_neighbor < firstEdgeZoneEndCol) || (nc_new_neighbor >= secondEdgeZoneStartCol);
                                            if (isInEdgeZoneProp) {
                                                if (nr_new_neighbor >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr_new_neighbor <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                                    allowNeighborPropagation = false;
                                                }
                                            }

                                            if (allowNeighborPropagation) {
                                                queue.push({ c: nc_new_neighbor, r: nr_new_neighbor });
                                                visitedCandidates.add(newNeighborKey);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (blockTypeBefore === Config.BLOCK_AIR || blockTypeBefore === Config.BLOCK_WATER) {
                const neighbors = [
                    { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
                    { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
                ];
                for (const offset of neighbors) {
                    const nc_prop = c + offset.dc;
                    const nr_prop = r + offset.dr;
                    const propNeighborKey = `${nc_prop},${nr_prop}`;
                    if (nr_prop >= 0 && nr_prop < Config.GRID_ROWS &&
                        nc_prop >= 0 && nc_prop < Config.GRID_COLS &&
                        !visitedCandidates.has(propNeighborKey)) {
                        const propNeighborBlockType = World.getBlockType(nc_prop, nr_prop);
                        if (propNeighborBlockType === Config.BLOCK_DIRT || propNeighborBlockType === Config.BLOCK_STONE) {
                            if (worldLevels[nc_prop]?.isCaveable) {
                                const surfaceRowForPropCol = worldLevels[nc_prop]?.surface ?? Config.MEAN_GROUND_LEVEL;
                                const minDepthForProp = Config.CAVE_MIN_ROWS_BELOW_SURFACE ?? 0;
                                if (nr_prop >= surfaceRowForPropCol + minDepthForProp &&
                                    nr_prop < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM) {

                                    let allowAirPropagation = true;
                                    const isInEdgeZoneAirProp = (nc_prop < firstEdgeZoneEndCol) || (nc_prop >= secondEdgeZoneStartCol);
                                    if (isInEdgeZoneAirProp) {
                                        if (nr_prop >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr_prop <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                            allowAirPropagation = false;
                                        }
                                    }

                                    if(allowAirPropagation) {
                                        queue.push({ c: nc_prop, r: nr_prop });
                                        visitedCandidates.add(propNeighborKey);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    DebugLogger.log(`[CaveGen] Connected cave generation complete. Initial Candidates: ${initialCandidatesCountForLog}. Noise Condition Met Count: ${cavesCarvedNoiseConditionMet}. Actual Solid Blocks Changed to Air: ${actualBlockChanges}.`);
}

export function generateInitialWorld() {
    if (Config.DEBUG_MODE) DebugLogger.time("Initial World generated in");
    World.initializeGrid();
    const generatedWorldLevels = generateLandmass();
    if (!generatedWorldLevels || generatedWorldLevels.length === 0) {
        DebugLogger.error("[WorldGenerator] CRITICAL ERROR: generateLandmass did NOT return valid worldLevels! Caves will not generate correctly.");
    } else {
        DebugLogger.log(`[WorldGenerator] generateLandmass returned ${generatedWorldLevels.length} column levels.`);
        generateCavesConnected(generatedWorldLevels);
    }
    if (Config.DEBUG_MODE) DebugLogger.timeEnd("Initial World generated in");
}