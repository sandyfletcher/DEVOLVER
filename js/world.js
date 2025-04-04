// -----------------------------------------------------------------------------
// js/world.js - Handles Grid-Based Terrain Data and Drawing (with Procedural Gen)
// -----------------------------------------------------------------------------
console.log("world.js loaded");

import * as Config from './config.js';
import * as Renderer from './renderer.js';
// Import from the new utility modules
import { PerlinNoise } from './utils/noise.js';
import { createBlock } from './utils/block.js';

// --- Module State ---
let worldGrid = []; // 2D Array: worldGrid[row][col] = blockObject or BLOCK_AIR(0)
let noiseGenerator = null; // Will hold our noise instance
let gridCanvas = null; // Reference to the off-screen grid canvas

// --- Perlin Noise Implementation ---
// // CLASS REMOVED - Now imported from ./utils/noise.js // //
// class PerlinNoise { ... }

// --- Helper functions ---

/**
 * Creates a block object with default properties for a given type.
 * @param {number} type - Block type ID (e.g., Config.BLOCK_DIRT).
 * @param {number} [orientation=Config.ORIENTATION_FULL] - Orientation ID.
 * @returns {object} The block data object { type, orientation, hp, maxHp }.
 */
// // FUNCTION REMOVED - Now imported from ./utils/block.js // //
// function createBlock(type, orientation = Config.ORIENTATION_FULL) { ... }

// --- Add a Linear Interpolation helper function ---
// NOTE: This is a general utility. Could be moved to a shared utils.js later.
function lerp(t, a, b) {
    return a + t * (b - a);
}

/**
 * Gets the block object or BLOCK_AIR at specific grid coordinates - INTERNAL HELPER.
 * Used during initialization passes before full export. Handles boundary checks.
 * @param {number} c - Column index.
 * @param {number} r - Row index.
 * @returns {object | number | null} Block object, BLOCK_AIR (0), or null if out of bounds.
 */
function getBlockInternal(c, r) {
    if (r >= 0 && r < Config.GRID_ROWS && c >= 0 && c < Config.GRID_COLS) {
        // Ensure row exists before accessing column
        return worldGrid[r]?.[c] ?? Config.BLOCK_AIR;
    }
    return null; // Out of bounds
}

/**
 * Gets the block type ID at specific grid coordinates - INTERNAL HELPER.
 * @param {number} c - Column index.
 * @param {number} r - Row index.
 * @returns {number | null} Block type ID or null if out of bounds.
 */
function getBlockTypeInternal(c, r) {
    const block = getBlockInternal(c, r);
    if (block === null) return null;
    // Check if it's an air block (represented by the number 0) or a block object
    return (typeof block === 'number' && block === Config.BLOCK_AIR) ? Config.BLOCK_AIR : block.type;
}

/**
 * Sets a block directly in the grid - INTERNAL HELPER. Uses the imported createBlock.
 * @param {number} c - Column index.
 * @param {number} r - Row index.
 * @param {number} type - Block type ID.
 */
function setBlockInternal(c, r, type) {
    if (r >= 0 && r < Config.GRID_ROWS && c >= 0 && c < Config.GRID_COLS) {
        // Ensure the row array exists (important during initialization)
        if (!worldGrid[r]) {
             console.error(`Attempted to set block in non-existent row: ${r}`);
             worldGrid[r] = []; // Initialize row if needed, though ideally generateLandmass handles this
        }
        // Use the imported createBlock function
        worldGrid[r][c] = createBlock(type);
    }
}

/**
 * Generates the initial landmass (Stone/Dirt/Grass) and fills the rest with Air.
 * Uses the imported PerlinNoise class.
 */
