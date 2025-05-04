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
    const islandTaperWidth = 80; // taper from island edge towards center
    const OCEAN_FLOOR_ROW_NEAR_ISLAND = Config.WORLD_WATER_LEVEL_ROW_TARGET + 5; // ocean level constants from Config (ensure they are defined there)
    const OCEAN_STONE_ROW_NEAR_ISLAND = OCEAN_FLOOR_ROW_NEAR_ISLAND + 8;
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
            if (distToIslandEdge < islandTaperWidth && islandTaperWidth > 0) { // apply island taper if within the taper zone
                const islandBlend = Math.max(0, distToIslandEdge) / islandTaperWidth; // use linear blend for simplicity, pow(0.75) can be added back later if needed
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
            if (calcStoneRow < Config.GRID_ROWS) { // ensure stone is below surface if stone is on the map
                 calcStoneRow = Math.max(calcSurfaceRow + 1, calcStoneRow);
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
            worldLevels[islandCol].surface = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].surface));
            worldLevels[islandCol].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandCol].stone)); // keep stone on map
            worldLevels[islandCol].stone = Math.max(worldLevels[islandCol].surface + 1, worldLevels[islandCol].stone);
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
            worldLevels[islandColR].stone = Math.max(0, Math.min(Config.GRID_ROWS - 1, worldLevels[islandColR].stone)); // keep stone on map
            worldLevels[islandColR].stone = Math.max(worldLevels[islandColR].surface + 1, worldLevels[islandColR].stone);
        }
    }
    console.log("Pass 3: Placing blocks...");
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            let blockData = createBlock(Config.BLOCK_AIR, false); // default to AIR / not player placed)
            const levels = worldLevels[c];
            if (!levels) {
                console.warn(`Missing level data for column ${c}`);
                continue;
            }
            const finalSurfaceRow = levels.surface;
            const finalStoneRow = levels.stone;
            const surfaceIsBelowWater = finalSurfaceRow >= Config.WORLD_WATER_LEVEL_ROW_TARGET;
            if (r >= finalStoneRow && finalStoneRow < Config.GRID_ROWS) {
                blockData = createBlock(Config.BLOCK_STONE, false); // place stone below calculated stone level 
            } else if (r > finalSurfaceRow && r < finalStoneRow) {
                if (surfaceIsBelowWater) { // between stone and surface level
                    const distSurfaceBelowWater = finalSurfaceRow - Config.WORLD_WATER_LEVEL_ROW_TARGET;
                    let maxAllowedSandDepth = Math.max(1, Math.min(4, 1 + Math.floor(distSurfaceBelowWater / 1)));
                    const currentDepth = r - finalSurfaceRow;
                    if (currentDepth <= maxAllowedSandDepth) { // sand
                        blockData = createBlock(Config.BLOCK_SAND, false);
                    } else { // exceeded allowed sand depth, place what would normally be here
                        blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_DIRT, false);
                    }
                } else { // surface is above water - standard logic (dirt for island, sand for ocean floor)
                    blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_DIRT, false);
                }
            } else if (r === finalSurfaceRow) { // at calculated surface level
                if (surfaceIsBelowWater) { // surface itself is underwater, place Sand (minimum 1 layer)
                    if (finalStoneRow > finalSurfaceRow) { // ensure stone is below the surface
                        blockData = createBlock(Config.BLOCK_SAND, false); // sand not player placed
                    } else {
                        blockData = createBlock(Config.BLOCK_STONE, false); // stone not player placed (surface == stone level)
                    }
                } else { // surface is above water - standard logic (Grass for island, Sand for ocean floor)
                    blockData = createBlock(levels.isOcean ? Config.BLOCK_SAND : Config.BLOCK_GRASS, false); // Grass/Sand not player placed
                }
            }
            // Set the block data using the direct method for initial generation
            WorldData.setBlockData(c, r, blockData);
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
                if (r === Config.GRID_ROWS - 1 || c === 0 || c === Config.GRID_COLS - 1) { // condition 1: at boundary of the grid? (Bottom or Sides)
                    isSeedPoint = true;
                } else { // condition 2: cardinal neighbours - if any neighbour is NOT AIR, this AIR block borders something solid (or already filled water) and should be a seed point for this pocket
                    const neighborCoords = [
                        { nc: c, nr: r - 1 }, // check above (even above water level)
                        { nc: c, nr: r + 1 }, // below
                        { nc: c - 1, nr: r }, // left
                        { nc: c + 1, nr: r }  // right
                    ];
                    for (const { nc, nr } of neighborCoords) { // ensure neighbour is within *overall grid bounds*
                        if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                            if (WorldData.getBlockType(nc, nr) !== Config.BLOCK_AIR) {
                                isSeedPoint = true;
                                break; // found a non-air neighbour, no need to check others
                            }
                        } else {
                             // neighbour is out of bounds (meaning current cell IS at an edge), treat as non-air border
                             isSeedPoint = true;
                             break;
                        }
                    }
                }
                if (isSeedPoint) { // if it qualifies as a seed point, add to queue and mark visited
                    queue.push({ c, r });
                    visited.add(key);
                }
            }
        }
    }
    console.log(`Flood fill seeded with ${queue.length} points.`);
    let processed = 0; // standard BFS continues from here
    while (queue.length > 0) {
        if (queue.length > 10000 && queue.length % 5000 === 0) {
            console.log(`Flood fill queue size: ${queue.length}, Processed: ${processed}`);
        }
        const { c, r } = queue.shift();
        const currentBlockType = WorldData.getBlockType(c,r); // get current block type *again* inside the loop, as it might have been filled by another path if queue contains duplicates briefly.
        if (r < targetWaterRow || r >= Config.GRID_ROWS || c < 0 || c >= Config.GRID_COLS || currentBlockType !== Config.BLOCK_AIR) { // check bounds, ensure it's BELOW target water level, and is STILL AIR
            continue;
       }
       const success = WorldData.setBlock(c, r, Config.BLOCK_WATER, false); // fill with water
       if (success) {
            processed++;
            const neighborCoords = [ // sdd valid AIR neighbours (must be below targetWaterRow) to the queue
                { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, // only check neighbours that could potentially be filled (at or below water level)
                { nc: c - 1, nr: r }, { nc: c + 1, nr: r }
            ];
            for (const { nc, nr } of neighborCoords) { // ensure neighbor is within grid bounds AND at/below water level - any AIR neighbor within bounds should be queued if current cell is filling, as neighbor could potentially *become* water
                 if (nr >= 0 && nr < Config.GRID_ROWS && nc >= 0 && nc < Config.GRID_COLS) {
                    const nKey = `${nc},${nr}`;
                    if (WorldData.getBlockType(nc, nr) === Config.BLOCK_AIR && !visited.has(nKey)) { // check if neighbor is AIR and not visited
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
    generateLandmass();
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET);
    console.timeEnd("Initial World generated in");
}