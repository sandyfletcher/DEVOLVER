// -----------------------------------------------------------------------------
// root/js/worldGenerator.js - Semi-random world generation to start game
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
    const edgeFloorLevelTarget = deepOceanFloorStartRow + 10; // Target floor level AT THE EDGE

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
    console.log("Pass 3: Placing blocks...");
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
             let blockData = Config.BLOCK_AIR; // Default to AIR
             const levels = worldLevels[c];
             if (!levels) {
                 console.warn(`Missing level data for column ${c}`);
                 continue;
             }

             const finalSurfaceRow = levels.surface;
             const finalStoneRow = levels.stone;

             if (levels.isOcean) {
                 // Ocean Block Placement (Sand surface)
                 if (r >= finalStoneRow && finalStoneRow < Config.GRID_ROWS) {
                     blockData = createBlock(Config.BLOCK_STONE);
                 } else if (r >= finalSurfaceRow && r < finalStoneRow) {
                     // Check if stone level is actually on the map before placing sand above it
                     if(finalStoneRow < Config.GRID_ROWS) {
                          blockData = createBlock(Config.BLOCK_SAND);
                     } else if (r >= finalSurfaceRow) {
                          // If stone is off map, just place sand from floor level down
                          blockData = createBlock(Config.BLOCK_SAND);
                     }
                 }
             } else {
                 // Island Block Placement (Grass/Dirt surface)
                 if (r >= finalStoneRow) {
                     blockData = createBlock(Config.BLOCK_STONE);
                 } else if (r > finalSurfaceRow) {
                     blockData = createBlock(Config.BLOCK_DIRT);
                 } else if (r === finalSurfaceRow) {
                     blockData = createBlock(Config.BLOCK_GRASS);
                 }
             }
             // Set the block data using the direct, faster method
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

    // --- Optimized Start Points for Flood Fill ---
    // Start from the bottom row and the sides *at or below* the water level, assuming the generator leaves AIR where water should be

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

        // Fill with water - Use setBlock to create the water block object correctly
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

// --- Sand Pass Function  ---
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

    // Apply all collected changes using setBlock
    finalChanges.forEach(change => {
        // Double check bounds just in case, though logic should prevent OOB
        if (change.r >= 0 && change.r < Config.GRID_ROWS && change.c >= 0 && change.c < Config.GRID_COLS) {
           // Use setBlock to ensure correct block object creation
           setBlock(change.c, change.r, change.type);
        }
    });
    console.log(`Sand pass complete. ${finalChanges.length} blocks changed to sand.`);
}

// --- Function to fill remaining Dirt/Stone/Grass gaps below water near water ---
function fillSubmergedSandGaps() {
    console.log("Applying sand gap filling pass...");
    const changesMade = []; // Optional: Track changes if needed
    const waterLevelRow = Config.WORLD_WATER_LEVEL_ROW_TARGET;
    const maxCheckRow = Config.GRID_ROWS; // Check all the way down

    // Iterate rows from water level downwards
    for (let r = waterLevelRow; r < maxCheckRow; r++) {
        // Iterate columns
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockType(c, r);

            // Is this a block that *should* potentially be sand?
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE || blockType === Config.BLOCK_GRASS) {
                let isAdjacentToWater = false;
                // Check 8 neighbors
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];

                for (const { nc, nr } of neighborCoords) {
                    // Check bounds for neighbor before getting type
                    if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                        if (getBlockType(nc, nr) === Config.BLOCK_WATER) {
                            isAdjacentToWater = true;
                            break; // Found water, no need to check other neighbors
                        }
                    }
                }

                // If it was Dirt/Stone/Grass and next to Water, change it to Sand
                if (isAdjacentToWater) {
                    setBlock(c, r, Config.BLOCK_SAND); // Use the proper setter
                    changesMade.push({r, c}); // Optional tracking
                }
            }
        }
    }
    console.log(`Sand gap filling complete. ${changesMade.length} additional blocks changed to sand.`);
}

/**
 * Runs the entire world generation process, step-by-step.
 * Assumes the grid has been initialized by world-data.initializeGrid().
 */
export function generateInitialWorld() {
    console.time("World generated in");
    generateLandmass(); // Uses the new multi-pass method
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    applySandPass(); // Original sand pass (handles thickness)
    fillSubmergedSandGaps(); // Backup sand
    console.timeEnd("World generated in");
}