function generateLandmass() {
    console.log("Generating landmass with tapered island edges...");
    worldGrid = [];
    // Use the imported PerlinNoise class
    noiseGenerator = new PerlinNoise(); // Seed is handled internally by PerlinNoise constructor if not provided

    const islandWidth = Math.floor(Config.GRID_COLS * Config.WORLD_ISLAND_WIDTH_PERCENT);
    const islandStartCol = Math.floor((Config.GRID_COLS - islandWidth) / 2);
    const islandEndCol = islandStartCol + islandWidth;

    const edgeTargetSurfaceRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + 2;
    const edgeTargetStoneRow = edgeTargetSurfaceRow + 8;

    const taperWidth = 40;

    const deepOceanBaseRow = Config.WORLD_WATER_LEVEL_ROW_TARGET + Math.floor(Config.GRID_ROWS * 0.1);
    const deepOceanMaxRow = Config.GRID_ROWS - 3;
    const deepOceanFloorStartRow = Math.min(deepOceanMaxRow, deepOceanBaseRow);

    for (let r = 0; r < Config.GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < Config.GRID_COLS; c++) {

            let blockData = Config.BLOCK_AIR; // Default to air

            if (c >= islandStartCol && c < islandEndCol) {
                // --- Inside Island Area (with Tapering) ---
                const noiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE);
                const heightVariation = Math.round(noiseVal * Config.WORLD_GROUND_VARIATION);
                let baseSurfaceRow = Config.WORLD_GROUND_LEVEL_MEAN + heightVariation;

                const stoneNoiseVal = noiseGenerator.noise(c * Config.WORLD_NOISE_SCALE * 0.5 + 100);
                const stoneVariation = Math.round(stoneNoiseVal * Config.WORLD_STONE_VARIATION);
                let baseStoneRow = Config.WORLD_STONE_LEVEL_MEAN + stoneVariation;
                baseStoneRow = Math.max(baseSurfaceRow + 3, baseStoneRow);

                // --- Apply Tapering ---
                const distToLeftEdge = c - islandStartCol;
                const distToRightEdge = (islandEndCol - 1) - c;
                const distToNearestEdge = Math.min(distToLeftEdge, distToRightEdge);

                let finalSurfaceRow = baseSurfaceRow;
                let finalStoneRow = baseStoneRow;

                if (distToNearestEdge < taperWidth && taperWidth > 0) {
                    const blend = Math.pow(distToNearestEdge / taperWidth, 0.75);
                    finalSurfaceRow = Math.round(lerp(blend, edgeTargetSurfaceRow, baseSurfaceRow));
                    finalStoneRow = Math.round(lerp(blend, edgeTargetStoneRow, baseStoneRow));
                    finalStoneRow = Math.max(finalSurfaceRow + 2, finalStoneRow);
                }

                finalSurfaceRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalSurfaceRow));
                finalStoneRow = Math.max(0, Math.min(Config.GRID_ROWS - 1, finalStoneRow));
                finalStoneRow = Math.max(finalSurfaceRow + 1, finalStoneRow);

                // --- Determine Block Type for Island ---
                if (r >= finalStoneRow) {
                    blockData = createBlock(Config.BLOCK_STONE); // Use imported createBlock
                } else if (r > finalSurfaceRow) {
                    blockData = createBlock(Config.BLOCK_DIRT);  // Use imported createBlock
                } else if (r === finalSurfaceRow) {
                    blockData = createBlock(Config.BLOCK_GRASS); // Use imported createBlock
                }
                // Else remains BLOCK_AIR

            } else {
                // --- Outside Island Area (Ocean Floor - Tapered) ---
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
                    if (r >= oceanFloorRow + 1 + Math.round(oceanNoise * 2)) {
                        blockData = createBlock(Config.BLOCK_STONE); // Use imported createBlock
                    } else {
                        blockData = createBlock(Config.BLOCK_DIRT);  // Use imported createBlock
                    }
                }
                // Else remains BLOCK_AIR
            }
            row.push(blockData);
        }
        worldGrid.push(row);
    }
    console.log("Landmass generation complete (tapered edges, air oceans).");
}


/**
 * Fills connected air blocks below the target water level with water using Flood Fill (BFS).
 * @param {number} targetWaterRow - The highest row index (inclusive) that water should reach.
 */
