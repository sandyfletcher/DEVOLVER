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

    // Use defined constants from Config
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.OCEAN_FLOOR_ROW_NEAR_ISLAND; // Already defined
    const OCEAN_STONE_ROW_NEAR_ISLAND = Config.OCEAN_STONE_ROW_NEAR_ISLAND; // Already defined
    const deepOceanFloorStartRow = Config.DEEP_OCEAN_FLOOR_START_ROW;
    const deepOceanStoneStartRow = Config.DEEP_OCEAN_STONE_START_ROW;

    const edgeTaperWidth = Math.floor(Config.GRID_COLS * Config.EDGE_TAPER_WIDTH_FACTOR);
    const edgeStoneLevelTarget = Config.GRID_ROWS + Config.EDGE_STONE_LEVEL_TARGET_ROW_OFFSET; // Allow it to be below grid for lerp
    const edgeFloorLevelTarget = deepOceanFloorStartRow + Config.EDGE_FLOOR_LEVEL_TARGET_ROW_OFFSET; // Allow it to be below grid

    const islandCenterTaperWidth = Config.ISLAND_CENTER_TAPER_WIDTH_COLS;

    let worldLevels = Array(Config.GRID_COLS).fill(null);

    console.log(`Pass 1: Calculating initial levels (in rows) with island width factor: ${islandWidthFactor.toFixed(3)}...`);

    for (let c = 0; c < Config.GRID_COLS; c++) {
        // Ground Noise
        const groundNoiseVal = getOctaveNoise1D(
            c, Config.GROUND_NOISE_OCTAVES, Config.GROUND_NOISE_PERSISTENCE,
            Config.GROUND_NOISE_LACUNARITY, Config.WORLD_NOISE_SCALE, terrainNoiseGenerator
        );
        const heightVariation = Math.round(groundNoiseVal * Config.WORLD_GROUND_VARIATION);
        let baseSurfaceRow = Config.MEAN_GROUND_LEVEL + heightVariation;

        // Stone Noise
        const stoneNoiseVal = getOctaveNoise1D(
            c + 100, Config.STONE_NOISE_OCTAVES, Config.STONE_NOISE_PERSISTENCE, // Offset noise input for stone
            Config.STONE_NOISE_LACUNARITY, Config.WORLD_NOISE_SCALE * 0.5, terrainNoiseGenerator // Different scale for stone
        );
        const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
        let baseStoneRow = Config.MEAN_STONE_LEVEL + stoneVariation;

        // Ensure stone is below surface
        baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow); // Stone starts at least 3 blocks below the surface

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
        } else { // OCEAN PART (edges of the map)
            let currentOceanFloorLevel = deepOceanFloorStartRow;
            let currentOceanStoneLevel = deepOceanStoneStartRow;

            const distFromIslandEdge = (c < islandStartCol) ? islandStartCol - c : c - (islandEndCol - 1);
            const deepOceanTransitionWidth = islandStartCol / 2; // Example: transition over half the distance from edge to island

            if (distFromIslandEdge > 0 && distFromIslandEdge < deepOceanTransitionWidth && deepOceanTransitionWidth > 0) {
                 const deepBlend = Math.min(1.0, distFromIslandEdge / deepOceanTransitionWidth);
                 currentOceanFloorLevel = Math.round(lerp(deepBlend, OCEAN_FLOOR_ROW_NEAR_ISLAND, deepOceanFloorStartRow));
                 currentOceanStoneLevel = Math.round(lerp(deepBlend, OCEAN_STONE_ROW_NEAR_ISLAND, deepOceanStoneStartRow));
            } else if (distFromIslandEdge <= 0) { // This means it's the column right next to the island edge
                 currentOceanFloorLevel = OCEAN_FLOOR_ROW_NEAR_ISLAND;
                 currentOceanStoneLevel = OCEAN_STONE_ROW_NEAR_ISLAND;
            }
            // Else: Far from island edge, use deep ocean levels

            const distFromAbsoluteEdge = Math.min(c, Config.GRID_COLS - 1 - c);
            let finalOceanStoneLevel = currentOceanStoneLevel;
            let finalOceanFloorLevel = currentOceanFloorLevel;

            if (distFromAbsoluteEdge >= 0 && distFromAbsoluteEdge < edgeTaperWidth && edgeTaperWidth > 0) {
                const edgeBlend = Math.pow(Math.min(1.0, distFromAbsoluteEdge / edgeTaperWidth), 0.5); // Use power for smoother taper
                finalOceanStoneLevel = Math.round(lerp(edgeBlend, edgeStoneLevelTarget, currentOceanStoneLevel));
                finalOceanFloorLevel = Math.round(lerp(edgeBlend, edgeFloorLevelTarget, currentOceanFloorLevel));
            }
            calcSurfaceRow = finalOceanFloorLevel;
            calcStoneRow = finalOceanStoneLevel;
        }

        // Clamp values and ensure stone is below surface
        calcSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, calcSurfaceRow));
        calcStoneRow = Math.max(0, Math.min(Config.GRID_ROWS, calcStoneRow)); // Stone can go to GRID_ROWS (exclusive for array access, inclusive for level)
        if (calcStoneRow < Config.GRID_ROWS) { // Only adjust if stone is not at the very bottom
             calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow); // Stone always at least 1 below surface
        }


        // --- START: New isCaveable logic ---
        let isCaveableColumn;
        if (isOceanColumn) {
            // This column is designated as "ocean" (outside the main island block)
            isCaveableColumn = false; // No caves under the deep ocean floor
        } else {
            // This column is part of the "island" block
            if (calcSurfaceRow >= Config.WATER_LEVEL) {
                // The surface of this island part is at or below water level = it's a beach or shallow submerged area
                isCaveableColumn = false; // No caves under beaches or shallow water parts of the island
            } else {
                // The surface of this island part is above water level = it's dry land
                isCaveableColumn = true; // Caves are allowed on dry land
            }
        }
        // --- END: New isCaveable logic ---

        worldLevels[c] = {
            surface: calcSurfaceRow,
            stone: calcStoneRow,
            isOcean: isOceanColumn,
            isCaveable: isCaveableColumn // Store the new flag
        };
    }

    console.log("Pass 2: Smoothing boundaries (in rows)...");
    const smoothingWidth = 20; // How many columns into the island/ocean to smooth
    for (let i = 0; i < smoothingWidth; i++) {
        // Smoothing left island edge
        const islandCol = islandStartCol + i;
        const oceanCol = islandStartCol - 1 - i; // Check further out for a more stable ocean reference

        if (islandCol < islandEndCol && oceanCol >= 0 && worldLevels[islandCol] && worldLevels[oceanCol]) {
            const blendFactor = (i + 1) / (smoothingWidth + 1); // Linear blend
            const originalIslandSurface = worldLevels[islandCol].surface;
            const originalIslandStone = worldLevels[islandCol].stone;
            const refOceanSurface = worldLevels[oceanCol].surface; // Reference ocean level
            const refOceanStone = worldLevels[oceanCol].stone;     // Reference ocean stone

            worldLevels[islandCol].surface = Math.round(lerp(blendFactor, refOceanSurface, originalIslandSurface));
            worldLevels[islandCol].stone = Math.round(lerp(blendFactor, refOceanStone, originalIslandStone));

            // Re-clamp and ensure stone is below surface after smoothing
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS, worldLevels[islandCol].stone));
            if (worldLevels[islandCol].stone < Config.GRID_ROWS) {
                 worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
            }
        }

        // Smoothing right island edge
        const islandColR = islandEndCol - 1 - i;
        const oceanColR = islandEndCol + i; // Check further out

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
    for (let r_fill = 0; r_fill < Config.GRID_ROWS; r_fill++) {
        for (let c_fill = 0; c_fill < Config.GRID_COLS; c_fill++) {
            let blockTypeToPlace = Config.BLOCK_AIR;
            const levels = worldLevels[c_fill];

            if (!levels) { // Should not happen if worldLevels is filled correctly
                World.setBlockData(c_fill, r_fill, createBlock(Config.BLOCK_AIR, false));
                continue;
            }

            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;

            if (r_fill >= finalStoneRow) {
                 blockTypeToPlace = Config.BLOCK_STONE;
            } else if (r_fill > finalSurfaceRow) { // Changed from >= to > to make surface itself dirt
                 blockTypeToPlace = Config.BLOCK_DIRT;
            } else if (r_fill === finalSurfaceRow) { // The very surface layer
                 blockTypeToPlace = Config.BLOCK_DIRT; // Or make this sand/vegetation later
            }
            // Else: it's AIR (default)

            // Optimization: If blockTypeToPlace is AIR and current grid is already AIR, skip setBlockData
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
        console.log("[CaveGen] Caves disabled in config.");
        return;
    }
    if (!worldLevels || worldLevels.length === 0) {
        console.error("[CaveGen] ERROR: worldLevels not provided or empty to generateCavesConnected. Cannot proceed.");
        return;
    }

    console.log("[CaveGen] Starting connected cave generation...");
    caveNoiseGenerator = new PerlinNoise(Math.random() + 0.5);

    const queue = [];
    const visitedCandidates = new Set();

    // --- Use new constants from Config for edge zone parameters ---
    const edgeZonePercentage = Config.CAVE_EDGE_ZONE_PERCENTAGE ?? 0.20; // Default to 0.20 if not defined
    const firstEdgeZoneEndCol = Math.floor(Config.GRID_COLS * edgeZonePercentage);
    const secondEdgeZoneStartCol = Config.GRID_COLS - firstEdgeZoneEndCol;
    const waterSurfaceRow = Config.WATER_LEVEL;
    const nearWaterSurfaceVerticalRange = Config.CAVE_EDGE_WATER_PROTECTION_DEPTH ?? 3; // Default to 3 if not defined

    console.log(`[CaveGen] Edge zone percentage: ${edgeZonePercentage * 100}%, Protection depth: ${nearWaterSurfaceVerticalRange} blocks.`);
    console.log(`[CaveGen] Edge Zone 1: 0 to ${firstEdgeZoneEndCol-1}, Edge Zone 2: ${secondEdgeZoneStartCol} to ${Config.GRID_COLS-1}`);

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

                            const isCaveable = worldLevels[nc]?.isCaveable;
                            const surfaceRowForCol = worldLevels[nc]?.surface ?? Config.MEAN_GROUND_LEVEL;
                            const minDepthFromLandSurface = Config.CAVE_MIN_ROWS_BELOW_SURFACE ?? 0;
                            const depthCheck1 = nr >= surfaceRowForCol + minDepthFromLandSurface;
                            const depthCheck2 = nr < Config.GRID_ROWS - Config.CAVE_MIN_ROWS_ABOVE_BOTTOM;

                            let allowSeed = true;
                            // --- NO-CARVE ZONE CHECK for seeding (using Config constants) ---
                            const isInEdgeZone = (nc < firstEdgeZoneEndCol) || (nc >= secondEdgeZoneStartCol);
                            if (isInEdgeZone) {
                                if (nr >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                    allowSeed = false;
                                }
                            }
                            // --- END NO-CARVE ZONE CHECK ---

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
    console.log(`[CaveGen] Seeding complete. Initial Air Blocks Checked: ${initialAirBlocksChecked}`);
    console.log(`[CaveGen] Potential Solid Neighbors Found: ${potentialSolidNeighborsFound}`);
    console.log(`[CaveGen] Actual Candidates Added to Queue (passed all checks): ${candidatesAddedToQueue}`);

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
                // --- NO-CARVE ZONE CHECK for carving (using Config constants) ---
                const isInEdgeZone = (c < firstEdgeZoneEndCol) || (c >= secondEdgeZoneStartCol);
                if (isInEdgeZone) {
                    if (r >= waterSurfaceRow - nearWaterSurfaceVerticalRange && r <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                        allowCarve = false;
                    }
                }
                // --- END NO-CARVE ZONE CHECK ---

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
                                            // --- NO-CARVE ZONE CHECK for propagation (using Config constants) ---
                                            const isInEdgeZoneProp = (nc_new_neighbor < firstEdgeZoneEndCol) || (nc_new_neighbor >= secondEdgeZoneStartCol);
                                            if (isInEdgeZoneProp) {
                                                if (nr_new_neighbor >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr_new_neighbor <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                                    allowNeighborPropagation = false;
                                                }
                                            }
                                            // --- END NO-CARVE ZONE CHECK ---

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
                                    // --- NO-CARVE ZONE CHECK for propagation from AIR/WATER (using Config constants) ---
                                    const isInEdgeZoneAirProp = (nc_prop < firstEdgeZoneEndCol) || (nc_prop >= secondEdgeZoneStartCol);
                                    if (isInEdgeZoneAirProp) {
                                        if (nr_prop >= waterSurfaceRow - nearWaterSurfaceVerticalRange && nr_prop <= waterSurfaceRow + nearWaterSurfaceVerticalRange) {
                                            allowAirPropagation = false;
                                        }
                                    }
                                    // --- END NO-CARVE ZONE CHECK ---

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
    console.log(`[CaveGen] Connected cave generation complete. Initial Candidates: ${initialCandidatesCountForLog}. Noise Condition Met Count: ${cavesCarvedNoiseConditionMet}. Actual Solid Blocks Changed to Air: ${actualBlockChanges}.`);
}

export function generateInitialWorld() {
    console.time("Initial World generated in");
    World.initializeGrid();
    const generatedWorldLevels = generateLandmass();
    if (!generatedWorldLevels || generatedWorldLevels.length === 0) {
        console.error("[WorldGenerator] CRITICAL ERROR: generateLandmass did NOT return valid worldLevels! Caves will not generate correctly.");
    } else {
        console.log(`[WorldGenerator] generateLandmass returned ${generatedWorldLevels.length} column levels.`);
        generateCavesConnected(generatedWorldLevels); // Pass the generated levels
    }
    console.timeEnd("Initial World generated in");
}