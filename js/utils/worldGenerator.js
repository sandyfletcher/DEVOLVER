// -----------------------------------------------------------------------------
// js/world-generator.js - Handles procedural generation of the initial world
// -----------------------------------------------------------------------------
console.log("world-generator.js loaded");

import * as Config from '../config.js';
import { PerlinNoise } from './noise.js';
import { createBlock } from './block.js';
// Import functions to modify the world data from world-data.js
import { setBlock, setBlockData, getBlockType } from './worldData.js';

// --- Module State ---
let noiseGenerator = null; // Generator instance

// --- Helper functions ---
function lerp(t, a, b) {
    return a + t * (b - a);
}

// --- Generation Steps (Internal Functions) ---

/**
 * Generates the initial landmass (Stone/Dirt/Grass) and fills the rest with Air.
 * Modifies the grid directly using imported functions from world-data.
 */
function generateLandmass() {
    console.log("Generating landmass with tapered island edges...");
    // Grid initialization is handled by world-data.js now
    noiseGenerator = new PerlinNoise(); // Seed is handled internally

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;
    const edgeTargetSurfaceRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + 2;
    const edgeTargetStoneRow = edgeTargetSurfaceRow + 8;
    const taperWidth = 40;
    const deepOceanBaseRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1);
    const deepOceanMaxRow = Config.GRID_ROWS - 3;
    const deepOceanFloorStartRow = Math.min(deepOceanMaxRow, deepOceanBaseRow);

    // Iterate through every cell and decide its type
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let blockData = Config.BLOCK_AIR; // Default to air

            if (c >= islandStartCol && c < islandEndCol) {
                // --- Inside Island Area ---
                const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
                const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
                let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;
                const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
                const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
                let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
                baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow);

                // Tapering
                const distToNearestEdge = Math.min(c - islandStartCol, (islandEndCol - 1) - c);
                let finalSurfaceRow = baseSurfaceRow;
                let finalStoneRow = baseStoneRow;
                if (distToNearestEdge < taperWidth && taperWidth > 0) {
                    const blend = Math.pow(distToNearestEdge / taperWidth, 0.75);
                    finalSurfaceRow = Math.round(lerp(blend, edgeTargetSurfaceRow, baseSurfaceRow));
                    finalStoneRow = Math.round(lerp(blend, edgeTargetStoneRow, baseStoneRow));
                    finalStoneRow = Math.max(finalSurfaceRow + 2, finalStoneRow);
                }
                finalSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalSurfaceRow));
                finalStoneRow = Math.max(finalSurfaceRow + 1, finalStoneRow);

                // Determine Block Type
                if (r >= finalStoneRow) blockData = createBlock(Config.BLOCK_STONE);
                else if (r > finalSurfaceRow) blockData = createBlock(Config.BLOCK_DIRT);
                else if (r === finalSurfaceRow) blockData = createBlock(Config.BLOCK_GRASS);

            } else {
                // --- Outside Island Area (Ocean Floor) ---
                const distToGridEdge = Math.min(c, (Config.GRID_COLS - 1) - c);
                const oceanTaperStartDist = islandStartCol;
                let oceanFloorRow = deepOceanFloorStartRow;
                if (distToGridEdge < oceanTaperStartDist && oceanTaperStartDist > 0) {
                    const oceanBlend = distToGridEdge / oceanTaperStartDist;
                    oceanFloorRow = Math.round(lerp(oceanBlend, deepOceanFloorStartRow, edgeTargetStoneRow + 5));
                }
                oceanFloorRow = Math.min(Config.GRID_ROWS - 1, Math.max(edgeTargetSurfaceRow, oceanFloorRow));

                if (r >= oceanFloorRow) {
                    const oceanNoise = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.2 + 500);
                    if (r >= oceanFloorRow + 1 + Math.round(oceanNoise * 2)) blockData = createBlock(Config.BLOCK_STONE);
                    else blockData = createBlock(Config.BLOCK_DIRT);
                }
            }
            // Use setBlockData for potentially better performance during mass generation
            // It directly sets the already created block object or air constant.
            setBlockData(c, r, blockData);
            // Alternatively, use setBlock if safety/consistency is preferred:
            // if (blockData !== Config.BLOCK_AIR) {
            //     setBlock(c, r, blockData.type, blockData.orientation);
            // } // Air is already the default from initializeGrid
        }
    }
    console.log("Landmass generation complete.");
}