function applyFloodFill(targetWaterRow) {
    console.log(`Applying flood fill up to row ${targetWaterRow}...`);
    const queue = [];
    const visited = new Set(); // Track visited cells: "c,r"

    // --- Start Flood Fill from Edges and Bottom (below or at targetWaterRow) ---
    // Bottom edge (all columns, rows from targetWaterRow down)
    for (let c = 0; c < Config.GRID_COLS; c++) {
        for (let r = targetWaterRow; r < Config.GRID_ROWS; r++) { // Start from targetWaterRow
             // Use internal getter which handles boundaries and returns type or null
            const blockType = getBlockTypeInternal(c, r);
            const key = `${c},${r}`;
             // Check if it's air and not visited
            if (blockType === Config.BLOCK_AIR && !visited.has(key)) {
                queue.push({ c, r });
                visited.add(key);
            }
        }
    }

    // Side edges (rows 0 up to targetWaterRow)
    for (let r = 0; r < targetWaterRow; r++) { // Only up to target level
        const keyLeft = `0,${r}`;
        if (getBlockTypeInternal(0, r) === Config.BLOCK_AIR && !visited.has(keyLeft)) {
            queue.push({ c: 0, r });
            visited.add(keyLeft);
        }
        const keyRight = `${Config.GRID_COLS - 1},${r}`;
        if (getBlockTypeInternal(Config.GRID_COLS - 1, r) === Config.BLOCK_AIR && !visited.has(keyRight)) {
            queue.push({ c: Config.GRID_COLS - 1, r });
            visited.add(keyRight);
        }
    }
     // Top edge (all columns at row 0, only if targetWaterRow is 0 or higher)
     // This is less common but handles cases where water *could* reach the top
     // EDIT: Flood fill should generally start *below* the water line or *at* the edges.
     // Starting from the top edge surface might fill unintended areas if there are floating islands.
     // Let's stick to Bottom and Sides below water level as starting points.

    // Breadth-First Search
    while (queue.length > 0) {
        const { c, r } = queue.shift();

        // Check block type again (it might have been processed by another path)
        const currentType = getBlockTypeInternal(c, r);
        if (currentType !== Config.BLOCK_AIR) {
            continue;
        }

        // *** CRITICAL LOGIC: Only fill with water if AT or BELOW the target level ***
        if (r >= targetWaterRow) {
            // Use internal setter which uses the imported createBlock
            setBlockInternal(c, r, Config.BLOCK_WATER);

            // Add valid, unvisited, AIR neighbors to the queue
            const neighborCoords = [
                { nc: c, nr: r - 1 }, // Up
                { nc: c, nr: r + 1 }, // Down
                { nc: c - 1, nr: r }, // Left
                { nc: c + 1, nr: r }  // Right
            ];

            for (const { nc, nr } of neighborCoords) {
                const nKey = `${nc},${nr}`;
                // Check bounds, if it's AIR, and not visited
                // Note: getBlockTypeInternal handles boundary checks implicitly (returns null)
                if (!visited.has(nKey) && getBlockTypeInternal(nc, nr) === Config.BLOCK_AIR)
                {
                     // Add to visited *before* queueing to prevent duplicates in queue
                     visited.add(nKey);
                     // Enqueue the neighbor to be processed
                     queue.push({ c: nc, r: nr });
                }
            }
        }
        // If r < targetWaterRow, we reached this air block from below, but we don't fill it
        // with water, and we stop exploring upwards from here in the fill.
        // We still need to add valid neighbors ABOVE the water line to the queue
        // IF they haven't been visited, so the BFS explores all connected air pockets,
        // even if it doesn't fill them above the water line. Let's refine the neighbor logic:

        /* // Revised Neighbor Logic (consider if needed):
         * Explore all neighbours regardless of water level,
         * but only fill if >= targetWaterRow
         */
         /* // Simpler logic kept: Only add neighbours if the current block was filled (r >= targetWaterRow)
          * This prevents exploring air pockets entirely above the water line, which is faster
          * and sufficient for filling the "ocean". If disconnected underwater caves need filling,
          * the starting point logic would need adjustment.
          */

    }
    console.log("Flood fill complete.");
}


/**
 * Applies sand generation along water edges after flood fill.
 */
function applySandPass() {
    console.log("Applying sand generation pass (thicker beaches)...");
    const changes = []; // Store {r, c, type} coords to change
    const maxDepth = 3; // How many blocks deep sand can replace dirt/stone below water adjacency
    const maxRaise = 1; // How many blocks above the *target* water level sand can appear

    // Iterate relevant grid area (optimization potential)
    // Determine iteration range based on potential ground/water interface
    const minCheckRow = Math.max(0, Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise - 5); // Check a bit above potential sand
    const maxCheckRow = Math.min(Config.GRID_ROWS, Config.WORLD_WATER_LEVEL_ROW_TARGET + maxDepth + 20); // Check deeper below water level

    for (let r = minCheckRow; r < maxCheckRow; r++) {
        for (let c = 0; c < Config.GRID_COLS; c++) {
            const blockType = getBlockTypeInternal(c, r);

            // Check only Dirt, Stone, or Grass blocks initially
            if (blockType === Config.BLOCK_DIRT || blockType === Config.BLOCK_STONE || blockType === Config.BLOCK_GRASS) {
                let adjacentWater = false;
                // Check 8 neighbours (ortho + diagonal)
                const neighborCoords = [
                    { nc: c, nr: r - 1 }, { nc: c, nr: r + 1 }, { nc: c - 1, nr: r }, { nc: c + 1, nr: r },
                    { nc: c - 1, nr: r - 1 }, { nc: c + 1, nr: r - 1 }, { nc: c - 1, nr: r + 1 }, { nc: c + 1, nr: r + 1 }
                ];

                for (const { nc, nr } of neighborCoords) {
                    if (getBlockTypeInternal(nc, nr) === Config.BLOCK_WATER) {
                        adjacentWater = true;
                        break;
                    }
                }

                if (adjacentWater) {
                    // This block is adjacent to water. Check if it's within the height range for sand.
                    // Sand can form from slightly above the water level downwards.
                    if (r >= Config.WORLD_WATER_LEVEL_ROW_TARGET - maxRaise) {
                        // Mark this block to potentially become sand.
                        changes.push({ r, c, type: Config.BLOCK_SAND });
                    }
                }
            }
        }
    }

    // --- Second Pass: Apply initial changes and extend sand downwards ---
    const finalChanges = []; // Store all changes to apply at the end
    const changedCoords = new Set(); // Track "r,c" strings already marked

    // Apply initial adjacent-to-water changes first
    for (const change of changes) {
         const key = `${change.r},${change.c}`;
         if (!changedCoords.has(key)) {
              finalChanges.push(change);
              changedCoords.add(key);
         }
    }


    // Now, for each block initially marked as sand, check below it
    for (const sandBlock of changes) { // Iterate original adjacent blocks
        for (let depth = 1; depth <= maxDepth; depth++) {
            const below_r = sandBlock.r + depth;
            const below_c = sandBlock.c;
            const key = `${below_r},${below_c}`;

            // Stop if already processed or out of bounds
            if (changedCoords.has(key) || below_r >= Config.GRID_ROWS) {
                continue; // Skip if already sand or handled
            }

            const belowType = getBlockTypeInternal(below_c, below_r);

            // Only replace Dirt or Stone below the initial sand layer
            if (belowType === Config.BLOCK_DIRT || belowType === Config.BLOCK_STONE) {
                 finalChanges.push({ r: below_r, c: below_c, type: Config.BLOCK_SAND });
                 changedCoords.add(key);
            } else {
                 // Stop going deeper for this column if we hit air, water, sand, grass etc.
                 break;
            }
        }
    }

    // Apply all collected changes to the grid
    finalChanges.forEach(change => {
        // Use internal setter
        setBlockInternal(change.c, change.r, change.type);
    });

    console.log(`Sand pass complete. ${finalChanges.length} blocks changed to sand.`);
}


/**
 * Draws the static grid lines onto the off-screen grid canvas (once).
 * (Function logic remains the same, relies on Renderer module)
 */
function drawGridLayerOnce() {
    const gridCtx = Renderer.getGridContext();
    if (!gridCtx || !gridCanvas) { console.error("World.drawGridLayerOnce: Grid context/canvas missing!"); return; }
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.strokeStyle = 'rgba(50, 50, 50, 0.1)'; // Faint grid lines
    gridCtx.lineWidth = 0.5;

    // Draw vertical lines
    for (let c = 0; c <= Config.GRID_COLS; c++) { // Iterate one past the last column for the final line
        const x = c * Config.BLOCK_WIDTH;
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, gridCanvas.height);
        gridCtx.stroke();
    }
    // Draw horizontal lines
    for (let r = 0; r <= Config.GRID_ROWS; r++) { // Iterate one past the last row for the final line
        const y = r * Config.BLOCK_HEIGHT;
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(gridCanvas.width, y);
        gridCtx.stroke();
    }

    gridCtx.restore();
    console.log("Static grid layer drawn.");
}