/**
 * Fills connected air blocks below the target water level with water using Flood Fill (BFS).
 * Uses getBlockType and setBlock from world-data.
 * @param {number} targetWaterRow - The highest row index (inclusive) that water should reach.
 */
function applyFloodFill(targetWaterRow) {
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // Track visited cells: "c,r"

    // Start Flood Fill from Edges and Bottom (below or at targetWaterRow)
    for (let c = 0; c < Config.GRID_COLS; c++) {
        for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) {
            const blockType = getBlockType(c, r); // Use imported getter
            const key = `${c},${r}`;
            if (blockType === Config.BLOCK_AIR && !visited.has(key)) {
                queue.push({ c, r }); visited.add(key);
            }
        }
    }
    for (let r = 0; r < targetWaterRow; r++) {
        const keyLeft = `0,${r}`;
        if (getBlockType(0, r) === Config.BLOCK_AIR && !visited.has(keyLeft)) {
            queue.push({ c: 0, r }); visited.add(keyLeft);
        }
        const keyRight = `${Config.GRID_COLS - 1},${r}`;
        if (getBlockType(Config.GRID_COLS - 1, r) === Config.BLOCK_AIR && !visited.has(keyRight)) {
            queue.push({ c: Config.GRID_COLS - 1, r }); visited.add(keyRight);
        }
    }

    // BFS
    while (queue.length > 0) {
        const { c, r } = queue.shift();
        const currentType = getBlockType(c, r); // Use imported getter
        if (currentType !== Config.BLOCK_AIR) continue;

        if (r >= targetWaterRow) {
            setBlock(c, r, Config.BLOCK_WATER); // Use imported setter

            const neighborCoords = [{ nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r }];
            for (const { nc, nr } of neighborCoords) {
                const nKey = `${nc},${nr}`;
                if (!visited.has(nKey) && getBlockType(nc, nr) === Config.BLOCK_AIR) { // Use imported getter
                    visited.add(nKey);
                    queue.push({ c: nc, r: nr });
                }
            }
        }
    }
    console.log("Flood fill complete.");
}

/**
 * Applies sand generation along water edges after flood fill.
 * Uses getBlockType and setBlock from world-data.
 */
function applySandPass() {
    console.log("Applying sand generation pass (thicker beaches)...");
    const changes = [];
    const maxDepth = 3;
    const maxRaise = 1;
    const minCheckRow = Math.max(0, Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise - 5);
    const maxCheckRow = Math.min(Config.GRID_ROWS, Config.WORLD_WATER_LEVEL_ROW_TARGET + maxDepth + 20);

    for (let r = minCheckRow; r < maxCheckRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockType(c, r); // Use imported getter
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE || blockType === Config.BLOCK_GRASS) {
                let adjacentWater = false;
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];
                for (const { nc, nr } of neighborCoords) {
                    if (getBlockType(nc, nr) === Config.BLOCK_WATER) { // Use imported getter
                        adjacentWater = true; break;
                    }
                }
                if (adjacentWater && r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise) {
                    changes.push({ r, c, type: Config.BLOCK_SAND });
                }
            }
        }
    }

    const finalChanges = [];
    const changedCoords = new Set();
    for (const change of changes) {
        const key = `${change.r},${change.c}`;
        if (!changedCoords.has(key)) { finalChanges.push(change); changedCoords.add(key); }
    }
    for (const sandBlock of changes) {
        for (let depth = 1; depth <= maxDepth; depth++) {
            const below_r = sandBlock.r + depth; const below_c = sandBlock.c; const key = `${below_r},${below_c}`;
            if (changedCoords.has(key) || below_r >= Config.GRID_ROWS) continue;
            const belowType = getBlockType(below_c, below_r); // Use imported getter
            if (belowType === Config.BLOCK_DIRT || belowType === Config.BLOCK_STONE) {
                finalChanges.push({ r: below_r, c: below_c, type: Config.BLOCK_SAND }); changedCoords.add(key);
            } else { break; }
        }
    }

    // Apply all changes using imported setter
    finalChanges.forEach(change => { setBlock(change.c, change.r, change.type); });
    console.log(`Sand pass complete. ${finalChanges.length} blocks changed.`);
}

// --- Public API ---

/**
 * Runs the entire world generation process, step-by-step.
 * Assumes the grid has been initialized by world-data.initializeGrid().
 */
export function generateInitialWorld() {
    console.time("WorldGen");
    generateLandmass();
    // Optional: Add other passes like caves, ores here
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    applySandPass();
    console.timeEnd("WorldGen");
    console.log("Initial world generation finished.");
}