// --- PUBLIC EXPORTED FUNCTIONS ---

/**
 * Initializes the world: generates terrain, applies water/sand, prepares drawing layers.
 */
export function init() {
    console.time("WorldInit");
    generateLandmass();       // Step 1: Base terrain (uses imported Noise and createBlock)
    // Step 2: Optional - Add stone variations, caves, ores etc. (e.g., applyStonePatches();)
    applyFloodFill(Config.WORLD_WATER_LEVEL_ROW_TARGET); // Step 3: Water (uses internal helpers)
    applySandPass();          // Step 4: Sand beaches (uses internal helpers)

    // Ensure grid canvas exists via Renderer
    gridCanvas = Renderer.getGridCanvas();
    if (!gridCanvas) {
        Renderer.createGridCanvas(Config.GRID_COLS * Config.BLOCK_WIDTH, Config.GRID_ROWS * Config.BLOCK_HEIGHT); // Ensure size matches world
        gridCanvas = Renderer.getGridCanvas(); // Get the reference after creation
    } else {
         // Optional: Resize if necessary (e.g., config changed)
         if (gridCanvas.width !== Config.GRID_COLS * Config.BLOCK_WIDTH || gridCanvas.height !== Config.GRID_ROWS * Config.BLOCK_HEIGHT) {
              gridCanvas.width = Config.GRID_COLS * Config.BLOCK_WIDTH;
              gridCanvas.height = Config.GRID_ROWS * Config.BLOCK_HEIGHT;
         }
    }


    if (gridCanvas) {
        drawGridLayerOnce(); // Step 5: Draw static grid background
    } else {
        console.error("World Init: Failed to get or create grid canvas!");
    }

    console.timeEnd("WorldInit");
    console.log("World initialized with improved procedural generation.");
}

// --- Getters and Setters (Public API) ---

/**
 * Gets the block object or BLOCK_AIR at specific grid coordinates. Safe public version.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {object | number | null} Block object, BLOCK_AIR (0), or null if out of bounds.
 */
export function getBlock(col, row) {
    // Use the internal helper for consistency
    return getBlockInternal(col, row);
}

/**
 * Gets the block type ID at specific grid coordinates. Safe public version.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {number | null} Block type ID or null if out of bounds.
 */
export function getBlockType(col, row) {
    // Use the internal helper for consistency
    return getBlockTypeInternal(col, row);
}

/**
 * Sets a block in the grid using type and orientation. Public interface for gameplay changes.
 * Uses the imported createBlock function.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @param {number} blockType - The type ID of the block to place (e.g., Config.BLOCK_STONE).
 * @param {number} [orientation=Config.ORIENTATION_FULL] - The orientation for the new block.
 */
export function setBlock(col, row, blockType, orientation = Config.ORIENTATION_FULL) {
    if (row >= 0 && row < Config.GRID_ROWS && col >= 0 && col < Config.GRID_COLS) {
        // Ensure the row exists (important for runtime modifications)
        if (!worldGrid[row]) {
             console.warn(`Row ${row} did not exist when setting block at ${col},${row}. Initializing.`);
             worldGrid[row] = new Array(Config.GRID_COLS).fill(Config.BLOCK_AIR); // Or fill based on expected state
        }
         // Use the imported createBlock function
        worldGrid[row][col] = createBlock(blockType, orientation);
        // TODO: Add logic here to mark this block/chunk as "dirty" for optimized drawing
    } else {
        // console.warn(`Set block out of bounds: ${row}, ${col}`);
    }
}

// --- Drawing ---
/**
 * Draws the visible portion of the world grid onto the main canvas context.
 * @param {CanvasRenderingContext2D} ctx - The main drawing context.
 */
export function draw(ctx) {
    if (!ctx) { console.error("World.draw: No context provided!"); return; }

    // 1. Draw Static Grid Layer (pre-rendered)
    if (gridCanvas) {
        // Potential Optimization: Only draw if gridCanvas is actually visible in the viewport
        ctx.drawImage(gridCanvas, 0, 0); // Assuming viewport starts at 0,0 of world for now
    }

    // 2. Draw Dynamic Blocks
    // TODO: Optimize to only draw visible/dirty blocks/chunks based on viewport
    const startRow = 0; // Replace with viewport calculation later
    const endRow = Config.GRID_ROWS; // Replace with viewport calculation later
    const startCol = 0; // Replace with viewport calculation later
    const endCol = Config.GRID_COLS; // Replace with viewport calculation later

    for (let r = startRow; r < endRow; r++) {
        if (!worldGrid[r]) continue; // Skip if row doesn't exist (safety check)

        for (let c = startCol; c < endCol; c++) {
            const block = worldGrid[r][c]; // Use direct access within loop bounds

            // Skip air blocks (represented by 0 or potentially undefined/null if row was sparse)
            if (!block || block === Config.BLOCK_AIR) continue;

            // Block is an object, access its type
            const blockType = block.type;
            const blockColor = Config.BLOCK_COLORS[blockType];

            // Skip if block type has no color defined (or if it's somehow invalid)
            if (!blockColor) continue;

            const blockX = c * Config.BLOCK_WIDTH;
            const blockY = r * Config.BLOCK_HEIGHT;
            const orientation = block.orientation; // Get orientation from block object

            // TODO: Implement drawing logic for different orientations (slopes, etc.)
            if (orientation === Config.ORIENTATION_FULL) {
                ctx.fillStyle = blockColor;
                // Use Math.floor for coords, Math.ceil for size for pixel-perfect grid covering
                // OR use non-integer values if viewport/camera allows fractional positions
                ctx.fillRect(
                    Math.floor(blockX), // Pixel snapping for crispness if camera is aligned
                    Math.floor(blockY),
                    Math.ceil(Config.BLOCK_WIDTH), // Ensure full coverage
                    Math.ceil(Config.BLOCK_HEIGHT)
                );
            } else {
                 // Placeholder for drawing slopes/other orientations
                 // Example: Draw a base color and then a shape for the slope
                 ctx.fillStyle = blockColor; // Base color
                 ctx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.ceil(Config.BLOCK_WIDTH), Math.ceil(Config.BLOCK_HEIGHT));
                 ctx.fillStyle = "rgba(0,0,0,0.2)"; // Indicate slope with overlay for now
                 ctx.font = '8px sans-serif';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(orientation, blockX + Config.BLOCK_WIDTH / 2, blockY + Config.BLOCK_HEIGHT / 2); // Draw orientation ID
            }
        }
    }
}


// --- Collision and Utilities ---

/**
 * Checks if a block at given grid coordinates is considered solid for collision purposes.
 * @param {number} col - Column index.
 * @param {number} row - Row index.
 * @returns {boolean} True if the block is solid, false otherwise.
 */
export function isSolid(col, row) {
    const block = getBlock(col, row); // Use public getter (handles bounds)

    // Out of bounds or air is not solid
    if (block === null || block === Config.BLOCK_AIR) return false;

    // Block is an object, check its type
    const blockType = block.type;
    const orientation = block.orientation; // Might need orientation for slopes

    // Water is generally not solid (unless maybe specific types/orientations later)
    if (blockType === Config.BLOCK_WATER /* && orientation === Config.ORIENTATION_FULL */) {
         return false;
    }

    // TODO: Refine based on orientation for slopes.
    // For now, any non-air, non-full-water block is considered solid.
    // This means entities will collide with the bounding box of sloped blocks.
    // More accurate slope collision requires checking position within the block based on orientation.
    return true;
}

/**
 * Converts world coordinates (pixels) to grid coordinates (column, row).
 * @param {number} worldX - X position in pixels.
 * @param {number} worldY - Y position in pixels.
 * @returns {{col: number, row: number}} Object containing column and row indices.
 */
export function worldToGridCoords(worldX, worldY) {
    const col = Math.floor(worldX / Config.BLOCK_WIDTH);
    const row = Math.floor(worldY / Config.BLOCK_HEIGHT);
    return { col, row };
}

/**
 * Finds the Y coordinate (in pixels) of the highest solid block surface in a given column.
 * May be less useful with complex terrain/overhangs.
 * @param {number} col - Column index.
 * @returns {number} The Y pixel coordinate of the top surface, or canvas height if column is empty/out of bounds.
 */
export function getCollisionSurfaceY(col) {
    if (col < 0 || col >= Config.GRID_COLS) {
        return Config.CANVAS_HEIGHT; // Treat out of bounds as bottomless
    }
    for (let r = 0; r < Config.GRID_ROWS; r++) {
        if (isSolid(col, r)) {
            return r * Config.BLOCK_HEIGHT; // Return the top edge of the solid block
        }
    }
    return Config.CANVAS_HEIGHT; // No solid block found in this column
}

/**
 * Checks grid collision for a given entity based on its current position and velocity.
 * Modifies the entity's position and velocity directly upon collision.
 * @param {object} entity - The entity object (must have x, y, width, height, vx, vy properties).
 * @returns {{collidedX: boolean, collidedY: boolean, isOnGround: boolean}} Collision results.
 */
export function checkGridCollision(entity) {
    // Destructure entity properties for easier access
    let { x, y, width, height, vx, vy } = entity;
    let collidedX = false;
    let collidedY = false;
    let isOnGround = false; // Track if landed specifically in this step

    // --- Vertical Collision Prediction & Resolution ---
    const predictY = y + vy; // Where the entity *will* be vertically

    if (vy > 0) { // Moving Down / Falling
        // Calculate grid coordinates for the feet at the predicted Y position
        const feetY = predictY + height;
        // Check slightly inset points along the bottom edge to avoid snagging on shared corners
        const checkColLeft = worldToGridCoords(x + 1, feetY).col;
        const checkColRight = worldToGridCoords(x + width - 1, feetY).col;
        const checkRow = worldToGridCoords(x, feetY).row; // Row is the same for both points

        // Check for solid blocks at the check points
        if (isSolid(checkColLeft, checkRow) || isSolid(checkColRight, checkRow)) {
            // Collision detected below. Find the surface Y.
            const groundSurfaceY = checkRow * Config.BLOCK_HEIGHT;
            // Check if entity is *about* to penetrate or already slightly penetrating
             if (y + height <= groundSurfaceY + 0.1) { // Use a small tolerance
                  entity.y = groundSurfaceY - height; // Snap entity's bottom to the ground surface
                  entity.vy = 0;                      // Stop vertical movement
                  collidedY = true;                   // Report vertical collision
                  isOnGround = true;                  // Entity has landed
             } else {
                  // Edge case: Moving very fast, prediction step overshot significantly?
                  // Or initial position was already intersecting? Snapping might still be needed.
                  // Consider if snapping is always desired on downward collision. For now, only snap if close.
             }
        }
    } else if (vy < 0) { // Moving Up
        // Calculate grid coordinates for the head at the predicted Y position
        const headY = predictY;
        const checkColLeft = worldToGridCoords(x + 1, headY).col;
        const checkColRight = worldToGridCoords(x + width - 1, headY).col;
        const checkRow = worldToGridCoords(x, headY).row;

        if (isSolid(checkColLeft, checkRow) || isSolid(checkColRight, checkRow)) {
            // Collision detected above. Find the ceiling surface Y.
            const ceilingSurfaceY = (checkRow + 1) * Config.BLOCK_HEIGHT;
            // Check if entity is *about* to penetrate or already slightly penetrating
             if (y >= ceilingSurfaceY - 0.1) { // Use a small tolerance
                 entity.y = ceilingSurfaceY; // Snap entity's top to the ceiling surface
                 entity.vy = 0;              // Stop vertical movement
                 collidedY = true;           // Report vertical collision
             }
        }
    }
     // Update y for horizontal check based on potential vertical correction
     y = entity.y;


    // --- Horizontal Collision Prediction & Resolution ---
    const predictX = x + vx; // Where the entity *will* be horizontally

    if (vx > 0) { // Moving Right
        // Calculate grid coordinates for the right edge at the (potentially corrected) Y position
        const rightEdgeX = predictX + width;
        const checkCol = worldToGridCoords(rightEdgeX, y).col;
        // Check points along the right edge (top, middle, bottom) - slight vertical inset
        const checkRowTop = worldToGridCoords(rightEdgeX, y + 1).row;
        const checkRowMid = worldToGridCoords(rightEdgeX, y + height / 2).row;
        const checkRowBot = worldToGridCoords(rightEdgeX, y + height - 1).row;

        if (isSolid(checkCol, checkRowTop) || isSolid(checkCol, checkRowMid) || isSolid(checkCol, checkRowBot)) {
            // Collision detected to the right. Find the wall surface X.
            const wallSurfaceX = checkCol * Config.BLOCK_WIDTH;
             // Check if entity is *about* to penetrate or already slightly penetrating
             if (x + width <= wallSurfaceX + 0.1) { // Use small tolerance
                 entity.x = wallSurfaceX - width; // Snap entity's right edge to the wall surface
                 entity.vx = 0;                   // Stop horizontal movement
                 collidedX = true;                // Report horizontal collision
             }
        }
    } else if (vx < 0) { // Moving Left
        // Calculate grid coordinates for the left edge at the (potentially corrected) Y position
        const leftEdgeX = predictX;
        const checkCol = worldToGridCoords(leftEdgeX, y).col;
        // Check points along the left edge (top, middle, bottom) - slight vertical inset
        const checkRowTop = worldToGridCoords(leftEdgeX, y + 1).row;
        const checkRowMid = worldToGridCoords(leftEdgeX, y + height / 2).row;
        const checkRowBot = worldToGridCoords(leftEdgeX, y + height - 1).row;

        if (isSolid(checkCol, checkRowTop) || isSolid(checkCol, checkRowMid) || isSolid(checkCol, checkRowBot)) {
            // Collision detected to the left. Find the wall surface X.
            const wallSurfaceX = (checkCol + 1) * Config.BLOCK_WIDTH;
            // Check if entity is *about* to penetrate or already slightly penetrating
             if (x >= wallSurfaceX - 0.1) { // Use small tolerance
                 entity.x = wallSurfaceX; // Snap entity's left edge to the wall surface
                 entity.vx = 0;           // Stop horizontal movement
                 collidedX = true;        // Report horizontal collision
             }
        }
    }

     // --- Final Ground Check ---
     // This is important if horizontal movement caused the entity to move off a ledge,
     // or if the entity started exactly on an edge. Check *just below* the current position.
     if (!isOnGround) { // Only perform if downward collision didn't already confirm ground contact
         const checkYBelow = entity.y + height + 1; // Check 1 pixel below the feet
         const checkColLeft = worldToGridCoords(entity.x + 1, checkYBelow).col;
         const checkColRight = worldToGridCoords(entity.x + width - 1, checkYBelow).col;
         const checkRowBelow = worldToGridCoords(entity.x, checkYBelow).row;

         if (isSolid(checkColLeft, checkRowBelow) || isSolid(checkColRight, checkRowBelow)) {
              // There is solid ground directly below. Determine the surface Y.
              const groundSurfaceY = checkRowBelow * Config.BLOCK_HEIGHT;
              // Check if the entity is *very* close to this ground. This handles cases where
              // the entity might be floating 0.001 pixels above ground.
              if (Math.abs((entity.y + height) - groundSurfaceY) < 1.0) { // Allow tolerance (e.g., 1 pixel)
                 isOnGround = true; // Set ground status
                 // Optional: Snap Y position *if* entity is not moving vertically.
                 // Avoid snapping if the entity is actively jumping (vy < 0).
                 // if (entity.vy >= 0) {
                 //    entity.y = groundSurfaceY - height;
                 // }
             }
         }
     }


    return { collidedX, collidedY, isOnGround };
}


// --- Update function (for world effects like grass spread, water flow - future) ---
/**
 * Updates the world state over time (e.g., simulations). Placeholder for now.
 * @param {number} dt - Delta time in seconds.
 */
export function update(dt) {
    // Placeholder for future world simulation logic
    // - Grass spreading
    // - Water flowing (simple cellular automata?)
    // - Sand falling?
    // - Plant growth?
    // - Block updates (e.g., damage ticks)
}